// The overview's words for a forecast: pure functions of the API's numbers, with no Svelte, so
// what the page says can be checked by reading this file.
import type { components } from '$lib/api/schema';
import { formatDate } from '$lib/dates';
import { formatCents } from '$lib/money';

type Forecast = components['schemas']['Forecast'];
type Kind = 'income' | 'expense';

const MINUS = '−';

/** 4200 -> "$42.00", -4200 -> "−$42.00" (the minus sign U+2212, not a hyphen). */
export const money = (cents: number) => (cents < 0 ? MINUS : '') + formatCents(Math.abs(cents));

/** A change: 4200 -> "+$42.00", -4200 -> "−$42.00". */
export const signed = (cents: number) => (cents < 0 ? MINUS : '+') + formatCents(Math.abs(cents));

/** A payment: income -> "+$42.00", expense -> "−$42.00". */
export const amount = (kind: Kind, cents: number) =>
	(kind === 'income' ? '+' : MINUS) + formatCents(cents);

/** Whole dollars when the cents are 00: 25500 -> "$255", 25550 -> "$255.50". */
export const dollars = (cents: number) =>
	cents % 100 === 0 ? money(cents).slice(0, -3) : money(cents);

export type Answer = {
	/** `short` when the expected balance goes under zero, `ok` when it never does. */
	tone: 'short' | 'ok';
	headline: string;
	body: string;
};

/**
 * The answer to "am I going to be OK?" over the next `days` days: when and how far the expected
 * balance goes under zero, or that it never does. `lowest`, `firstBelowZero`, and `recoversOn`
 * (the end of the first dip) come from the API as they are; `points` only tells whether the
 * balance goes under again after that.
 */
export function forecastWords(
	forecast: Pick<Forecast, 'points' | 'lowest' | 'firstBelowZero' | 'recoversOn'>,
	days: number
): Answer {
	const { points, lowest, firstBelowZero, recoversOn } = forecast;
	if (firstBelowZero) {
		const dipsAgain =
			recoversOn !== null && points.some((p) => p.date > recoversOn && p.actualCents < 0);
		const until = !recoversOn
			? `and still under at the end of these ${days} days.`
			: dipsAgain
				? `until ${formatDate(recoversOn)}, and again later.`
				: `until ${formatDate(recoversOn)}.`;
		return {
			tone: 'short',
			headline: `You go ${dollars(Math.abs(lowest.cents))} short on ${formatDate(lowest.date)}.`,
			body: `You are under zero from ${formatDate(firstBelowZero)} ${until} Lowest point ${money(lowest.cents)}.`
		};
	}
	return {
		tone: 'ok',
		headline: `You stay above zero all ${days} days.`,
		body: `Lowest point ${money(lowest.cents)} on ${formatDate(lowest.date)}.`
	};
}

// An amount ("−$1,234.50", "+$5") or a short date ("Oct 1").
const UNBREAKABLE =
	/([−+]?\$[\d,]+(?:\.\d\d)?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2})/;

/**
 * `text` split so its amounts and dates can each be kept on one line (a minus sign never wraps
 * away from its number): the parts at odd indexes are the amounts and dates.
 */
export const unbreakableParts = (text: string) => text.split(UNBREAKABLE);
