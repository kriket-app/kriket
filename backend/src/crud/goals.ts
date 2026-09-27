import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { goals } from '../db/tables.js';

export type GoalRow = typeof goals.$inferSelect;
export type GoalInsert = Omit<
	typeof goals.$inferInsert,
	'id' | 'userId' | 'createdAt' | 'updatedAt'
>;

export async function listGoals(userId: string): Promise<GoalRow[]> {
	return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.targetDate));
}

export async function findGoal(userId: string, id: string): Promise<GoalRow | null> {
	const [row] = await db
		.select()
		.from(goals)
		.where(and(eq(goals.id, id), eq(goals.userId, userId)));
	return row ?? null;
}

export async function insertGoal(userId: string, values: GoalInsert): Promise<GoalRow> {
	const [row] = await db
		.insert(goals)
		.values({ ...values, userId })
		.returning();
	return row;
}

export async function updateGoal(
	userId: string,
	id: string,
	patch: Partial<GoalInsert>
): Promise<GoalRow | null> {
	const [row] = await db
		.update(goals)
		.set(patch)
		.where(and(eq(goals.id, id), eq(goals.userId, userId)))
		.returning();
	return row ?? null;
}

export async function removeGoal(userId: string, id: string): Promise<boolean> {
	const rows = await db
		.delete(goals)
		.where(and(eq(goals.id, id), eq(goals.userId, userId)))
		.returning({ id: goals.id });
	return rows.length > 0;
}
