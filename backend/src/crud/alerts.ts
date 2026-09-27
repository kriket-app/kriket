import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { forecastAlerts } from '../db/tables.js';

export async function findLastAlert(userId: string) {
	const [row] = await db.select().from(forecastAlerts).where(eq(forecastAlerts.userId, userId));
	return row ?? null;
}

export async function recordAlert(userId: string, dipDate: string, sentOn: string) {
	await db
		.insert(forecastAlerts)
		.values({ userId, dipDate, sentOn })
		.onConflictDoUpdate({ target: forecastAlerts.userId, set: { dipDate, sentOn } });
}
