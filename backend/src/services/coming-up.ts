import { listCheckins } from '../crud/checkins.js';
import { expenseCrud, incomeCrud } from '../crud/streams.js';
import type { ComingUpDto, ComingUpEventDto } from '../schemas/coming-up.js';
import { InvalidInputError } from './errors.js';
import { monthEnd, monthStart } from './dates.js';
import { addDays, daysBetween, getForecast, occurrences, today } from './forecast.js';

function monthOf(date: string): string {
	return date.slice(0, 7);
}

export async function getComingUp(userId: string, month?: string): Promise<ComingUpDto> {
	const [checkins, incomes, expenses] = await Promise.all([
		listCheckins(userId),
		incomeCrud.list(userId),
		expenseCrud.list(userId)
	]);
	const t = today();
	const firstMonth = checkins.length > 0 ? monthOf(checkins[0].checkedOn) : monthOf(t);
	const lastMonth = monthOf(addDays(t, 365));
	const targetMonth = month ?? monthOf(t);
	if (targetMonth < firstMonth || targetMonth > lastMonth) {
		throw new InvalidInputError('Invalid request', [
			{ path: 'month', message: 'outside the range of months this account can show' }
		]);
	}
	const start = monthStart(targetMonth);
	const end = monthEnd(targetMonth);

	type Ev = ComingUpEventDto & { date: string };
	const events: Ev[] = [];
	const push = (kind: 'income' | 'expense', rows: (typeof incomes)[number][]) => {
		for (const s of rows) {
			for (const date of occurrences(s, start, end)) {
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
		}
	};
	push('income', incomes);
	push('expense', expenses);
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

	const settledThrough = checkins.at(-1)?.checkedOn;
	const settled = (d: string) => d < t || (settledThrough !== undefined && d <= settledThrough);

	const byDate = new Map<string, Ev[]>();
	for (const e of events) {
		const list = byDate.get(e.date);
		if (list) list.push(e);
		else byDate.set(e.date, [e]);
	}
	const days = [...byDate.entries()].map(([date, evs]) => ({
		date,
		past: settled(date),
		events: evs.map(({ date: _date, ...rest }) => rest)
	}));

	let inCents = 0;
	let outCents = 0;
	for (const e of events) {
		if (settled(e.date)) continue;
		if (e.kind === 'income') inCents += e.actualCents;
		else outCents += e.actualCents;
	}

	let endBalanceCents: number | null = null;
	if (end >= t) {
		const forecast = await getForecast(userId, Math.max(7, daysBetween(t, end)));
		const point = forecast.points.find((p) => p.date === end);
		endBalanceCents = point ? point.actualCents : null;
	}

	return {
		month: targetMonth,
		today: t,
		firstMonth,
		lastMonth,
		days,
		inCents,
		outCents,
		endBalanceCents
	};
}
