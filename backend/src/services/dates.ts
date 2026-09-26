const DAY_MS = 86_400_000;

export const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) =>
	toIso(new Date(toUtc(iso).getTime() + n * DAY_MS));
export const daysBetween = (from: string, to: string) =>
	Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
export const today = () => toIso(new Date());
