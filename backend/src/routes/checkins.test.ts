import { describe, expect, it } from 'vitest';
import { db } from '../db/index.js';
import { balanceCheckins } from '../db/tables.js';
import { addDays, today } from '../services/dates.js';
import { signUp, testAgent, testApp } from '../../tests/helpers.js';

describe('/api/checkins', () => {
	it('401 signed out', async () => {
		expect((await testApp().get('/api/checkins')).status).toBe(401);
	});
	it('posting twice on one day keeps a single row with the second amount', async () => {
		const a = testAgent();
		await signUp(a, 'checkins1@example.com');
		const first = await a.post('/api/checkins').send({ balanceCents: 10000 });
		expect(first.status).toBe(201);
		expect(first.body.checkedOn).toBe(today());
		const second = await a.post('/api/checkins').send({ balanceCents: 12000 });
		expect(second.status).toBe(201);
		const list = await a.get('/api/checkins');
		expect(list.body.checkins).toHaveLength(1);
		expect(list.body.checkins[0].balanceCents).toBe(12000);
	});
	it('lists newest first', async () => {
		const a = testAgent();
		await signUp(a, 'checkins2@example.com');
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		const older = addDays(today(), -3);
		await db.insert(balanceCheckins).values({ userId: uid, balanceCents: 5000, checkedOn: older });
		await a.post('/api/checkins').send({ balanceCents: 9000 });
		const list = await a.get('/api/checkins');
		expect(list.body.checkins.map((c: { checkedOn: string }) => c.checkedOn)).toEqual([
			today(),
			older
		]);
	});
	it('computes expectedCents and differenceCents from the streams between two check-ins', async () => {
		const a = testAgent();
		await signUp(a, 'checkins3@example.com');
		const meRes = await a.get('/api/me');
		const uid = meRes.body.user.id as string;
		const older = addDays(today(), -6);
		await db.insert(balanceCheckins).values({ userId: uid, balanceCents: 10000, checkedOn: older });
		await a.post('/api/income-streams').send({
			name: 'Pay',
			minCents: 50000,
			actualCents: 50000,
			maxCents: 50000,
			intervalDays: 3,
			firstDate: addDays(older, 1)
		});
		await a.post('/api/expense-streams').send({
			name: 'Rent',
			minCents: 20000,
			actualCents: 20000,
			maxCents: 20000,
			intervalDays: 6,
			firstDate: addDays(older, 6)
		});
		// Pay fires on older+1, older+4 (both <= today = older+6); Rent fires on older+6 (= today).
		const created = await a.post('/api/checkins').send({ balanceCents: 130000 });
		expect(created.body.expectedCents).toBe(10000 + 2 * 50000 - 20000);
		expect(created.body.differenceCents).toBe(130000 - (10000 + 2 * 50000 - 20000));
		const list = await a.get('/api/checkins');
		const first = list.body.checkins.find((c: { checkedOn: string }) => c.checkedOn === older);
		expect(first.expectedCents).toBeNull();
		expect(first.differenceCents).toBeNull();
	});
	it('never shows user B another user’s check-ins', async () => {
		const a = testAgent();
		await signUp(a, 'checkins4a@example.com');
		await a.post('/api/checkins').send({ balanceCents: 5000 });
		const b = testAgent();
		await signUp(b, 'checkins4b@example.com');
		expect((await b.get('/api/checkins')).body.checkins).toHaveLength(0);
	});
});
