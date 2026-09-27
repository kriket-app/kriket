// A goal's words: pure functions of the API's numbers, with no Svelte.
import type { Goal } from '$lib/api/types';
import { formatDateWithYear, formatGoalDate, today } from '$lib/dates';
import { dollars, money } from '$lib/forecast-words';

export type GoalTone = 'over' | 'short' | 'none';

export function goalWords(
	goal: Goal,
	todayIso: string = today()
): { tone: GoalTone; text: string; note: string | null } {
	const { status, amountCents: target, targetDate } = goal;
	const date = formatGoalDate(targetDate, todayIso);
	if (status.state === 'past') {
		return {
			tone: 'none',
			text: `${date} has passed.`,
			note: 'Change the date or set a new goal.'
		};
	}
	if (status.state === 'beyond') {
		return {
			tone: 'none',
			text: `${formatDateWithYear(targetDate)} is more than a year away.`,
			note: 'kriket forecasts a year ahead, so it shows here once the date is closer.'
		};
	}
	const expected = status.expectedCents!;
	const worst = status.worstCents!;
	const best = status.bestCents!;
	if (expected > target) {
		return {
			tone: 'over',
			text: `Expected ${dollars(expected)} by ${date}, ${dollars(expected - target)} over your ${dollars(target)} goal.`,
			note:
				worst === best
					? null
					: worst >= target
						? 'Even the worst case gets there.'
						: `The worst case is ${dollars(target - worst)} short.`
		};
	}
	if (expected === target) {
		return {
			tone: 'over',
			text: `Expected ${dollars(expected)} by ${date}, right on your ${dollars(target)} goal.`,
			note:
				worst === best
					? null
					: worst >= target
						? 'Even the worst case gets there.'
						: `The worst case is ${dollars(target - worst)} short.`
		};
	}
	return {
		tone: 'short',
		text: `Expected ${dollars(expected)} by ${date}, ${dollars(target - expected)} short of your ${dollars(target)} goal.`,
		note:
			worst === best
				? null
				: best >= target
					? 'The best case gets there.'
					: `Even the best case is ${dollars(target - best)} short.`
	};
}

/** "≈ $42/mo for 3 months": the forecast-aware monthly figure, or null when it has none. */
export function monthlyWords(goal: Goal): string | null {
	const monthly = goal.status.monthlyNeededCents;
	if (monthly === null || monthly === undefined) return null;
	if (monthly === 0) return 'On track — no extra saving needed.';
	return `≈ ${money(monthly)}/mo to get there.`;
}

/**
 * Each goal is checked on its own against the same forecast balance, so two
 * goals can both read "over" while together they fall short. Shown whenever
 * more than one goal has a forecast to read.
 */
export function sharedBalanceNote(goals: Goal[]): string | null {
	const readable = goals.filter((goal) => goal.status.state === 'forecast').length;
	return readable >= 2
		? 'Each goal is checked against the same forecast balance, so two goals can both read over while together they fall short.'
		: null;
}
