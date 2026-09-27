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
