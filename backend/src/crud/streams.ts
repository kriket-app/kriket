import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { expenseStreams, incomeStreams } from '../db/tables.js';

export type StreamRow = typeof incomeStreams.$inferSelect;
export type StreamInsert = Omit<typeof incomeStreams.$inferInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export function streamCrud(kind: 'income' | 'expense') {
	const table = (kind === 'income' ? incomeStreams : expenseStreams) as typeof incomeStreams;
	return {
		list: (userId: string): Promise<StreamRow[]> =>
			db.select().from(table).where(eq(table.userId, userId)).orderBy(asc(table.firstDate), asc(table.name)),
		async find(userId: string, id: string): Promise<StreamRow | null> {
			const [row] = await db.select().from(table).where(and(eq(table.id, id), eq(table.userId, userId)));
			return row ?? null;
		},
		async insert(userId: string, values: StreamInsert): Promise<StreamRow> {
			const [row] = await db.insert(table).values({ ...values, userId }).returning();
			return row;
		},
		async update(userId: string, id: string, patch: Partial<StreamInsert>): Promise<StreamRow | null> {
			const [row] = await db.update(table).set(patch).where(and(eq(table.id, id), eq(table.userId, userId))).returning();
			return row ?? null;
		},
		async remove(userId: string, id: string): Promise<boolean> {
			const rows = await db.delete(table).where(and(eq(table.id, id), eq(table.userId, userId))).returning({ id: table.id });
			return rows.length > 0;
		}
	};
}
export const incomeCrud = streamCrud('income');
export const expenseCrud = streamCrud('expense');
