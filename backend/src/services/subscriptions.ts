import { and, eq } from 'drizzle-orm';
import {
	findLastSubscriptionDigest,
	saveSubscriptionDigest,
	withSubscriptionDigestLock
} from '../crud/subscription-digests.js';
import { db } from '../db/index.js';
import { expenseStreams } from '../db/tables.js';
import type { SubscriptionDigestDto } from '../schemas/subscriptions.js';
import { addDays, today } from './dates.js';

/** A digest goes out at most every 90 days, per the quarterly cleanup rhythm. */
export const SUBSCRIPTION_DIGEST_INTERVAL_DAYS = 90;

/** Normalize one charge to a monthly cost so weekly/yearly subs compare fairly. */
export function monthlyCentsFor(
	actualCents: number,
	intervalDays: number,
	recurrence: 'days' | 'monthly' | 'yearly' = 'days'
): number {
	if (recurrence === 'monthly') return actualCents;
	if (recurrence === 'yearly') return Math.round(actualCents / 12);
	if (intervalDays <= 0) return actualCents;
	return Math.round((actualCents * 365.2425) / 12 / intervalDays);
}

export async function listSubscriptionStreams(userId: string) {
	return db
		.select()
		.from(expenseStreams)
		.where(and(eq(expenseStreams.userId, userId), eq(expenseStreams.isSubscription, true)));
}

export async function getSubscriptionDigest(
	userId: string,
	from: string = today()
): Promise<SubscriptionDigestDto> {
	const [streams, last] = await Promise.all([
		listSubscriptionStreams(userId),
		findLastSubscriptionDigest(userId)
	]);
	const monthlyCents = streams.reduce(
		(sum, s) => sum + monthlyCentsFor(s.actualCents, s.intervalDays, s.recurrence),
		0
	);
	const lastSentOn = last?.sentOn ?? null;
	const since = streams.map((s) => s.subscriptionSince ?? from).sort()[0];
	const firstReviewOn = since ? addDays(since, SUBSCRIPTION_DIGEST_INTERVAL_DAYS) : null;
	const nextReviewOn =
		firstReviewOn && last?.nextReviewOn && last.nextReviewOn > firstReviewOn
			? last.nextReviewOn
			: firstReviewOn;
	const due = nextReviewOn !== null && nextReviewOn <= from;
	return { count: streams.length, monthlyCents, lastSentOn, nextReviewOn, due };
}

export async function dismissSubscriptionDigest(userId: string, from = today()) {
	await withSubscriptionDigestLock(userId, (tx) =>
		saveSubscriptionDigest(
			userId,
			{
				nextReviewOn: addDays(from, SUBSCRIPTION_DIGEST_INTERVAL_DAYS)
			},
			tx
		)
	);
}
