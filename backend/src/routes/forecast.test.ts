import { describe, expect, it } from 'vitest';
import { db } from '../db/index.js';
import { balanceCheckins } from '../db/tables.js';
import { addDays, today } from '../services/dates.js';
import { signUp, testAgent } from '../../tests/helpers.js';

describe('/api/forecast', () => {
	it('projects the latest check-in and streams', async () => {
		const a = testAgent();
		await signUp(a, 'forecast1@example.com');
		await a.post('/api/checkins').send({ balanceCents: 10000 });
		await a.post('/api/income-streams').send({
			name: 'Pay',
			minCents: 80000,
			actualCents: 100000,
			maxCents: 120000,
			intervalDays: 30,
			firstDate: today()
		});
		await a.post('/api/expense-streams').send({
			name: 'Rent',
			minCents: 50000,
			actualCents: 50000,
			maxCents: 50000,
			intervalDays: 30,
			firstDate: addDays(today(), 5)
		});
		const res = await a.get('/api/forecast?days=30');
		expect(res.status).toBe(200);
		expect(res.body.points).toHaveLength(31);
		// Pay's first occurrence lands on the check-in day itself, so it's already folded into the
		// check-in balance and doesn't repeat as an event; only its day+30 occurrence appears.
		expect(res.body.endBalance).toEqual({
			minCents: 10000 + 80000 - 50000,
			actualCents: 10000 + 100000 - 50000,
			maxCents: 10000 + 120000 - 50000
		});
		expect(res.body.events).toHaveLength(2);
	});
	it('validates days', async () => {
		const a = testAgent();
		await signUp(a, 'forecast2@example.com');
		expect((await a.get('/api/forecast?days=1')).status).toBe(400);
	});
	it('defaults to a zero balance from today with no check-in', async () => {
		const a = testAgent();
		await signUp(a, 'forecast3@example.com');
		const res = await a.get('/api/forecast?days=7');
		expect(res.status).toBe(200);
		expect(res.body.startDate).toBe(today());
		expect(res.body.startingBalanceCents).toBe(0);
		expect(res.body.checkin).toBeNull();
	});
	it('rolls a check-in in the past forward to today, keeping events in between', async () => {
		const a = testAgent();
		await signUp(a, 'forecast4@example.com');
		// Insert an old check-in directly (the API always writes today's date).
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		const past = addDays(today(), -5);
		await db.insert(balanceCheckins).values({ userId: uid, balanceCents: 20000, checkedOn: past });
		await a.post('/api/income-streams').send({
			name: 'Pay',
			minCents: 50000,
			actualCents: 50000,
			maxCents: 50000,
			intervalDays: 3,
			firstDate: past
		});
		const res = await a.get('/api/forecast?days=7');
		expect(res.status).toBe(200);
		expect(res.body.startDate).toBe(today());
		expect(res.body.checkin.checkedOn).toBe(past);
		// Pay lands on the check-in day itself (already folded in), then past+3 (= today-2), then
		// today+1, today+4, today+7: everything before today is trimmed away.
		expect(res.body.events.every((e: { date: string }) => e.date >= today())).toBe(true);
		// The balance rolled forward already includes the one payment (past+3, i.e. today-2) that
		// fell between the check-in and today.
		expect(res.body.points[0].actualCents).toBe(20000 + 50000);
	});
	it('an explicit checkinId of an older check-in starts the forecast on that date, untrimmed', async () => {
		const a = testAgent();
		await signUp(a, 'forecast5@example.com');
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		const past = addDays(today(), -10);
		const [row] = await db
			.insert(balanceCheckins)
			.values({ userId: uid, balanceCents: 15000, checkedOn: past })
			.returning();
		await a.post('/api/checkins').send({ balanceCents: 20000 });
		const res = await a.get(`/api/forecast?days=7&checkinId=${row.id}`);
		expect(res.status).toBe(200);
		expect(res.body.startDate).toBe(past);
		expect(res.body.endDate).toBe(addDays(past, 7));
		expect(res.body.checkin).toMatchObject({ id: row.id, balanceCents: 15000, checkedOn: past });
	});
	it('404s on another user’s checkinId', async () => {
		const a = testAgent();
		await signUp(a, 'forecast6a@example.com');
		const created = await a.post('/api/checkins').send({ balanceCents: 20000 });
		const b = testAgent();
		await signUp(b, 'forecast6b@example.com');
		const res = await b.get(`/api/forecast?checkinId=${created.body.id}`);
		expect(res.status).toBe(404);
	});
	it('401 signed out', async () => {
		const { testApp } = await import('../../tests/helpers.js');
		expect((await testApp().get('/api/forecast')).status).toBe(401);
	});
	it('the Sam story: lowest -25500 on today+5, recovers on today+14', async () => {
		const a = testAgent();
		await signUp(a, 'forecast-sam@example.com');
		await a.post('/api/checkins').send({ balanceCents: 43000 });
		await a.post('/api/income-streams').send({
			name: 'Café shifts',
			minCents: 15000,
			actualCents: 22000,
			maxCents: 30000,
			intervalDays: 7,
			firstDate: addDays(today(), 7)
		});
		await a.post('/api/income-streams').send({
			name: 'Tutoring',
			minCents: 8000,
			actualCents: 12000,
			maxCents: 16000,
			intervalDays: 14,
			firstDate: addDays(today(), 12)
		});
		await a.post('/api/expense-streams').send({
			name: 'Rent',
			minCents: 60000,
			actualCents: 60000,
			maxCents: 60000,
			intervalDays: 30,
			firstDate: addDays(today(), 5)
		});
		await a.post('/api/expense-streams').send({
			name: 'Groceries',
			minCents: 6000,
			actualCents: 8500,
			maxCents: 12000,
			intervalDays: 7,
			firstDate: addDays(today(), 3)
		});
		await a.post('/api/expense-streams').send({
			name: 'Phone',
			minCents: 4200,
			actualCents: 4200,
			maxCents: 4200,
			intervalDays: 30,
			firstDate: addDays(today(), 10)
		});
		const res = await a.get('/api/forecast?days=30');
		expect(res.status).toBe(200);
		expect(res.body.lowest).toEqual({ date: addDays(today(), 5), cents: -25500 });
		// Still under on today+7 (−$35) and today+12 (−$42); first back above zero on today+14,
		// and no second dip before the next rent on today+35, outside these 30 days.
		expect(res.body.recoversOn).toBe(addDays(today(), 14));
	});
});
