import { sql } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { user } from './schema.js';

const idColumn = () =>
	text('id')
		.primaryKey()
		.default(sql`gen_random_uuid()`);
const userIdColumn = () =>
	text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });
const timestamps = () => ({
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const tags = pgTable(
	'tags',
	{
		id: idColumn(),
		userId: userIdColumn(),
		name: text('name').notNull(),
		color: text('color'),
		isPreset: boolean('is_preset').default(false).notNull(),
		presetKey: text('preset_key', { enum: ['subscriptions'] }),
		...timestamps()
	},
	(t) => [
		index('tags_user_idx').on(t.userId),
		uniqueIndex('tags_user_preset_idx').on(t.userId, t.presetKey)
	]
);

// Income and expense streams have the same shape; two tables keep the queries and the
// foreign keys simple. Amounts are integer cents; 0 <= min <= actual <= max is enforced in the service.
// `isSubscription` marks an expense stream as a subscription (income rows always stay false);
// the Subscriptions preset tag groups them visually while the flag drives reminders.
const streamColumns = () => ({
	id: idColumn(),
	userId: userIdColumn(),
	name: text('name').notNull(),
	tagId: text('tag_id').references(() => tags.id, { onDelete: 'set null' }),
	minCents: integer('min_cents').notNull(),
	maxCents: integer('max_cents').notNull(),
	actualCents: integer('actual_cents').notNull(),
	intervalDays: integer('interval_days').notNull(),
	// Calendar schedules use firstDate's day as an anchor; intervalDays is only used for 'days'.
	recurrence: text('recurrence', { enum: ['days', 'monthly', 'yearly'] })
		.default('days')
		.notNull(),
	firstDate: date('first_date', { mode: 'string' }).notNull(),
	isSubscription: boolean('is_subscription').default(false).notNull(),
	subscriptionSince: date('subscription_since', { mode: 'string' }),
	...timestamps()
});
export const incomeStreams = pgTable('income_streams', streamColumns(), (t) => [
	index('income_streams_user_idx').on(t.userId)
]);
export const expenseStreams = pgTable('expense_streams', streamColumns(), (t) => [
	index('expense_streams_user_idx').on(t.userId)
]);

export const balanceCheckins = pgTable(
	'balance_checkins',
	{
		id: idColumn(),
		userId: userIdColumn(),
		balanceCents: integer('balance_cents').notNull(),
		checkedOn: date('checked_on', { mode: 'string' }).notNull(),
		...timestamps()
	},
	(t) => [uniqueIndex('balance_checkins_user_day_idx').on(t.userId, t.checkedOn)]
);

// One row per browser/device a user enables notifications on. `endpoint` is
// globally unique per the Push API; re-subscribing from the same browser
// upserts instead of duplicating.
export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: idColumn(),
		userId: userIdColumn(),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		userAgent: text('user_agent'),
		...timestamps()
	},
	(t) => [index('push_subscriptions_user_idx').on(t.userId)]
);

// The last low-balance heads-up sent to a user, one row per user. The alert sweep runs through
// the day; this row makes it send each dip once and at most one alert a day.
export const forecastAlerts = pgTable('forecast_alerts', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	// The first day the expected balance is below zero, as forecast when the alert went out.
	dipDate: date('dip_date', { mode: 'string' }).notNull(),
	// The day the alert went out, in the app's timezone (services/dates.ts).
	sentOn: date('sent_on', { mode: 'string' }).notNull(),
	...timestamps()
});

// One row per user tracking legal consent and the first-run walkthrough. A missing
// row means the user has never seen onboarding: consent is required before anything
// else, and the walkthrough replays from settings by clearing onboardingCompletedAt.
export const userOnboarding = pgTable('user_onboarding', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	privacyVersion: text('privacy_version'),
	termsVersion: text('terms_version'),
	privacyAcceptedAt: timestamp('privacy_accepted_at'),
	termsAcceptedAt: timestamp('terms_accepted_at'),
	onboardingCompletedAt: timestamp('onboarding_completed_at'),
	...timestamps()
});

export type UserOnboardingRow = typeof userOnboarding.$inferSelect;

// Delivery and acknowledgement are separate: a push never hides an unanswered review.
export const subscriptionDigests = pgTable('subscription_digests', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	sentOn: date('sent_on', { mode: 'string' }),
	nextReviewOn: date('next_review_on', { mode: 'string' }).notNull(),
	lastAttemptOn: date('last_attempt_on', { mode: 'string' }),
	...timestamps()
});

// Goals are balances to reach on a date, not money set aside: the forecast is
// unchanged and the status compares the forecast's point on targetDate.
// Multiple goals per user; the overview shows the closest three by date.
export const goals = pgTable(
	'goals',
	{
		id: idColumn(),
		userId: userIdColumn(),
		name: text('name').notNull(),
		description: text('description'),
		amountCents: integer('amount_cents').notNull(),
		targetDate: date('target_date', { mode: 'string' }).notNull(),
		...timestamps()
	},
	(t) => [index('goals_user_idx').on(t.userId)]
);
