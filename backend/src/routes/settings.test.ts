import { describe, expect, it } from 'vitest';
import { today } from '../services/dates.js';
import { signUp, testAgent } from '../../tests/helpers.js';

describe('/api/settings', () => {
	it('defaults to zero and today, then stores what was put', async () => {
		const a = testAgent();
		await signUp(a, 'settings1@example.com');
		const def = await a.get('/api/settings');
		expect(def.body.startingBalanceCents).toBe(0);
		expect(def.body.startingDate).toBe(today());
		const put = await a
			.put('/api/settings')
			.send({ startingBalanceCents: -2500, startingDate: '2026-09-26' });
		expect(put.status).toBe(200);
		expect((await a.get('/api/settings')).body).toEqual({
			startingBalanceCents: -2500,
			startingDate: '2026-09-26'
		});
	});
});
