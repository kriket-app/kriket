import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userSettings } from '../db/tables.js';

export async function findSettings(userId: string) {
	const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
	return row ?? null;
}
export async function upsertSettings(userId: string, values: { startingBalanceCents: number; startingDate: string }) {
	const [row] = await db
		.insert(userSettings)
		.values({ ...values, userId })
		.onConflictDoUpdate({ target: userSettings.userId, set: values })
		.returning();
	return row;
}
