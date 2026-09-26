import type { ForecastDto, ForecastEventDto, ForecastPointDto } from '../schemas/forecast.js';
import { expenseCrud, incomeCrud } from '../crud/streams.js';
import { addDays, daysBetween } from './dates.js';
import { getSettings } from './settings.js';

export type StreamInput = {
	id: string;
	name: string;
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

export function computeForecast(input: ForecastInput): ForecastDto {
	const endDate = addDays(input.startDate, input.days);
	const events: ForecastEventDto[] = [];
	const push = (kind: 'income' | 'expense', s: StreamInput) => {
		for (const date of occurrences(s, input.startDate, endDate)) {
			events.push({
				date,
				kind,
				streamId: s.id,
				name: s.name,
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

export async function getForecast(userId: string, days: number): Promise<ForecastDto> {
	const [settings, incomes, expenses] = await Promise.all([
		getSettings(userId),
		incomeCrud.list(userId),
		expenseCrud.list(userId)
	]);
	return computeForecast({
		startDate: settings.startingDate,
		days,
		startingBalanceCents: settings.startingBalanceCents,
		incomes,
		expenses
	});
}
