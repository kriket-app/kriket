import { describe, expect, it } from 'vitest';
import { monthEnd, monthStart } from './dates.js';

describe('monthStart', () => {
	it('is always the first of the month', () => {
		expect(monthStart('2026-10')).toBe('2026-10-01');
	});
});

describe('monthEnd', () => {
	it('gives the 31st for a 31-day month', () => {
		expect(monthEnd('2026-10')).toBe('2026-10-31');
	});
	it('gives the 30th for a 30-day month', () => {
		expect(monthEnd('2026-09')).toBe('2026-09-30');
	});
	it('gives the 29th for February in a leap year', () => {
		expect(monthEnd('2028-02')).toBe('2028-02-29');
	});
	it('gives the 28th for February in a non-leap year', () => {
		expect(monthEnd('2026-02')).toBe('2026-02-28');
	});
	it('rolls December into January of the next year', () => {
		expect(monthEnd('2026-12')).toBe('2026-12-31');
	});
});
