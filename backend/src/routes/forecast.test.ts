import { describe, expect, it } from 'vitest';
import { signUp, testAgent } from '../../tests/helpers.js';

describe('/api/forecast', () => {
	it('projects the stored settings and streams', async () => {
		const a = testAgent();
		await signUp(a, 'forecast1@example.com');
		await a.put('/api/settings').send({ startingBalanceCents: 10000, startingDate: '2026-09-26' });
		await a.post('/api/income-streams').send({
			name: 'Pay',
			minCents: 80000,
			actualCents: 100000,
			maxCents: 120000,
			intervalDays: 30,
			firstDate: '2026-09-26'
		});
		await a.post('/api/expense-streams').send({
			name: 'Rent',
			minCents: 50000,
			actualCents: 50000,
			maxCents: 50000,
			intervalDays: 30,
			firstDate: '2026-10-01'
		});
		const res = await a.get('/api/forecast?days=30');
		expect(res.status).toBe(200);
		expect(res.body.points).toHaveLength(31);
		expect(res.body.endBalance).toEqual({
			minCents: 10000 + 2 * 80000 - 50000,
			actualCents: 10000 + 2 * 100000 - 50000,
			maxCents: 10000 + 2 * 120000 - 50000
		});
		expect(res.body.events).toHaveLength(3);
	});
	it('validates days', async () => {
		const a = testAgent();
		await signUp(a, 'forecast2@example.com');
		expect((await a.get('/api/forecast?days=1')).status).toBe(400);
	});
});
