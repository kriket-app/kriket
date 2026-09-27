import { z } from 'zod';
import { registry } from '../openapi/registry.js';
import { isoDate } from './common.js';

const balance = z.number().int().min(-1_000_000_000).max(1_000_000_000);

export const Checkin = registry.register(
	'Checkin',
	z.object({
		id: z.string(),
		balanceCents: balance.openapi({ example: 42000 }),
		checkedOn: isoDate,
		createdAt: z.string().openapi({ format: 'date-time' }),
		expectedCents: z.number().int().nullable(),
		differenceCents: z.number().int().nullable()
	})
);
export const CheckinList = registry.register(
	'CheckinList',
	z.object({ checkins: z.array(Checkin) })
);
export const CheckinCreate = registry.register(
	'CheckinCreate',
	z.object({ balanceCents: balance.openapi({ example: 42000 }) })
);
export type CheckinDto = z.infer<typeof Checkin>;
export type CheckinCreateInput = z.infer<typeof CheckinCreate>;
