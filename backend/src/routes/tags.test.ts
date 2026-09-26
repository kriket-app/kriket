import { describe, expect, it } from 'vitest';
import { signUp, testAgent, testApp } from '../../tests/helpers.js';

describe('/api/tags', () => {
	it('rejects signed-out callers', async () => {
		expect((await testApp().get('/api/tags')).status).toBe(401);
	});
	it('seeds eight presets on the first list, then keeps them', async () => {
		const a = testAgent();
		await signUp(a, 'tags1@example.com');
		const first = await a.get('/api/tags');
		expect(first.status).toBe(200);
		expect(first.body.tags).toHaveLength(8);
		expect(first.body.tags.every((t: { isPreset: boolean }) => t.isPreset)).toBe(true);
		expect((await a.get('/api/tags')).body.tags).toHaveLength(8);
	});
	it('creates, renames, and deletes a tag, and hides it from other users', async () => {
		const a = testAgent();
		await signUp(a, 'tags2@example.com');
		const created = await a.post('/api/tags').send({ name: 'Cat', color: '#16a34a' });
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({ name: 'Cat', color: '#16a34a', isPreset: false });
		const renamed = await a.patch(`/api/tags/${created.body.id}`).send({ name: 'Cats' });
		expect(renamed.body.name).toBe('Cats');
		const b = testAgent();
		await signUp(b, 'tags3@example.com');
		expect((await b.patch(`/api/tags/${created.body.id}`).send({ name: 'Mine' })).status).toBe(404);
		expect((await b.get('/api/tags')).body.tags.map((t: { name: string }) => t.name)).not.toContain(
			'Cats'
		);
		expect((await a.delete(`/api/tags/${created.body.id}`)).status).toBe(204);
		expect((await a.delete(`/api/tags/${created.body.id}`)).status).toBe(404);
	});
	it('validates the body', async () => {
		const a = testAgent();
		await signUp(a, 'tags4@example.com');
		const res = await a.post('/api/tags').send({ name: '', color: 'green' });
		expect(res.status).toBe(400);
		expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
			expect.arrayContaining(['name', 'color'])
		);
	});
});
