import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { registry } from '../openapi/registry.js';
import { unauthorized } from '../schemas/common.js';
import { SubscriptionDigest } from '../schemas/subscriptions.js';
import { dismissSubscriptionDigest, getSubscriptionDigest } from '../services/subscriptions.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});
registry.registerPath({
	method: 'get',
	path: '/api/subscriptions/digest',
	tags: ['subscriptions'],
	summary: 'Quarterly subscription cleanup digest',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Digest', ...json(SubscriptionDigest) }, ...unauthorized }
});
registry.registerPath({
	method: 'post',
	path: '/api/subscriptions/dismiss',
	tags: ['subscriptions'],
	summary: 'Snooze the subscription digest for another quarter',
	security: [{ cookieAuth: [] }],
	responses: { 204: { description: 'Dismissed' }, ...unauthorized }
});

const router = Router();
router.get('/subscriptions/digest', requireAuth, async (_req, res) => {
	res.json(await getSubscriptionDigest(res.locals.user!.id));
});
router.post('/subscriptions/dismiss', requireAuth, async (_req, res) => {
	await dismissSubscriptionDigest(res.locals.user!.id);
	res.status(204).end();
});
export default router;
