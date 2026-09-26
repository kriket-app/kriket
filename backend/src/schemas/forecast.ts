import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { isoDate } from './common.js';

export const ForecastQuery = z.object({
	days: z.coerce.number().int().min(7).max(366).default(90)
});
export const ForecastPoint = registry.register(
	'ForecastPoint',
	z.object({
		date: isoDate,
		minCents: z.number().int(),
		actualCents: z.number().int(),
		maxCents: z.number().int()
	})
);
export const ForecastEvent = registry.register(
	'ForecastEvent',
	z.object({
		date: isoDate,
		kind: z.enum(['income', 'expense']),
		streamId: z.string(),
		name: z.string(),
		minCents: z.number().int(),
		actualCents: z.number().int(),
		maxCents: z.number().int()
	})
);
export const Forecast = registry.register(
	'Forecast',
	z.object({
		startDate: isoDate,
		endDate: isoDate,
		startingBalanceCents: z.number().int(),
		points: z.array(ForecastPoint),
		events: z.array(ForecastEvent),
		endBalance: z.object({
			minCents: z.number().int(),
			actualCents: z.number().int(),
			maxCents: z.number().int()
		})
	})
);
export type ForecastDto = z.infer<typeof Forecast>;
export type ForecastEventDto = z.infer<typeof ForecastEvent>;
export type ForecastPointDto = z.infer<typeof ForecastPoint>;
