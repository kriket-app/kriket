import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/tables.js';
import type { PushSubscriptionBodyDto } from '../schemas/push.js';

export async function upsertSubscription(userId: string, body: PushSubscriptionBodyDto) {
	const values = {
		userId,
		endpoint: body.endpoint,
		p256dh: body.keys.p256dh,
		auth: body.keys.auth,
		userAgent: body.userAgent ?? null
	};
	const [row] = await db
		.insert(pushSubscriptions)
		.values(values)
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId, p256dh: values.p256dh, auth: values.auth, userAgent: values.userAgent }
		})
		.returning();
	return row;
}

export async function listSubscriptions(userId: string) {
	return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function removeSubscription(userId: string, endpoint: string) {
	const [row] = await db
		.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
		.returning();
	return row ?? null;
}

/** Every user with at least one device subscribed: the forecast alert sweep checks only these. */
export async function listUserIdsWithSubscriptions() {
	const rows = await db
		.selectDistinct({ userId: pushSubscriptions.userId })
		.from(pushSubscriptions);
	return rows.map((row) => row.userId);
}

export async function removeSubscriptionByEndpoint(endpoint: string) {
	await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
