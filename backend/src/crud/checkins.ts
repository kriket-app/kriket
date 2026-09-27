import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { balanceCheckins } from '../db/tables.js';

export type CheckinRow = typeof balanceCheckins.$inferSelect;

export const listCheckins = (userId: string): Promise<CheckinRow[]> =>
	db
		.select()
		.from(balanceCheckins)
		.where(eq(balanceCheckins.userId, userId))
		.orderBy(asc(balanceCheckins.checkedOn));

export async function upsertCheckin(
	userId: string,
	balanceCents: number,
	checkedOn: string
): Promise<CheckinRow> {
	const [row] = await db
		.insert(balanceCheckins)
		.values({ userId, balanceCents, checkedOn })
		.onConflictDoUpdate({
			target: [balanceCheckins.userId, balanceCheckins.checkedOn],
			set: { balanceCents }
		})
		.returning();
	return row;
}
