import { describe, expect, it } from 'vitest';
import { db } from '../db/index.js';
import { balanceCheckins } from '../db/tables.js';
import { addDays, daysBetween, monthEnd, today } from '../services/dates.js';
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
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		// Dated yesterday (not today, through the API) so the check-in never lands in today's
		// month-boundary edge case and so today itself is not yet "settled" by it.
		const yesterday = addDays(today(), -1);
		await db
			.insert(balanceCheckins)
			.values({ userId: uid, balanceCents: 10000, checkedOn: yesterday });
		await a.post('/api/income-streams').send({
			name: 'Pay',
			minCents: 50000,
			actualCents: 50000,
			maxCents: 50000,
			intervalDays: 1,
			firstDate: yesterday
		});
		// Yesterday can fall in a different month than today (e.g. on the 1st), so look it up in
		// its own month rather than assuming it's in the default month's day list.
		const yesterdayRes = await a.get(`/api/coming-up?month=${yesterday.slice(0, 7)}`);
		expect(yesterdayRes.status).toBe(200);
		const past = yesterdayRes.body.days.find((d: { date: string }) => d.date === yesterday);
		expect(past.past).toBe(true);

		const res = await a.get('/api/coming-up');
		expect(res.status).toBe(200);
		const now = res.body.days.find((d: { date: string }) => d.date === today());
		expect(now.past).toBe(false);
		// Pay fires every day from today through the end of the month.
		const monthEndDate = monthEnd(today().slice(0, 7));
		const daysToMonthEnd = daysBetween(today(), monthEndDate) + 1;
		expect(res.body.inCents).toBe(50000 * daysToMonthEnd);
		expect(res.body.outCents).toBe(0);
	});
	it('a check-in dated today already settles today’s payments, so they are past and excluded', async () => {
		const a = testAgent();
		await signUp(a, 'comingup6@example.com');
		await a.post('/api/checkins').send({ balanceCents: 33000 });
		await a.post('/api/income-streams').send({
			name: 'Pay',
			minCents: 50000,
			actualCents: 50000,
			maxCents: 50000,
			intervalDays: 30,
			firstDate: today()
		});
		await a.post('/api/expense-streams').send({
			name: 'Rent',
			minCents: 60000,
			actualCents: 60000,
			maxCents: 60000,
			intervalDays: 30,
			firstDate: today()
		});
		const res = await a.get('/api/coming-up');
		expect(res.status).toBe(200);
		const now = res.body.days.find((d: { date: string }) => d.date === today());
		expect(now.past).toBe(true);
		expect(res.body.inCents).toBe(0);
		expect(res.body.outCents).toBe(0);

		const monthEndDate = monthEnd(today().slice(0, 7));
		const forecastDays = Math.max(7, daysBetween(today(), monthEndDate));
		const forecastRes = await a.get(`/api/forecast?days=${forecastDays}`);
		expect(forecastRes.status).toBe(200);
		const point = forecastRes.body.points.find((p: { date: string }) => p.date === monthEndDate);
		expect(res.body.endBalanceCents).toBe(point.actualCents);
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
