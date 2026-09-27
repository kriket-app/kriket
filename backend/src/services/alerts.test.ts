import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import webPush from 'web-push';
import { signUp, testAgent, type TestAgent } from '../../tests/helpers.js';
import { upsertCheckin } from '../crud/checkins.js';
import {
	ALERT_HORIZON_DAYS,
	describeDip,
	findUpcomingDip,
	inAlertHours,
	sweepForecastAlerts
} from './alerts.js';
import { forecastFromCheckin, type StreamInput } from './forecast.js';

const stream = (
	name: string,
	cents: number,
	firstDate: string,
	intervalDays = 30
): StreamInput => ({
	id: name,
	name,
	tagId: null,
	minCents: cents,
	actualCents: cents,
	maxCents: cents,
	intervalDays,
	firstDate
});

// Built the way the sweep builds it: from a check-in on Oct 1, which already counts that day.
const forecast = (
	balanceCents: number,
	{ incomes = [], expenses = [] }: { incomes?: StreamInput[]; expenses?: StreamInput[] }
) => forecastFromCheckin({ balanceCents, checkedOn: '2026-10-01' }, 30, incomes, expenses);

describe('findUpcomingDip', () => {
	it('finds the first day the expected balance goes below zero in the coming week', () => {
		const f = forecast(10000, { expenses: [stream('Rent', 15000, '2026-10-04')] });
		expect(findUpcomingDip(f, '2026-10-01', ALERT_HORIZON_DAYS)).toEqual({
			date: '2026-10-04',
			balanceCents: -5000
		});
	});

	it('ignores a dip past the horizon', () => {
		const f = forecast(10000, { expenses: [stream('Rent', 15000, '2026-10-10')] });
		expect(findUpcomingDip(f, '2026-10-01', ALERT_HORIZON_DAYS)).toBeNull();
	});

	it('does not count a balance that was already below zero before today', () => {
		const f = forecast(10000, { expenses: [stream('Rent', 15000, '2026-10-02')] });
		expect(findUpcomingDip(f, '2026-10-03', ALERT_HORIZON_DAYS)).toBeNull();
	});

	it('does not count a balance the user checked in as negative', () => {
		// An overdrawn user who checks in every morning is not told again each day.
		const f = forecast(-100, {});
		expect(findUpcomingDip(f, '2026-10-01', ALERT_HORIZON_DAYS)).toBeNull();
	});

	it('counts a bill the day after the check-in that takes it below zero', () => {
		const f = forecast(10000, { expenses: [stream('Rent', 15000, '2026-10-02')] });
		expect(findUpcomingDip(f, '2026-10-01', ALERT_HORIZON_DAYS)).toEqual({
			date: '2026-10-02',
			balanceCents: -5000
		});
	});

	it('finds a second dip after the balance recovers', () => {
		const f = forecast(10000, {
			incomes: [stream('Pay', 20000, '2026-10-03')],
			expenses: [stream('Rent', 15000, '2026-10-02'), stream('Car', 20000, '2026-10-05')]
		});
		expect(findUpcomingDip(f, '2026-10-03', ALERT_HORIZON_DAYS)).toEqual({
			date: '2026-10-05',
			balanceCents: -5000
		});
	});
});

const dip = (date: string) => describeDip({ date, balanceCents: -12045 }, '2026-10-01').body;

describe('describeDip', () => {
	it('says today, tomorrow, or the day', () => {
		expect(dip('2026-10-01')).toBe(
			"Your expected balance drops to -$120.45 today. Open kriket to see what's coming."
		);
		expect(dip('2026-10-02')).toContain('-$120.45 tomorrow.');
		expect(dip('2026-10-04')).toContain('-$120.45 on Sun, Oct 4.');
		expect(describeDip({ date: '2026-10-04', balanceCents: -1 }, '2026-10-01').url).toBe('/app');
	});
});

describe('inAlertHours', () => {
	it('is 9:00 to 20:59 Saskatoon time', () => {
		expect(inAlertHours(new Date('2026-10-01T14:59:00Z'))).toBe(false);
		expect(inAlertHours(new Date('2026-10-01T15:00:00Z'))).toBe(true);
		expect(inAlertHours(new Date('2026-10-02T02:59:00Z'))).toBe(true);
		expect(inAlertHours(new Date('2026-10-02T03:00:00Z'))).toBe(false);
	});
});

const endpointOf = (email: string) => `https://fcm.googleapis.com/fcm/send/${email}`;

type Person = { a: TestAgent; uid: string };

async function addBill(a: TestAgent, name: string, cents: number, firstDate: string) {
	const res = await a.post('/api/expense-streams').send({
		name,
		minCents: cents,
		actualCents: cents,
		maxCents: cents,
		intervalDays: 30,
		firstDate
	});
	expect(res.status).toBe(201);
}

describe('sweepForecastAlerts', () => {
	let send: MockInstance<typeof webPush.sendNotification>;

	/** A signed-up user with a check-in (unless balanceCents is null), bills, and a device. */
	async function makeUser(
		email: string,
		balanceCents: number | null,
		bills: { cents: number; firstDate: string }[],
		{ subscribe = true, checkedOn = '2026-10-01' } = {}
	): Promise<Person> {
		const a = testAgent();
		await signUp(a, email);
		const uid = (await a.get('/api/me')).body.user.id as string;
		// Check-ins through the API are always dated today, so the tests write them directly.
		if (balanceCents !== null) await upsertCheckin(uid, balanceCents, checkedOn);
		for (const [i, bill] of bills.entries())
			await addBill(a, `Bill ${i}`, bill.cents, bill.firstDate);
		if (subscribe) {
			const res = await a.post('/api/push/subscriptions').send({
				endpoint: endpointOf(email),
				keys: { p256dh: 'p256dh-test-key', auth: 'auth-test-key' }
			});
			expect(res.status).toBe(201);
		}
		return { a, uid };
	}

	const sentTo = () => send.mock.calls.map(([sub]) => sub.endpoint);
	const bodies = () => send.mock.calls.map(([, payload]) => JSON.parse(String(payload)).body);

	beforeEach(() => {
		const keys = webPush.generateVAPIDKeys();
		process.env.VAPID_PUBLIC_KEY = keys.publicKey;
		process.env.VAPID_PRIVATE_KEY = keys.privateKey;
		send = vi
			.spyOn(webPush, 'sendNotification')
			.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.VAPID_PUBLIC_KEY;
		delete process.env.VAPID_PRIVATE_KEY;
	});

	it('alerts subscribed users whose balance is about to dip, once per dip', async () => {
		await makeUser('dips@example.com', 10000, [{ cents: 15000, firstDate: '2026-10-04' }]);
		await makeUser('fine@example.com', 100000, [{ cents: 15000, firstDate: '2026-10-04' }]);
		await makeUser('unsubscribed@example.com', 0, [{ cents: 15000, firstDate: '2026-10-02' }], {
			subscribe: false
		});

		expect(await sweepForecastAlerts('2026-10-01')).toEqual({ checked: 2, alerted: 1, failed: 0 });
		expect(sentTo()).toEqual([endpointOf('dips@example.com')]);
		expect(bodies()[0]).toBe(
			"Your expected balance drops to -$50.00 on Sun, Oct 4. Open kriket to see what's coming."
		);
		const [, , options] = send.mock.calls[0];
		expect(options).toMatchObject({ topic: 'forecast-dip', TTL: 12 * 60 * 60 });

		// Later sweeps the same day, and the next day, stay quiet about the same dip.
		expect((await sweepForecastAlerts('2026-10-01')).alerted).toBe(0);
		expect((await sweepForecastAlerts('2026-10-02')).alerted).toBe(0);
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('alerts again for a new dip on a later day, but not twice in one day', async () => {
		const { a, uid } = await makeUser('moves@example.com', 10000, [
			{ cents: 15000, firstDate: '2026-10-04' }
		]);
		expect((await sweepForecastAlerts('2026-10-01')).alerted).toBe(1);

		// A bigger check-in covers the first bill, and a new bill makes a later dip.
		await upsertCheckin(uid, 20000, '2026-10-01');
		await addBill(a, 'Car', 10000, '2026-10-06');
		expect((await sweepForecastAlerts('2026-10-01')).alerted).toBe(0);
		expect((await sweepForecastAlerts('2026-10-02')).alerted).toBe(1);
		expect(bodies()[1]).toContain('-$50.00 on Tue, Oct 6.');
	});

	it('does not alert for a dip that started before today', async () => {
		await makeUser('already@example.com', 10000, [{ cents: 15000, firstDate: '2026-10-02' }]);
		expect((await sweepForecastAlerts('2026-10-03')).alerted).toBe(0);
		expect(send).not.toHaveBeenCalled();
	});

	it('skips users who have not checked in', async () => {
		// With no check-in the forecast assumes a zero balance, so any bill would look like a dip.
		await makeUser('new@example.com', null, [{ cents: 15000, firstDate: '2026-10-02' }]);
		expect(await sweepForecastAlerts('2026-10-01')).toEqual({ checked: 1, alerted: 0, failed: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	it('tries again next sweep when no device received the alert', async () => {
		await makeUser('offline@example.com', 10000, [{ cents: 15000, firstDate: '2026-10-04' }]);
		send.mockRejectedValueOnce(Object.assign(new Error('Server error'), { statusCode: 500 }));
		expect(await sweepForecastAlerts('2026-10-01')).toEqual({ checked: 1, alerted: 0, failed: 0 });
		expect(await sweepForecastAlerts('2026-10-01')).toEqual({ checked: 1, alerted: 1, failed: 0 });
	});

	it('stays quiet for a user who checks in a negative balance each morning', async () => {
		const { uid } = await makeUser('overdrawn@example.com', -12000, []);
		expect((await sweepForecastAlerts('2026-10-01')).alerted).toBe(0);
		await upsertCheckin(uid, -11000, '2026-10-02');
		expect((await sweepForecastAlerts('2026-10-02')).alerted).toBe(0);
		expect(send).not.toHaveBeenCalled();
	});

	it('gives up for the day after three alerts no device received', async () => {
		await makeUser('failing@example.com', 10000, [{ cents: 15000, firstDate: '2026-10-04' }]);
		send.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));
		for (let i = 0; i < 5; i += 1) await sweepForecastAlerts('2026-10-01');
		expect(send).toHaveBeenCalledTimes(3);

		send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
		expect((await sweepForecastAlerts('2026-10-02')).alerted).toBe(1);
	});

	it('skips check-ins more than a year old', async () => {
		// Checked in on Oct 1 this would dip on Oct 4 (the first test); from 2025 it is too stale.
		await makeUser('stale@example.com', 10000, [{ cents: 15000, firstDate: '2026-10-04' }], {
			checkedOn: '2025-09-01'
		});
		expect(await sweepForecastAlerts('2026-10-01')).toEqual({ checked: 1, alerted: 0, failed: 0 });
		expect(send).not.toHaveBeenCalled();
	});

	it('does nothing while push is off', async () => {
		await makeUser('off@example.com', 10000, [{ cents: 15000, firstDate: '2026-10-04' }]);
		delete process.env.VAPID_PUBLIC_KEY;
		expect(await sweepForecastAlerts('2026-10-01')).toEqual({ checked: 0, alerted: 0, failed: 0 });
		expect(send).not.toHaveBeenCalled();
	});
});
