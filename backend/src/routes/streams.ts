import { Router } from 'express';
import { registry } from '../openapi/registry.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/require-auth.js';
import { IdParams, badRequest, notFound, unauthorized } from '../schemas/common.js';
import { CreateStreamBody, Stream, StreamList, UpdateStreamBody } from '../schemas/streams.js';
import { streamService } from '../services/streams.js';

const json = (schema: Parameters<typeof registry.register>[1]) => ({
	content: { 'application/json': { schema } }
});

export function streamsRouter(kind: 'income' | 'expense') {
	const base = `/${kind}-streams`;
	const tag = `${kind}-streams`;
	const noun = kind === 'income' ? 'an income stream' : 'an expense stream';

	registry.registerPath({
		method: 'get',
		path: `/api${base}`,
		tags: [tag],
		summary: `List ${tag.replace('-', ' ')}`,
		security: [{ cookieAuth: [] }],
		responses: { 200: { description: 'Streams', ...json(StreamList) }, ...unauthorized }
	});
	registry.registerPath({
		method: 'post',
		path: `/api${base}`,
		tags: [tag],
		summary: `Create ${noun}`,
		security: [{ cookieAuth: [] }],
		request: { body: json(CreateStreamBody) },
		responses: { 201: { description: 'Created', ...json(Stream) }, ...badRequest, ...unauthorized }
	});
	registry.registerPath({
		method: 'patch',
		path: `/api${base}/{id}`,
		tags: [tag],
		summary: `Update ${noun}`,
		security: [{ cookieAuth: [] }],
		request: { params: IdParams, body: json(UpdateStreamBody) },
		responses: {
			200: { description: 'Updated', ...json(Stream) },
			...badRequest,
			...unauthorized,
			...notFound
		}
	});
	registry.registerPath({
		method: 'delete',
		path: `/api${base}/{id}`,
		tags: [tag],
		summary: `Delete ${noun}`,
		security: [{ cookieAuth: [] }],
		request: { params: IdParams },
		responses: { 204: { description: 'Deleted' }, ...unauthorized, ...notFound }
	});

	const service = streamService(kind);
	const router = Router();
	router.get(base, requireAuth, async (_req, res) => {
		res.json({ streams: await service.list(res.locals.user!.id) });
	});
	router.post(base, requireAuth, validate({ body: CreateStreamBody }), async (req, res) => {
		res.status(201).json(await service.create(res.locals.user!.id, req.body));
	});
	router.patch(
		`${base}/:id`,
		requireAuth,
		validate({ params: IdParams, body: UpdateStreamBody }),
		async (req, res) => {
			// See the note in routes/tags.ts: `validate` guarantees a single string here.
			res.json(await service.update(res.locals.user!.id, req.params.id as string, req.body));
		}
	);
	router.delete(`${base}/:id`, requireAuth, validate({ params: IdParams }), async (req, res) => {
		await service.remove(res.locals.user!.id, req.params.id as string);
		res.status(204).end();
	});
	return router;
}
