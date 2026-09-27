const DAY_MS = 86_400_000;

export const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) =>
	toIso(new Date(toUtc(iso).getTime() + n * DAY_MS));
export const daysBetween = (from: string, to: string) =>
	Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
// Fixed to the team's timezone for now, so "today" doesn't roll over to tomorrow (UTC) hours
// before evening in Saskatoon.
export const today = () =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Regina',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());

/** "2026-09" -> "2026-10", "2026-12" -> "2027-01": string arithmetic, no calendar math needed. */
const nextMonth = (month: string): string => {
	const [year, monthNum] = month.split('-').map(Number);
	return monthNum === 12 ? `${year + 1}-01` : `${year}-${String(monthNum + 1).padStart(2, '0')}`;
};
/** The first day of a "YYYY-MM" month. */
export const monthStart = (month: string): string => `${month}-01`;
/** The last day of a "YYYY-MM" month: the day before the next month's first day. */
export const monthEnd = (month: string): string => addDays(monthStart(nextMonth(month)), -1);

const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Whole calendar months from `from` to `to`, minimum 1: the number of monthly
 * saves between the two dates. Same month -> 1, Jan 15 -> Feb 14 is 1,
 * Jan 15 -> Mar 15 is 2. Month ends count as whole months, so Mar 31 -> Jun 30
 * is 3 (April, May, June), not 2.
 */
export const monthsBetween = (from: string, to: string): number => {
	const [fromY, fromM, fromD] = from.split('-').map(Number);
	const [toY, toM, toD] = to.split('-').map(Number);
	const fromIsEnd = fromD === lastDayOf(fromY, fromM);
	const toIsEnd = toD === lastDayOf(toY, toM);
	const months =
		(toY - fromY) * 12 + (toM - fromM) + (toD >= fromD || (toIsEnd && fromIsEnd) ? 0 : -1);
	return Math.max(1, months);
};
