import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { badRequest, unauthorized } from '../schemas/common.js';
import {
	PushConfig,
	PushSendResult,
	PushSubscription,
	PushSubscriptionBody,
	PushSubscriptionList,
	PushTestBody,
	PushUnsubscribeBody
} from '../schemas/push.js';
import { listSubscriptions, removeSubscription, upsertSubscription } from '../crud/push.js';
import { pushEnabled, pushPublicKey, sendToUser } from '../services/push.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});

registry.registerPath({
	method: 'get',
	path: '/api/push/config',
	tags: ['push'],
	summary: 'Whether push is configured, plus the VAPID public key',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Push config', ...json(PushConfig) }, ...unauthorized }
});
registry.registerPath({
	method: 'get',
	path: '/api/push/subscriptions',
	tags: ['push'],
	summary: "List the current user's push subscriptions",
	security: [{ cookieAuth: [] }],
	responses: {
		200: { description: 'Subscriptions', ...json(PushSubscriptionList) },
		...unauthorized
	}
});
registry.registerPath({
	method: 'post',
	path: '/api/push/subscriptions',
	tags: ['push'],
	summary: 'Subscribe a device (upserts on re-subscribe)',
	security: [{ cookieAuth: [] }],
	request: { body: json(PushSubscriptionBody) },
	responses: {
		201: { description: 'Subscribed', ...json(PushSubscription) },
		...badRequest,
		...unauthorized
	}
});
registry.registerPath({
	method: 'delete',
	path: '/api/push/subscriptions',
	tags: ['push'],
	summary: 'Unsubscribe a device',
	security: [{ cookieAuth: [] }],
	request: { body: json(PushUnsubscribeBody) },
	responses: {
		204: { description: 'Unsubscribed' },
		...badRequest,
		...unauthorized
	}
});
registry.registerPath({
	method: 'post',
	path: '/api/push/test',
	tags: ['push'],
	summary: 'Send a test notification to your own devices',
	security: [{ cookieAuth: [] }],
	request: { body: json(PushTestBody) },
	responses: {
		200: { description: 'Send result', ...json(PushSendResult) },
		...badRequest,
		...unauthorized
	}
});

const router = Router();

router.get('/push/config', requireAuth, (_req, res) => {
	res.json({ publicKey: pushPublicKey(), enabled: pushEnabled() });
});

router.get('/push/subscriptions', requireAuth, async (_req, res) => {
	const rows = await listSubscriptions(res.locals.user!.id);
	res.json({
		subscriptions: rows.map((row) => ({
			id: row.id,
			endpoint: row.endpoint,
			createdAt: row.createdAt.toISOString()
		}))
	});
});

router.post(
	'/push/subscriptions',
	requireAuth,
	validate({ body: PushSubscriptionBody }),
	async (req, res) => {
		if (!pushEnabled()) {
			res.status(503).json({ message: 'Push notifications are not configured' });
			return;
		}
		const row = await upsertSubscription(res.locals.user!.id, req.body);
		res.status(201).json({
			id: row.id,
			endpoint: row.endpoint,
			createdAt: row.createdAt.toISOString()
		});
	}
);

router.delete(
	'/push/subscriptions',
	requireAuth,
	validate({ body: PushUnsubscribeBody }),
	async (req, res) => {
		await removeSubscription(res.locals.user!.id, req.body.endpoint);
		res.status(204).end();
	}
);

router.post('/push/test', requireAuth, validate({ body: PushTestBody }), async (req, res) => {
	if (!pushEnabled()) {
		res.status(503).json({ message: 'Push notifications are not configured' });
		return;
	}
	// A test that can't be delivered within five minutes is no longer a useful test.
	res.json(await sendToUser(res.locals.user!.id, req.body, { ttlSeconds: 300 }));
});

export default router;
