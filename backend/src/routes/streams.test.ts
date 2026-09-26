import { describe, expect, it } from 'vitest';
import { signUp, testAgent } from '../../tests/helpers.js';

const body = {
	name: 'Shifts',
	minCents: 80000,
	actualCents: 100000,
	maxCents: 120000,
	intervalDays: 14,
	firstDate: '2026-10-01'
};

describe.each(['income', 'expense'] as const)('/api/%s-streams', (kind) => {
	const base = `/api/${kind}-streams`;
	it('creates, lists, updates, and deletes', async () => {
		const a = testAgent();
		await signUp(a, `${kind}1@example.com`);
		const created = await a.post(base).send(body);
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({ ...body, tagId: null });
		expect((await a.get(base)).body.streams).toHaveLength(1);
		const updated = await a.patch(`${base}/${created.body.id}`).send({ actualCents: 110000 });
		expect(updated.body.actualCents).toBe(110000);
		expect((await a.delete(`${base}/${created.body.id}`)).status).toBe(204);
		expect((await a.get(base)).body.streams).toHaveLength(0);
	});
	it('refuses amounts out of order on create and after a partial update', async () => {
		const a = testAgent();
		await signUp(a, `${kind}2@example.com`);
		const bad = await a.post(base).send({ ...body, actualCents: 70000 });
		expect(bad.status).toBe(400);
		expect(bad.body.error.details[0].path).toBe('actualCents');
		const ok = await a.post(base).send(body);
		const worse = await a.patch(`${base}/${ok.body.id}`).send({ maxCents: 90000 });
		expect(worse.status).toBe(400);
		expect(worse.body.error.details[0].path).toBe('maxCents');
		expect((await a.get(`${base}`)).body.streams[0].maxCents).toBe(120000);
	});
	it('rejects a calendar-invalid firstDate', async () => {
		const a = testAgent();
		await signUp(a, `${kind}5@example.com`);
		const res = await a.post(base).send({ ...body, firstDate: '2026-02-30' });
		expect(res.status).toBe(400);
		expect(res.body.error.details[0].path).toBe('firstDate');
	});
	it('only accepts the caller’s own tag and nulls it when the tag is deleted', async () => {
		const a = testAgent();
		await signUp(a, `${kind}3@example.com`);
		const tag = (await a.post('/api/tags').send({ name: 'T' })).body;
		const b = testAgent();
		await signUp(b, `${kind}4@example.com`);
		expect((await b.post(base).send({ ...body, tagId: tag.id })).status).toBe(400);
		const mine = await a.post(base).send({ ...body, tagId: tag.id });
		expect(mine.body.tagId).toBe(tag.id);
		await a.delete(`/api/tags/${tag.id}`);
		expect((await a.get(base)).body.streams[0].tagId).toBeNull();
	});
});
