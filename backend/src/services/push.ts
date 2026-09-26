import webPush from 'web-push';
import { listSubscriptions, removeSubscriptionByEndpoint } from '../crud/push.js';

let configured = false;

function ensureConfigured() {
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) return false;
	if (!configured) {
		webPush.setVapidDetails(
			process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
			publicKey,
			privateKey
		);
		configured = true;
	}
	return true;
}

export function pushEnabled() {
	return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function pushPublicKey() {
	return process.env.VAPID_PUBLIC_KEY ?? '';
}

export interface PushPayload {
	title: string;
	body: string;
	url: string;
}

/** Send to every device of a user; drops subscriptions the push service rejects as gone. */
export async function sendToUser(userId: string, payload: PushPayload) {
	if (!ensureConfigured()) throw new Error('Web Push is not configured (missing VAPID keys)');
	const subscriptions = await listSubscriptions(userId);
	let sent = 0;
	let failed = 0;
	await Promise.all(
		subscriptions.map(async (sub) => {
			try {
				await webPush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					JSON.stringify(payload)
				);
				sent += 1;
			} catch (error) {
				failed += 1;
				// 404/410 means the browser revoked the subscription: stop trying it.
				const statusCode =
					typeof error === 'object' && error !== null && 'statusCode' in error
						? (error as { statusCode?: unknown }).statusCode
						: undefined;
				if (statusCode === 404 || statusCode === 410) {
					await removeSubscriptionByEndpoint(sub.endpoint);
				}
			}
		})
	);
	return { sent, failed };
}
