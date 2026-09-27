import { z } from 'zod';
import { registry } from '../openapi/registry.js';

export const SubscriptionDigest = registry.register(
	'SubscriptionDigest',
	z.object({
		count: z.number().int(),
		monthlyCents: z.number().int(),
		lastSentOn: z.string().nullable(),
		nextReviewOn: z.string().date().nullable(),
		due: z.boolean()
	})
);
export type SubscriptionDigestDto = z.infer<typeof SubscriptionDigest>;
