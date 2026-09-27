import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { IdParams, badRequest, notFound, unauthorized } from '../schemas/common.js';
import { CreateGoalBody, Goal, GoalList, UpdateGoalBody } from '../schemas/goals.js';
import {
	createGoal,
	getGoal,
	listGoalsWithStatus,
	removeGoalById,
	updateGoalById
} from '../services/goals.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});

registry.registerPath({
	method: 'get',
	path: '/api/goals',
	tags: ['goals'],
	summary: 'List goals with forecast status, closest date first',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Goals', ...json(GoalList) }, ...unauthorized }
});
registry.registerPath({
	method: 'post',
	path: '/api/goals',
	tags: ['goals'],
	summary: 'Create a goal',
	security: [{ cookieAuth: [] }],
	request: { body: json(CreateGoalBody) },
	responses: { 201: { description: 'Created', ...json(Goal) }, ...badRequest, ...unauthorized }
});
registry.registerPath({
	method: 'get',
	path: '/api/goals/{id}',
	tags: ['goals'],
	summary: 'Get a goal',
	security: [{ cookieAuth: [] }],
	request: { params: IdParams },
	responses: {
		200: { description: 'Goal', ...json(Goal) },
		...unauthorized,
		...notFound
	}
});
registry.registerPath({
	method: 'patch',
	path: '/api/goals/{id}',
	tags: ['goals'],
	summary: 'Update a goal',
	security: [{ cookieAuth: [] }],
	request: { params: IdParams, body: json(UpdateGoalBody) },
	responses: {
		200: { description: 'Updated', ...json(Goal) },
		...badRequest,
		...unauthorized,
		...notFound
	}
});
registry.registerPath({
	method: 'delete',
	path: '/api/goals/{id}',
	tags: ['goals'],
	summary: 'Delete a goal',
	security: [{ cookieAuth: [] }],
	request: { params: IdParams },
	responses: { 204: { description: 'Deleted' }, ...unauthorized, ...notFound }
});

const router = Router();
router.get('/goals', requireAuth, async (_req, res) => {
	res.json(await listGoalsWithStatus(res.locals.user!.id));
});
router.post('/goals', requireAuth, validate({ body: CreateGoalBody }), async (req, res) => {
	res.status(201).json(await createGoal(res.locals.user!.id, req.body));
});
router.get('/goals/:id', requireAuth, validate({ params: IdParams }), async (req, res) => {
	res.json(await getGoal(res.locals.user!.id, req.params.id as string));
});
router.patch(
	'/goals/:id',
	requireAuth,
	validate({ params: IdParams, body: UpdateGoalBody }),
	async (req, res) => {
		res.json(await updateGoalById(res.locals.user!.id, req.params.id as string, req.body));
	}
);
router.delete('/goals/:id', requireAuth, validate({ params: IdParams }), async (req, res) => {
	await removeGoalById(res.locals.user!.id, req.params.id as string);
	res.status(204).end();
});
export default router;
