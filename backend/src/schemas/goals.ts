import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { isoDate, positiveCents } from './common.js';

export const GoalStatus = registry.register(
	'GoalStatus',
	z.object({
		state: z.enum(['forecast', 'past', 'beyond']),
		expectedCents: z.number().int().nullable(),
		worstCents: z.number().int().nullable(),
		bestCents: z.number().int().nullable(),
		monthlyNeededCents: z.number().int().nullable()
	})
);

export const Goal = registry.register(
	'Goal',
	z.object({
		id: z.string(),
		name: z.string(),
		description: z.string().nullable(),
		amountCents: z.number().int(),
		targetDate: isoDate,
		createdAt: z.string().openapi({ format: 'date-time' }),
		updatedAt: z.string().openapi({ format: 'date-time' }),
		status: GoalStatus
	})
);

export const GoalList = registry.register(
	'GoalList',
	z.object({ goals: z.array(Goal), today: isoDate })
);

const fields = {
	name: z.string().trim().min(1).max(100).openapi({ example: 'Trip home' }),
	description: z
		.string()
		.trim()
		.max(280)
		.nullable()
		.optional()
		.openapi({ example: 'Flights for December' }),
	amountCents: positiveCents,
	targetDate: isoDate
};

export const CreateGoalBody = registry.register('CreateGoalBody', z.object(fields));
export const UpdateGoalBody = registry.register('UpdateGoalBody', z.object(fields).partial());

export type GoalDto = z.infer<typeof Goal>;
export type GoalStatusDto = z.infer<typeof GoalStatus>;
export type GoalListDto = z.infer<typeof GoalList>;
export type CreateGoalInput = z.infer<typeof CreateGoalBody>;
export type UpdateGoalInput = z.infer<typeof UpdateGoalBody>;
