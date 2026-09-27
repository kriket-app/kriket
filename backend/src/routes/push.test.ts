import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import webPush from 'web-push';
import { signUp, testAgent } from '../../tests/helpers.js';

// Never touch the network: subscribing only validates and stores, and sends
// go through the mock so pruning and counting are testable.
vi.mock('web-push', () => ({
	default: {
		setVapidDetails: vi.fn(),
		generateVAPIDKeys: () => ({ publicKey: 'mock-public-key', privateKey: 'mock-private-key' }),
		sendNotification: vi.fn()
	}
}));

const sendMock = vi.mocked(webPush.sendNotification);

const subscription = (endpoint: string) => ({
	endpoint,
	keys: { p256dh: 'p256dh-test-key', auth: 'auth-test-key' },
	userAgent: 'test-agent'
});

// Realistic push-service endpoints (Mozilla's regional subdomains included).
const FCM = 'https://fcm.googleapis.com/fcm/send/device-1';
const MOZILLA = 'https://push.services.mozilla.com/wpush/v2/device-2';

function enablePush() {
	const keys = webPush.generateVAPIDKeys();
	process.env.VAPID_PUBLIC_KEY = keys.publicKey;
	process.env.VAPID_PRIVATE_KEY = keys.privateKey;
	return keys;
}

describe('/api/push', () => {
	beforeEach(() => {
		sendMock.mockReset();
		sendMock.mockResolvedValue({} as never);
	});

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
		const sub = await a.post('/api/push/subscriptions').send(subscription(FCM));
		expect(sub.status).toBe(503);
	});

	it('subscribes, lists, and unsubscribes a device when configured', async () => {
		const keys = enablePush();
		try {
			const a = testAgent();
			await signUp(a, 'push2@example.com');

			const config = await a.get('/api/push/config');
			expect(config.body).toEqual({ publicKey: keys.publicKey, enabled: true });

			const sub = await a.post('/api/push/subscriptions').send(subscription(FCM));
			expect(sub.status).toBe(201);
			expect(sub.body.endpoint).toBe(FCM);

			// Re-subscribing the same endpoint upserts instead of duplicating.
			const again = await a.post('/api/push/subscriptions').send(subscription(FCM));
			expect(again.status).toBe(201);
			const list = await a.get('/api/push/subscriptions');
			expect(list.body.subscriptions).toHaveLength(1);

			const bad = await a.post('/api/push/subscriptions').send({ endpoint: 'not-a-url' });
			expect(bad.status).toBe(400);

			const del = await a.delete('/api/push/subscriptions').send({ endpoint: FCM });
			expect(del.status).toBe(204);
			const empty = await a.get('/api/push/subscriptions');
			expect(empty.body.subscriptions).toHaveLength(0);
		} finally {
			delete process.env.VAPID_PUBLIC_KEY;
			delete process.env.VAPID_PRIVATE_KEY;
		}
	});

	it('rejects endpoints outside the browser push services', async () => {
		enablePush();
		try {
			const a = testAgent();
			await signUp(a, 'push4@example.com');
			for (const endpoint of [
				'http://fcm.googleapis.com/fcm/send/plain-http',
				'https://push.example.com/device',
				'https://fcm.googleapis.com.evil.example.com/device',
				'https://192.0.2.1/device'
			]) {
				const res = await a.post('/api/push/subscriptions').send(subscription(endpoint));
				expect(res.status).toBe(400);
				expect(JSON.stringify(res.body)).toContain('push service');
			}
			// Vendor regional subdomains are accepted.
			const ok = await a.post('/api/push/subscriptions').send(subscription(MOZILLA));
			expect(ok.status).toBe(201);
		} finally {
			delete process.env.VAPID_PUBLIC_KEY;
			delete process.env.VAPID_PRIVATE_KEY;
		}
	});

	it('sends a test notification to your own devices', async () => {
		enablePush();
		try {
			const a = testAgent();
			await signUp(a, 'push5@example.com');
			await a.post('/api/push/subscriptions').send(subscription(FCM));
			const res = await a.post('/api/push/test').send({
				title: 'Hello',
				body: 'World',
				url: '/app'
			});
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ sent: 1, failed: 0 });
			expect(sendMock).toHaveBeenCalledTimes(1);
			const [psSubscription, payload] = sendMock.mock.calls[0];
			expect(psSubscription).toMatchObject({ endpoint: FCM });
			expect(JSON.parse(payload as string)).toEqual({ title: 'Hello', body: 'World', url: '/app' });
		} finally {
			delete process.env.VAPID_PUBLIC_KEY;
			delete process.env.VAPID_PRIVATE_KEY;
		}
	});

	it('prunes subscriptions the push service reports as gone', async () => {
		enablePush();
		try {
			const a = testAgent();
			await signUp(a, 'push6@example.com');
			await a.post('/api/push/subscriptions').send(subscription(FCM));
			sendMock.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
			const res = await a.post('/api/push/test').send({
				title: 'Hello',
				body: 'World',
				url: '/app'
			});
			expect(res.status).toBe(200);
			expect(res.body).toEqual({ sent: 0, failed: 1 });
			expect((await a.get('/api/push/subscriptions')).body.subscriptions).toHaveLength(0);
		} finally {
			delete process.env.VAPID_PUBLIC_KEY;
			delete process.env.VAPID_PRIVATE_KEY;
		}
	});

	it('isolates subscriptions between users', async () => {
		enablePush();
		try {
			const a = testAgent();
			const b = testAgent();
			await signUp(a, 'push3a@example.com');
			await signUp(b, 'push3b@example.com');
			await a.post('/api/push/subscriptions').send(subscription(FCM));
			// Another user cannot delete it.
			const del = await b.delete('/api/push/subscriptions').send({ endpoint: FCM });
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
