import { z } from 'zod';
import { registry } from '../openapi/registry.js';

// Subscribing stores an endpoint the server later POSTs to (test sends and forecast
// alerts). Restrict it to the browser vendors' push services so a signed-in user
// cannot point the server at an arbitrary host. Google-owned hosts are allowed as a
// whole: FCM is the documented one, and a vendor host is not a probe target.
const PUSH_HOSTS = [
	/(^|\.)googleapis\.com$/,
	/(^|\.)google\.com$/,
	/(^|\.)push\.services\.mozilla\.com$/,
	/(^|\.)push\.apple\.com$/,
	/(^|\.)notify\.windows\.com$/
];

// The host is checked exactly as written. web-push sends with Node's legacy url.parse,
// which reads unusual hosts differently from new URL: "attacker.example%2Epush.apple.com"
// is an Apple host to new URL but "attacker.example" to url.parse. Only a plain DNS name
// with no port, credentials, or escapes passes, so both parsers agree on the host.
const LITERAL_HTTPS_HOST = /^https:\/\/([a-z0-9.-]+)(?=[/?#]|$)/i;

export function isAllowedPushEndpoint(value: string) {
	const match = LITERAL_HTTPS_HOST.exec(value);
	if (!match) return false;
	const host = match[1].toLowerCase();
	return PUSH_HOSTS.some((re) => re.test(host));
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

// A path inside the app, never another origin: the service worker opens it when the
// notification is tapped.
const appPath = z
	.string()
	.max(2000)
	.regex(/^\/(?![/\\])/, 'must be a path inside the app, starting with a single /');

export const PushTestBody = registry.register(
	'PushTestBody',
	z.object({
		title: z.string().trim().min(1).max(120).default('Kriket test'),
		body: z.string().trim().max(500).default('Notifications are working.'),
		url: appPath.default('/app')
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
