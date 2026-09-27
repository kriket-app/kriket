import { describe, expect, it } from 'vitest';
import { db } from '../db/index.js';
import { goals } from '../db/tables.js';
import { addDays, monthsBetween, today } from '../services/dates.js';
import { goalStatus } from '../services/goals.js';
import { signUp, testAgent, testApp } from '../../tests/helpers.js';

describe('monthsBetween', () => {
	it('is at least 1 within the same month', () => {
		expect(monthsBetween('2026-09-01', '2026-09-01')).toBe(1);
		expect(monthsBetween('2026-09-27', '2026-09-28')).toBe(1);
	});
	it('counts calendar months', () => {
		expect(monthsBetween('2026-09-15', '2026-10-15')).toBe(1);
		expect(monthsBetween('2026-09-15', '2026-10-14')).toBe(1);
		expect(monthsBetween('2026-09-15', '2026-11-15')).toBe(2);
	});
	it('counts month ends as whole months', () => {
		expect(monthsBetween('2026-03-31', '2026-06-30')).toBe(3);
		expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(1);
		expect(monthsBetween('2026-01-30', '2026-02-28')).toBe(1);
		expect(monthsBetween('2026-08-30', '2027-02-28')).toBe(6);
		expect(monthsBetween('2026-12-30', '2027-02-28')).toBe(2);
	});
});

describe('goalStatus', () => {
	const points = (dates: string[]) =>
		dates.map((date) => ({ date, minCents: 1, actualCents: 2, maxCents: 3 }));
	it('is past before today with nulls', () => {
		const s = goalStatus(addDays(today(), -1), points([today()]), today(), 100);
		expect(s.state).toBe('past');
		expect(s.expectedCents).toBeNull();
	});
	it('is beyond past the forecast limit with nulls', () => {
		const s = goalStatus(addDays(today(), 367), points([]), today(), 100);
		expect(s.state).toBe('beyond');
		expect(s.monthlyNeededCents).toBeNull();
	});
	it('reads the point on the target date', () => {
		const target = addDays(today(), 10);
		const s = goalStatus(
			target,
			[
				{ date: today(), minCents: 0, actualCents: 0, maxCents: 0 },
				{ date: target, minCents: 60000, actualCents: 80000, maxCents: 100000 }
			],
			today(),
			100000
		);
		expect(s.state).toBe('forecast');
		expect(s.expectedCents).toBe(80000);
		expect(s.worstCents).toBe(60000);
		expect(s.bestCents).toBe(100000);
		expect(s.monthlyNeededCents).toBe(Math.max(0, Math.ceil((100000 - 80000) / 1)));
	});
});

describe('/api/goals', () => {
	const body = (targetDate: string) => ({
		name: 'Trip home',
		amountCents: 100000,
		targetDate
	});
	it('401 signed out on all routes', async () => {
		expect((await testApp().get('/api/goals')).status).toBe(401);
		expect((await testApp().post('/api/goals').send(body(today()))).status).toBe(401);
		expect((await testApp().get('/api/goals/00000000-0000-4000-8000-000000000000')).status).toBe(
			401
		);
		expect(
			(await testApp().patch('/api/goals/00000000-0000-4000-8000-000000000000').send({})).status
		).toBe(401);
		expect((await testApp().delete('/api/goals/00000000-0000-4000-8000-000000000000')).status).toBe(
			401
		);
	});
	it('creates, gets, lists sorted closest-first, updates, deletes', async () => {
		const a = testAgent();
		await signUp(a, 'goals1@example.com');
		const far = await a.post('/api/goals').send(body(addDays(today(), 60)));
		expect(far.status).toBe(201);
		const near = await a.post('/api/goals').send({ ...body(addDays(today(), 10)), name: 'Near' });
		expect(near.status).toBe(201);
		const list = await a.get('/api/goals');
		expect(list.status).toBe(200);
		expect(list.body.today).toBe(today());
		expect(list.body.goals.map((g: { name: string }) => g.name)).toEqual(['Near', 'Trip home']);
		const get = await a.get(`/api/goals/${near.body.id}`);
		expect(get.status).toBe(200);
		expect(get.body.name).toBe('Near');
		const patched = await a.patch(`/api/goals/${near.body.id}`).send({ amountCents: 50000 });
		expect(patched.status).toBe(200);
		expect(patched.body.amountCents).toBe(50000);
		const empty = await a.patch(`/api/goals/${near.body.id}`).send({});
		expect(empty.status).toBe(200);
		expect(empty.body.amountCents).toBe(50000);
		expect((await a.delete(`/api/goals/${near.body.id}`)).status).toBe(204);
		expect((await a.get(`/api/goals/${near.body.id}`)).status).toBe(404);
	});
	it('rejects past dates, blank names, zero amounts, bad ids', async () => {
		const a = testAgent();
		await signUp(a, 'goals2@example.com');
		const past = await a.post('/api/goals').send(body(addDays(today(), -1)));
		expect(past.status).toBe(400);
		expect(past.body.error.details[0].path).toBe('targetDate');
		expect(
			(await a.post('/api/goals').send({ ...body(addDays(today(), 5)), name: '  ' })).status
		).toBe(400);
		expect(
			(await a.post('/api/goals').send({ ...body(addDays(today(), 5)), amountCents: 0 })).status
		).toBe(400);
		expect((await a.get('/api/goals/not-a-uuid')).status).toBe(400);
		const created = await a.post('/api/goals').send(body(addDays(today(), 5)));
		const id = created.body.id as string;
		expect(
			(await a.patch(`/api/goals/${id}`).send({ targetDate: addDays(today(), -1) })).status
		).toBe(400);
	});
	it('never shows user B another user’s goals', async () => {
		const a = testAgent();
		await signUp(a, 'goals3a@example.com');
		const created = await a.post('/api/goals').send(body(addDays(today(), 5)));
		const b = testAgent();
		await signUp(b, 'goals3b@example.com');
		expect((await b.get('/api/goals')).body.goals).toHaveLength(0);
		expect((await b.get(`/api/goals/${created.body.id}`)).status).toBe(404);
		expect((await b.patch(`/api/goals/${created.body.id}`).send({ name: 'X' })).status).toBe(404);
		expect((await b.delete(`/api/goals/${created.body.id}`)).status).toBe(404);
	});
	it('computes forecast status from streams', async () => {
		const a = testAgent();
		await signUp(a, 'goals4@example.com');
		await a.post('/api/checkins').send({ balanceCents: 20000 });
		await a.post('/api/income-streams').send({
			name: 'Shifts',
			minCents: 10000,
			actualCents: 15000,
			maxCents: 20000,
			intervalDays: 7,
			firstDate: addDays(today(), 1)
		});
		const target = addDays(today(), 28);
		const created = await a
			.post('/api/goals')
			.send({ name: 'Trip', amountCents: 100000, targetDate: target });
		expect(created.status).toBe(201);
		const forecast = await a.get('/api/forecast?days=28');
		const point = forecast.body.points.find((p: { date: string }) => p.date === target);
		expect(created.body.status.state).toBe('forecast');
		expect(created.body.status.expectedCents).toBe(point.actualCents);
		expect(created.body.status.worstCents).toBe(point.minCents);
		expect(created.body.status.bestCents).toBe(point.maxCents);
	});
	it('marks far goals beyond', async () => {
		const a = testAgent();
		await signUp(a, 'goals5@example.com');
		const created = await a.post('/api/goals').send(body(addDays(today(), 400)));
		expect(created.status).toBe(201);
		expect(created.body.status.state).toBe('beyond');
		expect(created.body.status.expectedCents).toBeNull();
	});
	it('lists upcoming closest-first with past goals last', async () => {
		const a = testAgent();
		await signUp(a, 'goals6@example.com');
		await a.post('/api/goals').send({ ...body(addDays(today(), 60)), name: 'Far' });
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		await db.insert(goals).values({
			userId: uid,
			name: 'Old',
			description: null,
			amountCents: 10000,
			targetDate: addDays(today(), -5)
		});
		await a.post('/api/goals').send({ ...body(addDays(today(), 10)), name: 'Near' });
		const list = await a.get('/api/goals');
		expect(list.body.goals.map((g: { name: string }) => g.name)).toEqual(['Near', 'Far', 'Old']);
		expect(list.body.goals[2].status.state).toBe('past');
	});
	it('lets a past goal be renamed without moving its date', async () => {
		const a = testAgent();
		await signUp(a, 'goals7@example.com');
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		const [row] = await db
			.insert(goals)
			.values({
				userId: uid,
				name: 'Old',
				description: null,
				amountCents: 10000,
				targetDate: addDays(today(), -5)
			})
			.returning();
		const renamed = await a
			.patch(`/api/goals/${row.id}`)
			.send({ name: 'Older', targetDate: addDays(today(), -5) });
		expect(renamed.status).toBe(200);
		expect(renamed.body.name).toBe('Older');
		expect(renamed.body.status.state).toBe('past');
		expect(
			(await a.patch(`/api/goals/${row.id}`).send({ targetDate: addDays(today(), -3) })).status
		).toBe(400);
	});
});
