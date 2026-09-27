import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { badRequest, unauthorized } from '../schemas/common.js';
import { Checkin, CheckinCreate, CheckinList } from '../schemas/checkins.js';
import { listCheckinsWithExpected, saveCheckin } from '../services/checkins.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});

registry.registerPath({
	method: 'get',
	path: '/api/checkins',
	tags: ['checkins'],
	summary: 'List balance check-ins, newest first',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Checkins', ...json(CheckinList) }, ...unauthorized }
});
registry.registerPath({
	method: 'post',
	path: '/api/checkins',
	tags: ['checkins'],
	summary: "Save today's balance check-in (a second save the same day replaces it)",
	security: [{ cookieAuth: [] }],
	request: { body: json(CheckinCreate) },
	responses: { 201: { description: 'Created', ...json(Checkin) }, ...badRequest, ...unauthorized }
});

const router = Router();
router.get('/checkins', requireAuth, async (_req, res) => {
	res.json({ checkins: await listCheckinsWithExpected(res.locals.user!.id) });
});
router.post('/checkins', requireAuth, validate({ body: CheckinCreate }), async (req, res) => {
	res.status(201).json(await saveCheckin(res.locals.user!.id, req.body.balanceCents));
});
export default router;
