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
export function nextOccurrence(firstDate: string, intervalDays: number, from = today()) {
	const daysBehind = Math.round((toUtc(from).getTime() - toUtc(firstDate).getTime()) / DAY_MS);
	if (daysBehind <= 0) return firstDate;
	const intervals = Math.ceil(daysBehind / intervalDays);
	return toIso(new Date(toUtc(firstDate).getTime() + intervals * intervalDays * DAY_MS));
}

/** "daily", "weekly", "every 2 weeks", "monthly" for the intervals people actually use, else "every N days". */
export const repeatText = (intervalDays: number): string =>
	intervalDays === 1
		? 'daily'
		: intervalDays === 7
			? 'weekly'
			: intervalDays === 14
				? 'every 2 weeks'
				: intervalDays === 30
					? 'monthly'
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

/** Whole calendar months from `from` to `to`, minimum 1 (mirrors the backend, month ends included). */
export const monthsBetween = (from: string, to: string): number => {
	const [fromY, fromM, fromD] = from.split('-').map(Number);
	const [toY, toM, toD] = to.split('-').map(Number);
	const fromIsEnd = fromD === lastDayOf(fromY, fromM);
	const toIsEnd = toD === lastDayOf(toY, toM);
	return Math.max(
		1,
		(toY - fromY) * 12 + (toM - fromM) + (toD >= fromD || (toIsEnd && fromIsEnd) ? 0 : -1)
	);
};
