import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { badRequest, unauthorized } from '../schemas/common.js';
import { ConsentBody, OnboardingStatus } from '../schemas/onboarding.js';
import {
	acceptConsent,
	completeOnboarding,
	getOnboardingStatus,
	reopenOnboarding
} from '../services/onboarding.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});

registry.registerPath({
	method: 'get',
	path: '/api/onboarding',
	tags: ['onboarding'],
	summary: 'Whether the user still owes consent or the first-run walkthrough',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Status', ...json(OnboardingStatus) }, ...unauthorized }
});
registry.registerPath({
	method: 'post',
	path: '/api/onboarding/consent',
	tags: ['onboarding'],
	summary: 'Accept the current privacy statement and terms of use',
	security: [{ cookieAuth: [] }],
	request: { body: json(ConsentBody) },
	responses: {
		201: { description: 'Recorded', ...json(OnboardingStatus) },
		...badRequest,
		...unauthorized
	}
});
registry.registerPath({
	method: 'post',
	path: '/api/onboarding/complete',
	tags: ['onboarding'],
	summary: 'Mark the first-run walkthrough done',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Status', ...json(OnboardingStatus) }, ...unauthorized }
});
registry.registerPath({
	method: 'post',
	path: '/api/onboarding/reopen',
	tags: ['onboarding'],
	summary: 'Replay the walkthrough later from settings (consent stays)',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Status', ...json(OnboardingStatus) }, ...unauthorized }
});

const router = Router();
router.get('/onboarding', requireAuth, async (_req, res) => {
	res.json(await getOnboardingStatus(res.locals.user!.id));
});
router.post(
	'/onboarding/consent',
	requireAuth,
	validate({ body: ConsentBody }),
	async (_req, res) => {
		res.status(201).json(await acceptConsent(res.locals.user!.id));
	}
);
router.post('/onboarding/complete', requireAuth, async (_req, res) => {
	res.json(await completeOnboarding(res.locals.user!.id));
});
router.post('/onboarding/reopen', requireAuth, async (_req, res) => {
	res.json(await reopenOnboarding(res.locals.user!.id));
});
export default router;
