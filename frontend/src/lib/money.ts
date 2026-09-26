const fmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
export const formatCents = (cents: number) => fmt.format(cents / 100);
/** "1,234.50" or "$1234" -> 123450; null when it is not a number. */
export function parseDollars(input: string): number | null {
	const cleaned = input.replace(/[$,\s]/g, '');
	if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return null;
	return Math.round(Number(cleaned) * 100);
}
export const formatRange = (minCents: number, actualCents: number, maxCents: number) =>
	minCents === maxCents
		? formatCents(actualCents)
		: `${formatCents(minCents)} to ${formatCents(maxCents)}, usually ${formatCents(actualCents)}`;
