import { asc, eq, sql } from 'drizzle-orm';
import { deleteTag, findTag, insertTags, updateTag, type TagRow } from '../crud/tags.js';
import { db } from '../db/index.js';
import { tags } from '../db/tables.js';
import type { TagDto } from '../schemas/tags.js';
import { NotFoundError } from './errors.js';

// Seeded once per user, the first time they list tags with none stored.
export const PRESET_TAGS = [
	{ name: 'Pay cheque', color: '#16a34a' },
	{ name: 'Side hustle', color: '#059669' },
	{ name: 'Bill', color: '#ea580c' },
	{ name: 'Groceries', color: '#d97706' }
];

export const toTagDto = (row: TagRow): TagDto => ({
	id: row.id,
	name: row.name,
	color: row.color,
	isPreset: row.isPreset,
	createdAt: row.createdAt.toISOString()
});

// The frontend preloads this on hover, so two first requests for the same brand-new user can
// land within milliseconds of each other. The advisory lock serializes them on userId so only
// one seeds the presets; without it, the plain check-then-insert below is a race that can seed
// 16 presets instead of 8.
export async function listTagsWithPresets(userId: string): Promise<TagDto[]> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
		const existing = await tx
			.select()
			.from(tags)
			.where(eq(tags.userId, userId))
			.orderBy(asc(tags.name));
		if (existing.length > 0) return existing.map(toTagDto);
		const inserted = await tx
			.insert(tags)
			.values(PRESET_TAGS.map((t) => ({ ...t, isPreset: true, userId })))
			.returning();
		return inserted.map(toTagDto).sort((a, b) => a.name.localeCompare(b.name));
	});
}
export async function createTag(userId: string, body: { name: string; color?: string }) {
	const [row] = await insertTags(userId, [{ name: body.name, color: body.color ?? null }]);
	return toTagDto(row);
}
export async function renameTag(
	userId: string,
	id: string,
	patch: { name?: string; color?: string }
) {
	const row = await updateTag(userId, id, patch);
	if (!row) throw new NotFoundError('Tag not found');
	return toTagDto(row);
}
export async function removeTag(userId: string, id: string) {
	if (!(await deleteTag(userId, id))) throw new NotFoundError('Tag not found');
}
export const tagBelongsToUser = async (userId: string, id: string) =>
	(await findTag(userId, id)) !== null;
