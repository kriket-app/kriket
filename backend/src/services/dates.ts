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
