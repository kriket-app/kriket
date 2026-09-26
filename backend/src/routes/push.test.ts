import { beforeAll, describe, expect, it } from 'vitest';
import webPush from 'web-push';
import { signUp, testAgent } from '../../tests/helpers.js';

const subscription = (endpoint: string) => ({
	endpoint,
	keys: { p256dh: 'p256dh-test-key', auth: 'auth-test-key' },
	userAgent: 'test-agent'
});

describe('/api/push', () => {
	it('rejects signed-out visitors', async () => {
		const a = testAgent();
		expect((await a.get('/api/push/config')).status).toBe(401);
		expect((await a.get('/api/push/subscriptions')).status).toBe(401);
	});

	it('reports disabled config without VAPID keys and refuses subscribing', async () => {
		const a = testAgent();
		await signUp(a, 'push1@example.com');
		const config = await a.get('/api/push/config');
		expect(config.status).toBe(200);
		expect(config.body).toEqual({ publicKey: '', enabled: false });
		const sub = await a
			.post('/api/push/subscriptions')
			.send(subscription('https://push.example.com/device-1'));
		expect(sub.status).toBe(503);
	});

	it('subscribes, lists, and unsubscribes a device when configured', async () => {
		const keys = webPush.generateVAPIDKeys();
		process.env.VAPID_PUBLIC_KEY = keys.publicKey;
		process.env.VAPID_PRIVATE_KEY = keys.privateKey;
		try {
			const a = testAgent();
			await signUp(a, 'push2@example.com');

			const config = await a.get('/api/push/config');
			expect(config.body).toEqual({ publicKey: keys.publicKey, enabled: true });

			const sub = await a
				.post('/api/push/subscriptions')
				.send(subscription('https://push.example.com/device-2'));
			expect(sub.status).toBe(201);
			expect(sub.body.endpoint).toBe('https://push.example.com/device-2');

			// Re-subscribing the same endpoint upserts instead of duplicating.
			const again = await a
				.post('/api/push/subscriptions')
				.send(subscription('https://push.example.com/device-2'));
			expect(again.status).toBe(201);
			const list = await a.get('/api/push/subscriptions');
			expect(list.body.subscriptions).toHaveLength(1);

			const bad = await a.post('/api/push/subscriptions').send({ endpoint: 'not-a-url' });
			expect(bad.status).toBe(400);

			const del = await a
				.delete('/api/push/subscriptions')
				.send({ endpoint: 'https://push.example.com/device-2' });
			expect(del.status).toBe(204);
			const empty = await a.get('/api/push/subscriptions');
			expect(empty.body.subscriptions).toHaveLength(0);
		} finally {
			delete process.env.VAPID_PUBLIC_KEY;
			delete process.env.VAPID_PRIVATE_KEY;
		}
	});

	it('isolates subscriptions between users', async () => {
		const keys = webPush.generateVAPIDKeys();
		process.env.VAPID_PUBLIC_KEY = keys.publicKey;
		process.env.VAPID_PRIVATE_KEY = keys.privateKey;
		try {
			const a = testAgent();
			const b = testAgent();
			await signUp(a, 'push3a@example.com');
			await signUp(b, 'push3b@example.com');
			await a.post('/api/push/subscriptions').send(subscription('https://push.example.com/a'));
			// Another user cannot delete it.
			const del = await b
				.delete('/api/push/subscriptions')
				.send({ endpoint: 'https://push.example.com/a' });
			expect(del.status).toBe(204);
			expect((await a.get('/api/push/subscriptions')).body.subscriptions).toHaveLength(1);
		} finally {
			delete process.env.VAPID_PUBLIC_KEY;
			delete process.env.VAPID_PRIVATE_KEY;
		}
	});
});

beforeAll(() => {
	delete process.env.VAPID_PUBLIC_KEY;
	delete process.env.VAPID_PRIVATE_KEY;
});
