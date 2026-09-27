import type { CheckinRow } from '../crud/checkins.js';
import { listCheckins, upsertCheckin } from '../crud/checkins.js';
import { expenseCrud, incomeCrud } from '../crud/streams.js';
import type { CheckinDto } from '../schemas/checkins.js';
import { addDays, occurrences, today } from './forecast.js';

const toCheckinDto = (
	row: CheckinRow,
	expectedCents: number | null,
	differenceCents: number | null
): CheckinDto => ({
	id: row.id,
	balanceCents: row.balanceCents,
	checkedOn: row.checkedOn,
	createdAt: row.createdAt.toISOString(),
	expectedCents,
	differenceCents
});

/** oldest-first rows, each carrying what the previous check-in and the streams since predicted. */
async function withExpected(userId: string, rows: CheckinRow[]): Promise<CheckinDto[]> {
	const [incomes, expenses] = await Promise.all([
		incomeCrud.list(userId),
		expenseCrud.list(userId)
	]);
	return rows.map((row, i) => {
		if (i === 0) return toCheckinDto(row, null, null);
		const previous = rows[i - 1];
		const start = addDays(previous.checkedOn, 1);
		const end = row.checkedOn;
		let expectedCents = previous.balanceCents;
		for (const s of incomes) expectedCents += occurrences(s, start, end).length * s.actualCents;
		for (const s of expenses) expectedCents -= occurrences(s, start, end).length * s.actualCents;
		return toCheckinDto(row, expectedCents, row.balanceCents - expectedCents);
	});
}

export async function listCheckinsWithExpected(userId: string): Promise<CheckinDto[]> {
	const rows = await listCheckins(userId);
	const withExp = await withExpected(userId, rows);
	return [...withExp].reverse();
}

export async function saveCheckin(userId: string, balanceCents: number): Promise<CheckinDto> {
	const row = await upsertCheckin(userId, balanceCents, today());
	const rows = await listCheckins(userId);
	const withExp = await withExpected(userId, rows);
	const found = withExp.find((c) => c.id === row.id);
	// The row we just wrote is always present in the list we just re-read.
	return found!;
}
