import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { isoDate } from './common.js';

const isoMonth = z
	.string()
	.regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use YYYY-MM')
	.openapi({ example: '2026-10' });

export const ComingUpQuery = z.object({ month: isoMonth.optional() });
export const ComingUpEvent = registry.register(
	'ComingUpEvent',
	z.object({
		streamId: z.string(),
		kind: z.enum(['income', 'expense']),
		name: z.string(),
		tagId: z.string().nullable(),
		minCents: z.number().int(),
		actualCents: z.number().int(),
		maxCents: z.number().int()
	})
);
export const ComingUp = registry.register(
	'ComingUp',
	z.object({
		month: isoMonth,
		today: isoDate,
		firstMonth: isoMonth,
		lastMonth: isoMonth,
		days: z.array(z.object({ date: isoDate, past: z.boolean(), events: z.array(ComingUpEvent) })),
		inCents: z.number().int(),
		outCents: z.number().int(),
		endBalanceCents: z.number().int().nullable()
	})
);
export type ComingUpDto = z.infer<typeof ComingUp>;
export type ComingUpEventDto = z.infer<typeof ComingUpEvent>;
