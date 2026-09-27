import { z } from 'zod';
import { registry } from '../openapi/registry.js';

// Subscribing stores an endpoint the server later POSTs to (test sends and,
// eventually, forecast alerts). Restrict it to the browser vendors' push
// services so a signed-in user cannot point the server at an arbitrary host.
const PUSH_HOSTS = [
	/^fcm\.googleapis\.com$/,
	/(^|\.)push\.services\.mozilla\.com$/,
	/(^|\.)push\.apple\.com$/,
	/(^|\.)notify\.windows\.com$/
];

export function isAllowedPushEndpoint(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	return url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname.toLowerCase()));
}

const pushEndpoint = z
	.string()
	.url()
	.max(2000)
	.refine(isAllowedPushEndpoint, { message: 'endpoint must be a browser push service URL' });

// What the browser's PushSubscription.toJSON() sends. Keys are base64url.
export const PushSubscriptionBody = registry.register(
	'PushSubscriptionBody',
	z.object({
		endpoint: pushEndpoint,
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
