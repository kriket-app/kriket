// Browser-side Web Push helpers. The browser talks to the same-origin /api
// (Vite proxy in dev, Caddy in prod), so plain fetch with credentials works.

export type PushStatus =
	'unsupported' | 'disabled' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

export function pushSupported() {
	return (
		typeof window !== 'undefined' &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

/** iOS Safari only supports push for apps installed to the Home Screen. */
export function isIos() {
	if (typeof navigator === 'undefined') return false;
	return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isInstalled() {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

function urlBase64ToUint8Array(base64: string) {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = window.atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding);
	return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, { credentials: 'same-origin', ...init });
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		const message =
			typeof body === 'object' && body !== null && 'message' in body
				? String((body as { message: unknown }).message)
				: `Request failed (${res.status})`;
		throw new Error(message);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export interface PushConfig {
	publicKey: string;
	enabled: boolean;
}

export async function pushConfig(): Promise<PushConfig> {
	return api<PushConfig>('/api/push/config');
}

export async function currentSubscription() {
	// getRegistration (not .ready): resolves even where no worker is active, so
	// callers such as sign-out never hang in dev or unsupported contexts.
	const reg = await navigator.serviceWorker.getRegistration();
	return reg ? reg.pushManager.getSubscription() : null;
}

export async function subscribePush(): Promise<void> {
	const { publicKey, enabled } = await pushConfig();
	if (!enabled || !publicKey) throw new Error('Push notifications are not set up yet');
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') throw new Error('Notification permission was not granted');
	const reg = await navigator.serviceWorker.ready;
	const subscription = await reg.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer
	});
	const raw = subscription.toJSON();
	await api('/api/push/subscriptions', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			endpoint: subscription.endpoint,
			keys: { p256dh: raw.keys?.p256dh, auth: raw.keys?.auth },
			userAgent: navigator.userAgent
		})
	});
}

export async function unsubscribePush(): Promise<void> {
	const subscription = await currentSubscription();
	if (subscription) {
		await api('/api/push/subscriptions', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ endpoint: subscription.endpoint })
		}).catch(() => undefined);
		await subscription.unsubscribe().catch(() => undefined);
	}
}

export async function sendTestPush(title: string, body: string) {
	return api<{ sent: number; failed: number }>('/api/push/test', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ title, body, url: '/app' })
	});
}
