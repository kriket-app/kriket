import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { unauthorized } from '../schemas/common.js';
import { Settings } from '../schemas/settings.js';
import { getSettings, putSettings } from '../services/settings.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({ content: { 'application/json': { schema } } });

registry.registerPath({
	method: 'get',
	path: '/api/settings',
	tags: ['settings'],
	summary: 'Get the current settings (defaults when nothing is stored)',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Settings', ...json(Settings) }, ...unauthorized }
});
registry.registerPath({
	method: 'put',
	path: '/api/settings',
	tags: ['settings'],
	summary: 'Replace the current settings',
	security: [{ cookieAuth: [] }],
	request: { body: json(Settings) },
	responses: { 200: { description: 'Settings', ...json(Settings) }, ...unauthorized }
});

const router = Router();
router.get('/settings', requireAuth, async (_req, res) => {
	res.json(await getSettings(res.locals.user!.id));
});
router.put('/settings', requireAuth, validate({ body: Settings }), async (req, res) => {
	res.json(await putSettings(res.locals.user!.id, req.body));
});
export default router;
