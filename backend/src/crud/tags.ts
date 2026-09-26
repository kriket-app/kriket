import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tags } from '../db/tables.js';

export type TagRow = typeof tags.$inferSelect;
export const listTags = (userId: string) => db.select().from(tags).where(eq(tags.userId, userId)).orderBy(asc(tags.name));
export const insertTags = (userId: string, rows: { name: string; color?: string | null; isPreset?: boolean }[]) =>
	db
		.insert(tags)
		.values(rows.map((r) => ({ ...r, userId })))
		.returning();
export async function findTag(userId: string, id: string): Promise<TagRow | null> {
	const [row] = await db.select().from(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
	return row ?? null;
}
export async function updateTag(userId: string, id: string, patch: { name?: string; color?: string | null }): Promise<TagRow | null> {
	const [row] = await db.update(tags).set(patch).where(and(eq(tags.id, id), eq(tags.userId, userId))).returning();
	return row ?? null;
}
export async function deleteTag(userId: string, id: string): Promise<boolean> {
	const rows = await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))).returning({ id: tags.id });
	return rows.length > 0;
}
