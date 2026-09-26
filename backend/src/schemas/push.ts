import { z } from 'zod';
import { registry } from '../openapi/registry.js';

// What the browser's PushSubscription.toJSON() sends. Keys are base64url.
export const PushSubscriptionBody = registry.register(
	'PushSubscriptionBody',
	z.object({
		endpoint: z.string().url().max(2000),
		keys: z.object({
			p256dh: z.string().min(1).max(500),
			auth: z.string().min(1).max(500)
		}),
		userAgent: z.string().max(500).optional()
	})
);

export const PushSubscription = registry.register(
	'PushSubscription',
	z.object({
		id: z.string(),
		endpoint: z.string(),
		createdAt: z.string().openapi({ format: 'date-time' })
	})
);
export const PushSubscriptionList = registry.register(
	'PushSubscriptionList',
	z.object({ subscriptions: z.array(PushSubscription) })
);

export const PushUnsubscribeBody = registry.register(
	'PushUnsubscribeBody',
	z.object({ endpoint: z.string().url().max(2000) })
);

export const PushTestBody = registry.register(
	'PushTestBody',
	z.object({
		title: z.string().trim().min(1).max(120).default('Kriket test'),
		body: z.string().trim().max(500).default('Notifications are working.'),
		url: z.string().max(2000).default('/app')
	})
);

export const PushSendResult = registry.register(
	'PushSendResult',
	z.object({ sent: z.number().int().min(0), failed: z.number().int().min(0) })
);

export const PushConfig = registry.register(
	'PushConfig',
	z.object({ publicKey: z.string(), enabled: z.boolean() })
);

export type PushSubscriptionBodyDto = z.infer<typeof PushSubscriptionBody>;
