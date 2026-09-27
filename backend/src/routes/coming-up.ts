import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { requireAuth } from '../middleware/require-auth.js';
import { badRequest, unauthorized } from '../schemas/common.js';
import { ComingUp, ComingUpQuery } from '../schemas/coming-up.js';
import { getComingUp } from '../services/coming-up.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});

registry.registerPath({
	method: 'get',
	path: '/api/coming-up',
	tags: ['coming-up'],
	summary: "A month's scheduled events and expected balance",
	security: [{ cookieAuth: [] }],
	request: { query: ComingUpQuery },
	responses: {
		200: { description: 'Coming up', ...json(ComingUp) },
		...badRequest,
		...unauthorized
	}
});

const router = Router();
// Express 5 makes req.query a read-only getter, so `validate` (which assigns req.query) can't
// be used here; parse it in the handler instead and return the same 400 shape ourselves.
router.get('/coming-up', requireAuth, async (req, res) => {
	const parsed = ComingUpQuery.safeParse(req.query);
	if (!parsed.success) {
		res.status(400).json({
			error: {
				message: 'Invalid request',
				details: parsed.error.issues.map((issue) => ({
					path: issue.path.join('.'),
					message: issue.message
				}))
			}
		});
		return;
	}
	res.json(await getComingUp(res.locals.user!.id, parsed.data.month));
});
export default router;
