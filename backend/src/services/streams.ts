import { streamCrud, type StreamRow } from '../crud/streams.js';
import type { CreateStreamInput, StreamDto, UpdateStreamInput } from '../schemas/streams.js';
import { InvalidInputError, NotFoundError } from './errors.js';
import { tagBelongsToUser } from './tags.js';

export const toStreamDto = (row: StreamRow): StreamDto => ({
	id: row.id,
	name: row.name,
	tagId: row.tagId,
	minCents: row.minCents,
	maxCents: row.maxCents,
	actualCents: row.actualCents,
	intervalDays: row.intervalDays,
	firstDate: row.firstDate,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString()
});

export function assertOrdered(a: { minCents: number; actualCents: number; maxCents: number }) {
	const details: { path: string; message: string }[] = [];
	if (a.actualCents < a.minCents)
		details.push({ path: 'actualCents', message: 'the usual amount cannot be below the minimum' });
	if (a.maxCents < a.actualCents)
		details.push({ path: 'maxCents', message: 'the maximum cannot be below the usual amount' });
	if (details.length) throw new InvalidInputError('Invalid request', details);
}

async function assertTag(userId: string, tagId: string | null | undefined) {
	if (tagId == null) return;
	if (!(await tagBelongsToUser(userId, tagId)))
		throw new InvalidInputError('Invalid request', [{ path: 'tagId', message: 'no such tag' }]);
}

export function streamService(kind: 'income' | 'expense') {
	const crud = streamCrud(kind);
	return {
		list: async (userId: string) => (await crud.list(userId)).map(toStreamDto),
		async create(userId: string, body: CreateStreamInput) {
			assertOrdered(body);
			await assertTag(userId, body.tagId);
			return toStreamDto(await crud.insert(userId, { ...body, tagId: body.tagId ?? null }));
		},
		async update(userId: string, id: string, patch: UpdateStreamInput) {
			const current = await crud.find(userId, id);
			if (!current) throw new NotFoundError('Stream not found');
			assertOrdered({ ...current, ...patch });
			await assertTag(userId, patch.tagId);
			const row = await crud.update(userId, id, patch);
			if (!row) throw new NotFoundError('Stream not found');
			return toStreamDto(row);
		},
		async remove(userId: string, id: string) {
			if (!(await crud.remove(userId, id))) throw new NotFoundError('Stream not found');
		}
	};
}
export const incomeService = streamService('income');
export const expenseService = streamService('expense');
