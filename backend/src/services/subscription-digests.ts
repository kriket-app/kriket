import {
	findLastSubscriptionDigest,
	saveSubscriptionDigest,
	withSubscriptionDigestLock
} from '../crud/subscription-digests.js';
import { listUserIdsWithSubscriptions } from '../crud/push.js';
import { logger } from '../logger.js';
import { daysBetween, today } from './dates.js';
import { inAlertHours } from './alerts.js';
import { pushEnabled, sendToUser, type PushPayload } from './push.js';
import { getSubscriptionDigest, SUBSCRIPTION_DIGEST_INTERVAL_DAYS } from './subscriptions.js';

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export function describeSubscriptionDigest(count: number, monthlyCents: number): PushPayload {
	return {
		title: 'krr krr krr… subscription cleanup?',
		body: `Still using ${count === 1 ? 'that subscription' : `all ${count} subscriptions`}? About ${money.format(monthlyCents / 100)}/month. Give them a two-minute cleanup.`,
		url: '/app/expenses?filter=subscriptions'
	};
}

async function digestUser(userId: string, from: string) {
	return withSubscriptionDigestLock(userId, async (tx) => {
		const digest = await getSubscriptionDigest(userId, from);
		const last = await findLastSubscriptionDigest(userId, tx);
		if (
			!digest.due ||
			!digest.nextReviewOn ||
			last?.lastAttemptOn === from ||
			(last?.sentOn && daysBetween(last.sentOn, from) < SUBSCRIPTION_DIGEST_INTERVAL_DAYS)
		)
			return false;
		// Persist the attempt even on failure: at most one retry per day, across restarts.
		await saveSubscriptionDigest(
			userId,
			{ nextReviewOn: digest.nextReviewOn, lastAttemptOn: from },
			tx
		);
		try {
			const result = await sendToUser(
				userId,
				describeSubscriptionDigest(digest.count, digest.monthlyCents),
				{
					ttlSeconds: 24 * 60 * 60,
					topic: 'subscription-digest'
				}
			);
			if (result.sent === 0) return false;
			await saveSubscriptionDigest(userId, { nextReviewOn: digest.nextReviewOn, sentOn: from }, tx);
			return true;
		} catch (error) {
			logger.error({ userId, err: error }, 'Subscription digest delivery failed');
			return false;
		}
	});
}

export async function sweepSubscriptionDigests(from: string = today()) {
	if (!pushEnabled()) return { checked: 0, reminded: 0, failed: 0 };
	const userIds = await listUserIdsWithSubscriptions();
	let reminded = 0;
	let failed = 0;
	for (const userId of userIds) {
		try {
			if (await digestUser(userId, from)) reminded += 1;
		} catch (error) {
			failed += 1;
			logger.error({ userId, err: error }, 'Subscription digest check failed');
		}
	}
	return { checked: userIds.length, reminded, failed };
}

export function startSubscriptionDigests() {
	let running = false;
	const tick = async () => {
		if (running || !pushEnabled() || !inAlertHours(new Date())) return;
		running = true;
		try {
			const result = await sweepSubscriptionDigests();
			if (result.checked) logger.info(result, 'Subscription digest sweep finished');
		} catch (error) {
			logger.error({ err: error }, 'Subscription digest sweep failed');
		} finally {
			running = false;
		}
	};
	const timer = setInterval(() => void tick(), 15 * 60 * 1000);
	timer.unref();
	void tick();
	return () => clearInterval(timer);
}
