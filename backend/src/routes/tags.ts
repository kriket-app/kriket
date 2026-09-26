import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { IdParams, badRequest, notFound, unauthorized } from '../schemas/common.js';
import { CreateTagBody, Tag, TagList, UpdateTagBody } from '../schemas/tags.js';
import { createTag, listTagsWithPresets, removeTag, renameTag } from '../services/tags.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});
registry.registerPath({
	method: 'get',
	path: '/api/tags',
	tags: ['tags'],
	summary: 'List tags (seeds presets once)',
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Tags', ...json(TagList) }, ...unauthorized }
});
registry.registerPath({
	method: 'post',
	path: '/api/tags',
	tags: ['tags'],
	summary: 'Create a tag',
	security: [{ cookieAuth: [] }],
	request: { body: json(CreateTagBody) },
	responses: { 201: { description: 'Created', ...json(Tag) }, ...badRequest, ...unauthorized }
});
registry.registerPath({
	method: 'patch',
	path: '/api/tags/{id}',
	tags: ['tags'],
	summary: 'Rename or recolour a tag',
	security: [{ cookieAuth: [] }],
	request: { params: IdParams, body: json(UpdateTagBody) },
	responses: {
		200: { description: 'Updated', ...json(Tag) },
		...badRequest,
		...unauthorized,
		...notFound
	}
});
registry.registerPath({
	method: 'delete',
	path: '/api/tags/{id}',
	tags: ['tags'],
	summary: 'Delete a tag (streams keep working, untagged)',
	security: [{ cookieAuth: [] }],
	request: { params: IdParams },
	responses: { 204: { description: 'Deleted' }, ...unauthorized, ...notFound }
});

const router = Router();
router.get('/tags', requireAuth, async (_req, res) => {
	res.json({ tags: await listTagsWithPresets(res.locals.user!.id) });
});
router.post('/tags', requireAuth, validate({ body: CreateTagBody }), async (req, res) => {
	res.status(201).json(await createTag(res.locals.user!.id, req.body));
});
router.patch(
	'/tags/:id',
	requireAuth,
	validate({ params: IdParams, body: UpdateTagBody }),
	async (req, res) => {
		// `validate` has already parsed req.params against IdParams, so :id is a single string; the
		// generic express-serve-static-core types don't narrow that once other middleware is chained.
		res.json(await renameTag(res.locals.user!.id, req.params.id as string, req.body));
	}
);
router.delete('/tags/:id', requireAuth, validate({ params: IdParams }), async (req, res) => {
	await removeTag(res.locals.user!.id, req.params.id as string);
	res.status(204).end();
});
export default router;
