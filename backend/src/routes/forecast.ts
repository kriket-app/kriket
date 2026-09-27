import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { requireAuth } from '../middleware/require-auth.js';
import { badRequest, notFound, unauthorized } from '../schemas/common.js';
import { Forecast, ForecastQuery } from '../schemas/forecast.js';
import { getForecast } from '../services/forecast.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});

registry.registerPath({
	method: 'get',
	path: '/api/forecast',
	tags: ['forecast'],
	summary: 'Project the balance forward from the latest check-in and streams',
	security: [{ cookieAuth: [] }],
	request: { query: ForecastQuery },
	responses: {
		200: { description: 'Forecast', ...json(Forecast) },
		...badRequest,
		...unauthorized,
		...notFound
	}
});

const router = Router();
// Express 5 makes req.query a read-only getter, so `validate` (which assigns req.query) can't
// be used here; parse it in the handler instead and return the same 400 shape ourselves.
router.get('/forecast', requireAuth, async (req, res) => {
	const parsed = ForecastQuery.safeParse(req.query);
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
	res.json(await getForecast(res.locals.user!.id, parsed.data.days, parsed.data.checkinId));
});
export default router;
