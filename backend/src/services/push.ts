import webPush, { type RequestOptions } from 'web-push';
import { listSubscriptions, removeSubscriptionByEndpoint } from '../crud/push.js';
import { logger } from '../logger.js';

// Keys are read on every call rather than once at startup, so push turns on as soon as the
// environment has both keys, and the tests can switch it on and off.
export function pushEnabled() {
	return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function pushPublicKey() {
	return process.env.VAPID_PUBLIC_KEY ?? '';
}

/**
 * The contact push services use to reach the sender: VAPID_SUBJECT when set, otherwise the
 * app's own https URL. Apple rejects anything that is not a mailto: or https: URL.
 */
function vapidSubject() {
	const explicit = process.env.VAPID_SUBJECT?.trim();
	if (explicit) return explicit;
	const appUrl = process.env.BETTER_AUTH_URL ?? '';
	return appUrl.startsWith('https://') ? appUrl : 'mailto:admin@example.com';
}

export interface PushPayload {
	title: string;
	body: string;
	url: string;
}

export interface SendOptions {
	/** Seconds the push service keeps a message for a device that is offline. */
	ttlSeconds?: number;
	/** An undelivered message is replaced by a newer one with the same topic (at most 32 URL-safe characters). */
	topic?: string;
}

const SEND_TIMEOUT_MS = 10_000;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

function statusCodeOf(error: unknown) {
	return typeof error === 'object' && error !== null && 'statusCode' in error
		? (error as { statusCode?: unknown }).statusCode
		: undefined;
}

// The endpoint URL is a capability (anyone holding it can push to the device), so logs carry
// only its host.
function hostOf(endpoint: string) {
	try {
		return new URL(endpoint).host;
	} catch {
		return 'invalid-endpoint';
	}
}

/** Send to every device of a user; drops subscriptions the push service rejects as gone. */
export async function sendToUser(userId: string, payload: PushPayload, options: SendOptions = {}) {
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) throw new Error('Web Push is not configured (missing VAPID keys)');
	const requestOptions: RequestOptions = {
		vapidDetails: { subject: vapidSubject(), publicKey, privateKey },
		TTL: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
		timeout: SEND_TIMEOUT_MS,
		...(options.topic ? { topic: options.topic } : {})
	};

	const subscriptions = await listSubscriptions(userId);
	let sent = 0;
	let failed = 0;
	await Promise.all(
		subscriptions.map(async (sub) => {
			try {
				await webPush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					JSON.stringify(payload),
					requestOptions
				);
				sent += 1;
			} catch (error) {
				failed += 1;
				const statusCode = statusCodeOf(error);
				const host = hostOf(sub.endpoint);
				// 404/410 means the browser revoked the subscription: stop trying it.
				if (statusCode === 404 || statusCode === 410) {
					await removeSubscriptionByEndpoint(sub.endpoint);
					logger.info({ userId, host, statusCode }, 'Removed a revoked push subscription');
					return;
				}
				logger.warn(
					{
						userId,
						host,
						statusCode,
						reason: error instanceof Error ? error.message : String(error),
						body:
							typeof error === 'object' && error !== null && 'body' in error
								? String((error as { body?: unknown }).body).slice(0, 300)
								: undefined
					},
					'Push send failed'
				);
			}
		})
	);
	return { sent, failed };
}
