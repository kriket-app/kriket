import { describe, expect, it } from 'vitest';
import {
	addDays,
	computeForecast,
	forecastFromCheckin,
	occurrences,
	summarize
} from './forecast.js';

const stream = (
	over: Partial<Parameters<typeof occurrences>[0]> & {
		id?: string;
		name?: string;
		tagId?: string | null;
		minCents?: number;
		actualCents?: number;
		maxCents?: number;
	} = {}
) => ({
	id: 's1',
	name: 'Pay',
	tagId: null,
	minCents: 80000,
	actualCents: 100000,
	maxCents: 120000,
	intervalDays: 30,
	firstDate: '2026-10-01',
	...over
});

describe('occurrences', () => {
	it('clamps monthly dates without drifting after February, including leap years', () => {
		expect(
			occurrences(
				stream({ firstDate: '2026-01-31', recurrence: 'monthly' }),
				'2026-01-01',
				'2026-05-31'
			)
		).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
		expect(
			occurrences(
				stream({ firstDate: '2024-01-30', recurrence: 'monthly' }),
				'2024-02-01',
				'2024-03-31'
			)
		).toEqual(['2024-02-29', '2024-03-30']);
	});
	it('restores leap day on yearly schedules and skips ahead across centuries correctly', () => {
		expect(
			occurrences(
				stream({ firstDate: '2024-02-29', recurrence: 'yearly' }),
				'2025-01-01',
				'2028-12-31'
			)
		).toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
		expect(
			occurrences(
				stream({ firstDate: '2000-02-29', recurrence: 'yearly' }),
				'2100-01-01',
				'2100-12-31'
			)
		).toEqual(['2100-02-28']);
	});
	it('honours calendar window boundaries and a future anchor', () => {
		const s = stream({ firstDate: '2026-12-31', recurrence: 'monthly' });
		expect(occurrences(s, '2026-01-01', '2026-12-30')).toEqual([]);
		expect(occurrences(s, '2027-02-28', '2027-03-31')).toEqual(['2027-02-28', '2027-03-31']);
		expect(occurrences(s, '2027-03-01', '2027-03-30')).toEqual([]);
	});
	it('starts at the first date when it is inside the window', () => {
		expect(occurrences(stream({ intervalDays: 14 }), '2026-09-26', '2026-10-31')).toEqual([
			'2026-10-01',
			'2026-10-15',
			'2026-10-29'
		]);
	});
	it('skips ahead when the first date is years in the past, without walking day by day', () => {
		expect(
			occurrences(stream({ firstDate: '2020-01-01', intervalDays: 7 }), '2026-09-28', '2026-10-12')
		).toEqual(['2026-09-30', '2026-10-07']);
	});
	it('includes both window edges', () => {
		expect(
			occurrences(stream({ firstDate: '2026-09-26', intervalDays: 30 }), '2026-09-26', '2026-10-26')
		).toEqual(['2026-09-26', '2026-10-26']);
	});
	it('is empty when the first date is after the window', () => {
		expect(occurrences(stream({ firstDate: '2027-01-01' }), '2026-09-26', '2026-12-25')).toEqual(
			[]
		);
	});
});

describe('computeForecast', () => {
	it('deducts calendar expenses once per month in all forecast cases', () => {
		const f = computeForecast({
			startDate: '2026-02-01',
			days: 58,
			startingBalanceCents: 10000,
			incomes: [],
			expenses: [
				stream({
					firstDate: '2026-01-31',
					recurrence: 'monthly',
					minCents: 800,
					actualCents: 1000,
					maxCents: 1200
				})
			]
		});
		expect(f.events.map((e) => e.date)).toEqual(['2026-02-28', '2026-03-31']);
		expect(f.endBalance).toEqual({ minCents: 7600, actualCents: 8000, maxCents: 8400 });
	});
	it('walks worst, actual, and best balances day by day', () => {
		const f = computeForecast({
			startDate: '2026-09-26',
			days: 60,
			startingBalanceCents: 10000,
			incomes: [stream({ firstDate: '2026-09-26' })],
			expenses: [
				stream({
					id: 'e1',
					name: 'Rent',
					minCents: 50000,
					actualCents: 50000,
					maxCents: 50000,
					firstDate: '2026-10-01'
				})
			]
		});
		expect(f.points).toHaveLength(61);
		expect(f.endDate).toBe(addDays('2026-09-26', 60));
		// income on days 0, 30, 60; rent on Oct 1 and Oct 31
		expect(f.endBalance).toEqual({
			minCents: 10000 + 3 * 80000 - 2 * 50000,
			actualCents: 10000 + 3 * 100000 - 2 * 50000,
			maxCents: 10000 + 3 * 120000 - 2 * 50000
		});
		expect(f.points[0]).toEqual({
			date: '2026-09-26',
			minCents: 90000,
			actualCents: 110000,
			maxCents: 130000
		});
		expect(f.events.map((e) => `${e.date} ${e.kind}`)).toEqual([
			'2026-09-26 income',
			'2026-10-01 expense',
			'2026-10-26 income',
			'2026-10-31 expense',
			'2026-11-25 income'
		]);
	});
	it('uses expense maximums in the worst case and minimums in the best case', () => {
		const f = computeForecast({
			startDate: '2026-09-26',
			days: 7,
			startingBalanceCents: 0,
			incomes: [],
			expenses: [
				stream({ firstDate: '2026-09-27', minCents: 100, actualCents: 200, maxCents: 300 })
			]
		});
		expect(f.endBalance).toEqual({ minCents: -300, actualCents: -200, maxCents: -100 });
	});
});

describe('forecastFromCheckin', () => {
	it('puts the check-in first and skips events on its own day', () => {
		const f = forecastFromCheckin(
			{ balanceCents: 43000, checkedOn: '2026-09-26' },
			7,
			[stream({ firstDate: '2026-09-26', intervalDays: 30 })],
			[]
		);
		expect(f.points[0]).toEqual({
			date: '2026-09-26',
			minCents: 43000,
			actualCents: 43000,
			maxCents: 43000
		});
		// The income also lands on 2026-09-26, but it's already folded into the check-in balance,
		// so it must not show up as an event or move the first point.
		expect(f.events).toHaveLength(0);
		expect(f.startDate).toBe('2026-09-26');
		expect(f.startingBalanceCents).toBe(43000);
	});
});

describe('summarize', () => {
	const points = (values: number[], startDate = '2026-09-26') =>
		values.map((cents, i) => ({
			date: addDays(startDate, i),
			minCents: cents,
			actualCents: cents,
			maxCents: cents
		}));

	it('finds the lowest point, first dip below zero, and the day it recovers', () => {
		const s = summarize(points([100, -50, -200, -10, 30]));
		expect(s.lowest).toEqual({ date: addDays('2026-09-26', 2), cents: -200 });
		expect(s.firstBelowZero).toBe(addDays('2026-09-26', 1));
		expect(s.recoversOn).toBe(addDays('2026-09-26', 4));
	});
	it('ends recoversOn at the first dip when the balance dips again later', () => {
		const s = summarize(points([100, -50, 20, 40, -300, -10, 50]));
		expect(s.lowest).toEqual({ date: addDays('2026-09-26', 4), cents: -300 });
		expect(s.firstBelowZero).toBe(addDays('2026-09-26', 1));
		expect(s.recoversOn).toBe(addDays('2026-09-26', 2));
	});
	it('counts a balance of exactly zero as recovered', () => {
		const s = summarize(points([100, -50, 0, -20]));
		expect(s.recoversOn).toBe(addDays('2026-09-26', 2));
	});
	it('gives recoversOn null when the series ends below zero', () => {
		const s = summarize(points([100, -50, -200]));
		expect(s.firstBelowZero).toBe(addDays('2026-09-26', 1));
		expect(s.recoversOn).toBeNull();
	});
	it('gives both null when the series never dips below zero', () => {
		const s = summarize(points([100, 50, 200]));
		expect(s.firstBelowZero).toBeNull();
		expect(s.recoversOn).toBeNull();
	});
});
