// Dates are YYYY-MM-DD strings, and all the math is in UTC, as in the backend.
const DAY_MS = 86_400_000;
const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
// Fixed to the team's timezone for now, so "today" doesn't roll over to tomorrow (UTC) hours
// before evening in Saskatoon.
export const today = () =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Regina',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());

/**
 * The first payment on or after `from`: `firstDate` plus a whole number of intervals, the rule the
 * backend's forecast uses. Jumps straight there, however far in the past `firstDate` is.
 */
export type Recurrence = 'days' | 'monthly' | 'yearly';

// Mirrors backend/services/dates.ts; always clamp from the original anchor.
export function addCalendarMonths(anchor: string, months: number): string {
	const date = toUtc(anchor);
	const day = date.getUTCDate();
	date.setUTCDate(1);
	date.setUTCMonth(date.getUTCMonth() + months);
	const end = new Date(date);
	end.setUTCMonth(end.getUTCMonth() + 1, 0);
	date.setUTCDate(Math.min(day, end.getUTCDate()));
	return toIso(date);
}

export function nextOccurrence(
	firstDate: string,
	intervalDays: number,
	from = today(),
	recurrence: Recurrence = 'days'
) {
	const months = recurrence === 'monthly' ? 1 : recurrence === 'yearly' ? 12 : 0;
	if (months) {
		const difference =
			(Number(from.slice(0, 4)) - Number(firstDate.slice(0, 4))) * 12 +
			Number(from.slice(5, 7)) -
			Number(firstDate.slice(5, 7));
		let k = Math.max(0, Math.floor(difference / months));
		let next = addCalendarMonths(firstDate, k * months);
		if (next < from) next = addCalendarMonths(firstDate, ++k * months);
		return next;
	}
	const daysBehind = Math.round((toUtc(from).getTime() - toUtc(firstDate).getTime()) / DAY_MS);
	if (daysBehind <= 0) return firstDate;
	const intervals = Math.ceil(daysBehind / intervalDays);
	return toIso(new Date(toUtc(firstDate).getTime() + intervals * intervalDays * DAY_MS));
}

/** Fixed-day schedules never masquerade as calendar months or years. */
export const repeatText = (intervalDays: number, recurrence: Recurrence = 'days'): string =>
	recurrence === 'monthly'
		? 'monthly'
		: recurrence === 'yearly'
			? 'yearly'
			: intervalDays === 1
				? 'daily'
				: intervalDays === 7
					? 'weekly'
					: intervalDays === 14
						? 'every 2 weeks'
						: `every ${intervalDays} days`;

const dayFormat = new Intl.DateTimeFormat('en-CA', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});
/** "2026-10-01" -> "Oct 1". */
export const formatDate = (iso: string) => dayFormat.format(toUtc(iso));

const dayYearFormat = new Intl.DateTimeFormat('en-CA', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC'
});
/** "2027-12-20" -> "Dec 20, 2027". */
export const formatDateWithYear = (iso: string) => dayYearFormat.format(toUtc(iso));

/** "Dec 20" when the date is this year, "Dec 20, 2027" when it is not: goals reach 366 days out. */
export const formatGoalDate = (iso: string, todayIso: string = today()) =>
	iso.slice(0, 4) === todayIso.slice(0, 4) ? formatDate(iso) : formatDateWithYear(iso);

export const addDays = (iso: string, n: number) =>
	toIso(new Date(toUtc(iso).getTime() + n * DAY_MS));

const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Whole calendar months from `from` to `to`, minimum 1 (mirrors the backend: a month-end `to` counts in full). */
export const monthsBetween = (from: string, to: string): number => {
	const [fromY, fromM, fromD] = from.split('-').map(Number);
	const [toY, toM, toD] = to.split('-').map(Number);
	const toIsEnd = toD === lastDayOf(toY, toM);
	return Math.max(1, (toY - fromY) * 12 + (toM - fromM) + (toD >= fromD || toIsEnd ? 0 : -1));
};
