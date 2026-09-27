import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { cents, isoDate, positiveCents } from './common.js';

const recurrence = z.enum(['days', 'monthly', 'yearly']);

export const Stream = registry.register(
	'Stream',
	z.object({
		id: z.string(),
		name: z.string(),
		tagId: z.string().nullable(),
		minCents: z.number().int(),
		maxCents: z.number().int(),
		actualCents: z.number().int(),
		intervalDays: z.number().int(),
		recurrence,
		firstDate: isoDate,
		isSubscription: z.boolean(),
		createdAt: z.string().openapi({ format: 'date-time' }),
		updatedAt: z.string().openapi({ format: 'date-time' })
	})
);
export const StreamList = registry.register('StreamList', z.object({ streams: z.array(Stream) }));

const fields = {
	name: z.string().trim().min(1).max(100).openapi({ example: 'Shifts at the café' }),
	tagId: z.string().uuid().nullable().optional(),
	minCents: cents,
	maxCents: cents,
	actualCents: positiveCents,
	intervalDays: z.number().int().min(1).max(366).openapi({ example: 14 }),
	recurrence: recurrence.optional(),
	firstDate: isoDate,
	isSubscription: z.boolean().optional().openapi({ example: false })
};
export const CreateStreamBody = registry.register(
	'CreateStreamBody',
	z.object({
		...fields,
		intervalDays: fields.intervalDays.optional(),
		minCents: cents.optional(),
		maxCents: cents.optional()
	})
);
export const UpdateStreamBody = registry.register('UpdateStreamBody', z.object(fields).partial());
export type StreamDto = z.infer<typeof Stream>;
export type CreateStreamInput = z.infer<typeof CreateStreamBody>;
export type UpdateStreamInput = z.infer<typeof UpdateStreamBody>;
