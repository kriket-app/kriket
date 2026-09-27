import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { deleteTag, findTag, insertTags, updateTag, type TagRow } from '../crud/tags.js';
import { db } from '../db/index.js';
import { expenseStreams, tags } from '../db/tables.js';
import type { TagDto } from '../schemas/tags.js';
import { NotFoundError } from './errors.js';
import { today } from './dates.js';

// Seeded once per user, the first time they list tags with none stored.
export const PRESET_TAGS = [
	{ name: 'Pay cheque', color: '#16a34a' },
	{ name: 'Side hustle', color: '#059669' },
	{ name: 'Bill', color: '#ea580c' },
	{ name: 'Groceries', color: '#d97706' },
	{ name: 'Subscriptions', color: '#8b5cf6' }
];

export const SUBSCRIPTION_TAG_NAME = 'Subscriptions';
export const isSubscriptionTagName = (name: string) => /^subscriptions?$/i.test(name.trim());

export const toTagDto = (row: TagRow): TagDto => ({
	id: row.id,
	name: row.name,
	color: row.color,
	isPreset: row.isPreset,
	presetKey: row.presetKey,
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
		if (existing.length === 0) {
			const inserted = await tx
				.insert(tags)
				.values(
					PRESET_TAGS.map((t) => ({
						...t,
						isPreset: true,
						userId,
						presetKey: t.name === SUBSCRIPTION_TAG_NAME ? ('subscriptions' as const) : null
					}))
				)
				.returning();
			await ensureSubscriptionTagIn(tx, userId, inserted);
			return inserted.map(toTagDto).sort((a, b) => a.name.localeCompare(b.name));
		}
		const subscription = await ensureSubscriptionTagIn(tx, userId, existing);
		return [...existing.filter((t) => t.id !== subscription.id), subscription]
			.map(toTagDto)
			.sort((a, b) => a.name.localeCompare(b.name));
	});
}

/** The user's Subscriptions tag, creating it when it was deleted or never seeded. */
type TagTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ensureSubscriptionTagIn(tx: TagTransaction, userId: string, existing: TagRow[]) {
	let found =
		existing.find((t) => t.presetKey === 'subscriptions') ??
		existing.find((t) => isSubscriptionTagName(t.name));
	if (found && (!found.isPreset || found.presetKey !== 'subscriptions')) {
		[found] = await tx
			.update(tags)
			.set({ isPreset: true, presetKey: 'subscriptions' })
			.where(eq(tags.id, found.id))
			.returning();
	}
	if (!found) {
		[found] = await tx
			.insert(tags)
			.values({
				userId,
				name: SUBSCRIPTION_TAG_NAME,
				color: '#8b5cf6',
				isPreset: true,
				presetKey: 'subscriptions'
			})
			.returning();
	}
	// Adopt existing explicitly tagged expenses and repair grouping after tag deletion.
	await tx
		.update(expenseStreams)
		.set({ isSubscription: true, subscriptionSince: today() })
		.where(
			and(
				eq(expenseStreams.userId, userId),
				eq(expenseStreams.tagId, found.id),
				eq(expenseStreams.isSubscription, false)
			)
		);
	await tx
		.update(expenseStreams)
		.set({ tagId: found.id })
		.where(
			and(
				eq(expenseStreams.userId, userId),
				eq(expenseStreams.isSubscription, true),
				or(isNull(expenseStreams.tagId), ne(expenseStreams.tagId, found.id))
			)
		);
	return found;
}

export async function ensureSubscriptionTag(userId: string): Promise<TagDto> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
		const existing = await tx.select().from(tags).where(eq(tags.userId, userId));
		return toTagDto(await ensureSubscriptionTagIn(tx, userId, existing));
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
