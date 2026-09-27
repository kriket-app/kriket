import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { subscriptionDigests } from '../db/tables.js';

type Executor = Pick<typeof db, 'select' | 'insert'>;

export async function findLastSubscriptionDigest(userId: string, executor: Executor = db) {
	const [row] = await executor
		.select()
		.from(subscriptionDigests)
		.where(eq(subscriptionDigests.userId, userId));
	return row ?? null;
}

export async function saveSubscriptionDigest(
	userId: string,
	values: Omit<typeof subscriptionDigests.$inferInsert, 'userId' | 'createdAt' | 'updatedAt'>,
	executor: Executor = db
) {
	await executor
		.insert(subscriptionDigests)
		.values({ userId, ...values })
		.onConflictDoUpdate({ target: subscriptionDigests.userId, set: values });
}

// All send/dismiss operations use the same database lock, including across server instances.
export async function withSubscriptionDigestLock<T>(
	userId: string,
	run: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
) {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${'subscription-digest:' + userId}))`
		);
		return run(tx);
	});
}
