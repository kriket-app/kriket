import { describe, expect, it } from 'vitest';
import { db } from '../db/index.js';
import { balanceCheckins } from '../db/tables.js';
import { addDays, today } from '../services/dates.js';
import { signUp, testAgent } from '../../tests/helpers.js';

describe('/api/coming-up', () => {
	it('defaults to the current month', async () => {
		const a = testAgent();
		await signUp(a, 'comingup1@example.com');
		const res = await a.get('/api/coming-up');
		expect(res.status).toBe(200);
		expect(res.body.month).toBe(today().slice(0, 7));
		expect(res.body.today).toBe(today());
	});
	it('rejects a month before the first check-in’s month', async () => {
		const a = testAgent();
		await signUp(a, 'comingup2@example.com');
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		await db.insert(balanceCheckins).values({
			userId: uid,
			balanceCents: 1000,
			checkedOn: today()
		});
		const before = addDays(today(), -400).slice(0, 7);
		const res = await a.get(`/api/coming-up?month=${before}`);
		expect(res.status).toBe(400);
		expect(res.body.error.details[0].path).toBe('month');
	});
	it('rejects a malformed month', async () => {
		const a = testAgent();
		await signUp(a, 'comingup3@example.com');
		expect((await a.get('/api/coming-up?month=2026-13')).status).toBe(400);
	});
	it('flags past days and only sums inCents/outCents from today onward', async () => {
		const a = testAgent();
		await signUp(a, 'comingup4@example.com');
		await a.post('/api/checkins').send({ balanceCents: 10000 });
		const yesterday = addDays(today(), -1);
		await a.post('/api/income-streams').send({
			name: 'Pay',
			minCents: 50000,
			actualCents: 50000,
			maxCents: 50000,
			intervalDays: 1,
			firstDate: yesterday
		});
		const res = await a.get('/api/coming-up');
		expect(res.status).toBe(200);
		const past = res.body.days.find((d: { date: string }) => d.date === yesterday);
		const now = res.body.days.find((d: { date: string }) => d.date === today());
		expect(past.past).toBe(true);
		expect(now.past).toBe(false);
		// Pay fires every day; only today onward counts toward inCents.
		expect(res.body.inCents).toBeGreaterThanOrEqual(50000);
		expect(res.body.outCents).toBe(0);
	});
	it('gives endBalanceCents null for a month entirely in the past', async () => {
		const a = testAgent();
		await signUp(a, 'comingup5@example.com');
		const old = addDays(today(), -400);
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		await db.insert(balanceCheckins).values({ userId: uid, balanceCents: 1000, checkedOn: old });
		const res = await a.get(`/api/coming-up?month=${old.slice(0, 7)}`);
		expect(res.status).toBe(200);
		expect(res.body.endBalanceCents).toBeNull();
	});
});
