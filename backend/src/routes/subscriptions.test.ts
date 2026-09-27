import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import webPush from 'web-push';
import { eq } from 'drizzle-orm';
import { signUp, testAgent } from '../../tests/helpers.js';
import { db } from '../db/index.js';
import { expenseStreams } from '../db/tables.js';
import { addDays, today } from '../services/dates.js';
import { getSubscriptionDigest } from '../services/subscriptions.js';
import { sweepSubscriptionDigests } from '../services/subscription-digests.js';

const body = {
	name: 'Netflix',
	actualCents: 1500,
	intervalDays: 30,
	recurrence: 'monthly',
	firstDate: '2026-10-01',
	isSubscription: true
};

describe('subscription streams and reviews', () => {
	beforeEach(() => {
		const keys = webPush.generateVAPIDKeys();
		vi.stubEnv('VAPID_PUBLIC_KEY', keys.publicKey);
		vi.stubEnv('VAPID_PRIVATE_KEY', keys.privateKey);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	async function person() {
		const a = testAgent();
		await signUp(a, 'subscriptions@example.com');
		const userId = (await a.get('/api/me')).body.user.id as string;
		const created = await a.post('/api/expense-streams').send(body);
		expect(created.status).toBe(201);
		return { a, userId, stream: created.body };
	}

	it('protects both review endpoints and normalizes monthly/yearly costs', async () => {
		const anonymous = testAgent();
		expect((await anonymous.get('/api/subscriptions/digest')).status).toBe(401);
		expect((await anonymous.post('/api/subscriptions/dismiss')).status).toBe(401);
		const { a } = await person();
		await a
			.post('/api/expense-streams')
			.send({ ...body, name: 'Annual plan', actualCents: 12000, recurrence: 'yearly' });
		expect((await a.get('/api/subscriptions/digest')).body).toMatchObject({
			count: 2,
			monthlyCents: 2500
		});
	});

	it('reuses an existing singular tag, keeps its identity on rename, and converts existing expenses', async () => {
		const a = testAgent();
		await signUp(a, 'tag-subscriptions@example.com');
		const tag = (await a.post('/api/tags').send({ name: 'subscription' })).body;
		const created = await a
			.post('/api/expense-streams')
			.send({ ...body, isSubscription: undefined, tagId: tag.id });
		expect(created.body).toMatchObject({ tagId: tag.id, isSubscription: true });
		await a.patch(`/api/tags/${tag.id}`).send({ name: 'Memberships' });
		const tags = (await a.get('/api/tags')).body.tags;
		expect(tags.filter((t: { presetKey: string }) => t.presetKey === 'subscriptions')).toHaveLength(
			1
		);
		expect((await a.post('/api/expense-streams').send(body)).body.tagId).toBe(tag.id);
		const ordinary = (await a.post('/api/expense-streams').send({ ...body, isSubscription: false }))
			.body;
		expect(
			(await a.patch(`/api/expense-streams/${ordinary.id}`).send({ isSubscription: true })).body
		).toMatchObject({ isSubscription: true, tagId: tag.id });
		expect(
			(await a.patch(`/api/expense-streams/${ordinary.id}`).send({ isSubscription: false })).body
		).toMatchObject({ isSubscription: false, tagId: null });
	});

	it('rejects income subscriptions and foreign tags, and repairs a deleted subscription tag', async () => {
		const { a, stream } = await person();
		expect((await a.post('/api/income-streams').send(body)).status).toBe(400);
		const b = testAgent();
		await signUp(b, 'other-subscriptions@example.com');
		expect(
			(await b.post('/api/expense-streams').send({ ...body, tagId: stream.tagId })).status
		).toBe(400);
		expect((await b.get('/api/subscriptions/digest')).body.count).toBe(0);
		await a.delete(`/api/tags/${stream.tagId}`);
		await a.get('/api/tags');
		const repaired = (await a.get('/api/expense-streams')).body.streams[0];
		expect(repaired.isSubscription).toBe(true);
		expect(repaired.tagId).not.toBeNull();
		expect(repaired.tagId).not.toBe(stream.tagId);
	});

	it('waits 90 days, deduplicates concurrent sends, keeps the banner due, and dismisses across channels', async () => {
		const send = vi
			.spyOn(webPush, 'sendNotification')
			.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
		const { a, userId } = await person();
		await a.post('/api/push/subscriptions').send({
			endpoint: 'https://fcm.googleapis.com/fcm/send/review',
			keys: { p256dh: 'test', auth: 'test' }
		});
		expect((await a.get('/api/subscriptions/digest')).body).toMatchObject({
			count: 1,
			monthlyCents: 1500,
			due: false,
			nextReviewOn: addDays(today(), 90)
		});
		await db
			.update(expenseStreams)
			.set({ subscriptionSince: addDays(today(), -89) })
			.where(eq(expenseStreams.userId, userId));
		expect((await sweepSubscriptionDigests()).reminded).toBe(0);
		await db
			.update(expenseStreams)
			.set({ subscriptionSince: addDays(today(), -90) })
			.where(eq(expenseStreams.userId, userId));
		await Promise.all([sweepSubscriptionDigests(), sweepSubscriptionDigests()]);
		expect(send).toHaveBeenCalledTimes(1);
		expect((await getSubscriptionDigest(userId)).due).toBe(true);
		expect((await a.post('/api/subscriptions/dismiss')).status).toBe(204);
		expect((await getSubscriptionDigest(userId)).due).toBe(false);
		expect((await getSubscriptionDigest(userId, addDays(today(), 90))).due).toBe(true);
		expect((await sweepSubscriptionDigests(addDays(today(), 90))).reminded).toBe(1);
	});

	it('bounds failed delivery retries to once daily and skips users with no tracked subscriptions', async () => {
		const send = vi.spyOn(webPush, 'sendNotification').mockRejectedValue(new Error('offline'));
		const { a, userId, stream } = await person();
		await a.post('/api/push/subscriptions').send({
			endpoint: 'https://fcm.googleapis.com/fcm/send/retry',
			keys: { p256dh: 'test', auth: 'test' }
		});
		await db
			.update(expenseStreams)
			.set({ subscriptionSince: addDays(today(), -90) })
			.where(eq(expenseStreams.userId, userId));
		await sweepSubscriptionDigests();
		await sweepSubscriptionDigests();
		expect(send).toHaveBeenCalledTimes(1);
		await sweepSubscriptionDigests(addDays(today(), 1));
		expect(send).toHaveBeenCalledTimes(2);
		await a.delete(`/api/expense-streams/${stream.id}`);
		expect((await a.get('/api/subscriptions/digest')).body).toMatchObject({
			count: 0,
			due: false,
			nextReviewOn: null
		});
		await sweepSubscriptionDigests(addDays(today(), 2));
		expect(send).toHaveBeenCalledTimes(2);
	});
});
