import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
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
		...timestamps()
	},
	(t) => [index('tags_user_idx').on(t.userId)]
);

// Income and expense streams have the same shape; two tables keep the queries and the
// foreign keys simple. Amounts are integer cents; 0 <= min <= actual <= max is enforced in the service.
const streamColumns = () => ({
	id: idColumn(),
	userId: userIdColumn(),
	name: text('name').notNull(),
	tagId: text('tag_id').references(() => tags.id, { onDelete: 'set null' }),
	minCents: integer('min_cents').notNull(),
	maxCents: integer('max_cents').notNull(),
	actualCents: integer('actual_cents').notNull(),
	intervalDays: integer('interval_days').notNull(),
	firstDate: date('first_date', { mode: 'string' }).notNull(),
	...timestamps()
});
export const incomeStreams = pgTable('income_streams', streamColumns(), (t) => [
	index('income_streams_user_idx').on(t.userId)
]);
export const expenseStreams = pgTable('expense_streams', streamColumns(), (t) => [
	index('expense_streams_user_idx').on(t.userId)
]);

export const userSettings = pgTable('user_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	startingBalanceCents: integer('starting_balance_cents').default(0).notNull(),
	startingDate: date('starting_date', { mode: 'string' }).notNull(),
	...timestamps()
});

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
