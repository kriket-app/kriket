import type { ForecastDto, ForecastEventDto, ForecastPointDto } from '../schemas/forecast.js';
import { listCheckins } from '../crud/checkins.js';
import { expenseCrud, incomeCrud } from '../crud/streams.js';
import { NotFoundError } from './errors.js';
import { addDays, daysBetween, today } from './dates.js';

export type StreamInput = {
	id: string;
	name: string;
	tagId: string | null;
	minCents: number;
	actualCents: number;
	maxCents: number;
	intervalDays: number;
	firstDate: string;
};
export type ForecastInput = {
	startDate: string;
	days: number;
	startingBalanceCents: number;
	incomes: StreamInput[];
	expenses: StreamInput[];
};

export { addDays, daysBetween, today, toIso, toUtc } from './dates.js';

/** computeForecast's own shape, before the anchor and the below-zero summary are known. */
type ForecastCore = Omit<ForecastDto, 'checkin' | 'lowest' | 'firstBelowZero' | 'recoversOn'>;

/** Dates on which the stream pays inside [start, end], inclusive: firstDate + k * intervalDays, k >= 0. */
export function occurrences(
	stream: Pick<StreamInput, 'firstDate' | 'intervalDays'>,
	start: string,
	end: string
): string[] {
	const offset = daysBetween(stream.firstDate, start);
	let k = offset <= 0 ? 0 : Math.ceil(offset / stream.intervalDays);
	const out: string[] = [];
	for (;;) {
		const date = addDays(stream.firstDate, k * stream.intervalDays);
		if (date > end) return out;
		if (date >= start) out.push(date);
		k += 1;
	}
}

export function computeForecast(input: ForecastInput): ForecastCore {
	const endDate = addDays(input.startDate, input.days);
	const events: ForecastEventDto[] = [];
	const push = (kind: 'income' | 'expense', s: StreamInput) => {
		for (const date of occurrences(s, input.startDate, endDate)) {
			events.push({
				date,
				kind,
				streamId: s.id,
				name: s.name,
				tagId: s.tagId,
				minCents: s.minCents,
				actualCents: s.actualCents,
				maxCents: s.maxCents
			});
		}
	};
	input.incomes.forEach((s) => push('income', s));
	input.expenses.forEach((s) => push('expense', s));
	events.sort((a, b) =>
		a.date !== b.date
			? a.date < b.date
				? -1
				: 1
			: a.kind !== b.kind
				? a.kind === 'income'
					? -1
					: 1
				: a.name.localeCompare(b.name)
	);

	// Worst case: incomes at their minimum, expenses at their maximum. Best case: the reverse.
	let min = input.startingBalanceCents;
	let actual = input.startingBalanceCents;
	let max = input.startingBalanceCents;
	const points: ForecastPointDto[] = [];
	let next = 0;
	for (let day = 0; day <= input.days; day += 1) {
		const date = addDays(input.startDate, day);
		while (next < events.length && events[next].date === date) {
			const e = events[next];
			next += 1;
			if (e.kind === 'income') {
				min += e.minCents;
				actual += e.actualCents;
				max += e.maxCents;
			} else {
				min -= e.maxCents;
				actual -= e.actualCents;
				max -= e.minCents;
			}
		}
		points.push({ date, minCents: min, actualCents: actual, maxCents: max });
	}
	return {
		startDate: input.startDate,
		endDate,
		startingBalanceCents: input.startingBalanceCents,
		points,
		events,
		endBalance: { minCents: min, actualCents: actual, maxCents: max }
	};
}

/** A forecast whose points[0] is the check-in itself; events on its day are already in the balance. */
export function forecastFromCheckin(
	checkin: { balanceCents: number; checkedOn: string },
	days: number,
	incomes: StreamInput[],
	expenses: StreamInput[]
): ForecastCore {
	const rest = computeForecast({
		startDate: addDays(checkin.checkedOn, 1),
		days: days - 1,
		startingBalanceCents: checkin.balanceCents,
		incomes,
		expenses
	});
	const b = checkin.balanceCents;
	return {
		...rest,
		startDate: checkin.checkedOn,
		startingBalanceCents: b,
		points: [{ date: checkin.checkedOn, minCents: b, actualCents: b, maxCents: b }, ...rest.points]
	};
}

/** Drops everything before `from` (a roll-forward to today). */
export function trimForecast(f: ForecastCore, from: string): ForecastCore {
	return {
		...f,
		startDate: from,
		points: f.points.filter((p) => p.date >= from),
		events: f.events.filter((e) => e.date >= from)
	};
}

/**
 * The lowest expected point (earliest on ties), the first day under zero, and the first day after
 * that back at or above zero. `recoversOn` ends the first dip, even when a later one follows; it is
 * null when the balance never goes under zero or is still under at the last point.
 */
export function summarize(points: ForecastPointDto[]) {
	let lowest = points[0];
	let firstBelowZero: string | null = null;
	let recoversOn: string | null = null;
	for (const p of points) {
		if (p.actualCents < lowest.actualCents) lowest = p;
		if (p.actualCents < 0) firstBelowZero ??= p.date;
		else if (firstBelowZero && !recoversOn) recoversOn = p.date;
	}
	return {
		lowest: { date: lowest.date, cents: lowest.actualCents },
		firstBelowZero,
		recoversOn
	};
}

export async function getForecast(
	userId: string,
	days: number,
	checkinId?: string
): Promise<ForecastDto> {
	const [checkins, incomes, expenses] = await Promise.all([
		listCheckins(userId),
		incomeCrud.list(userId),
		expenseCrud.list(userId)
	]);

	let anchorRow: { id: string; balanceCents: number; checkedOn: string } | null = null;
	if (checkinId) {
		anchorRow = checkins.find((c) => c.id === checkinId) ?? null;
		if (!anchorRow) throw new NotFoundError('Checkin not found');
	} else if (checkins.length > 0) {
		anchorRow = checkins[checkins.length - 1];
	}
	const checkinDto = anchorRow
		? { id: anchorRow.id, balanceCents: anchorRow.balanceCents, checkedOn: anchorRow.checkedOn }
		: null;

	let forecast: ForecastCore;
	let endDate: string;
	if (checkinId) {
		// An older check-in: the forecast starts on its checkedOn and is not trimmed.
		const anchor = anchorRow!;
		forecast = forecastFromCheckin(anchor, days, incomes, expenses);
		endDate = forecast.endDate;
	} else if (anchorRow) {
		// The latest check-in: rolled forward so startDate = today() and endDate = today() + days.
		const totalDays = daysBetween(anchorRow.checkedOn, today()) + days;
		const full = forecastFromCheckin(anchorRow, totalDays, incomes, expenses);
		forecast = trimForecast(full, today());
		endDate = addDays(today(), days);
	} else {
		// No check-in at all: start from the beginning of today with a zero balance.
		forecast = computeForecast({
			startDate: today(),
			days,
			startingBalanceCents: 0,
			incomes,
			expenses
		});
		endDate = addDays(today(), days);
	}

	return { ...forecast, endDate, checkin: checkinDto, ...summarize(forecast.points) };
}
