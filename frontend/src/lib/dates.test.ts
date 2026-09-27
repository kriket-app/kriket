import { describe, expect, it } from 'vitest';
import { nextOccurrence, repeatText } from './dates';

describe('calendar recurrence displayed on stream cards', () => {
	it.each([
		['2026-01-31', '2026-02-01', 'monthly', '2026-02-28'],
		['2026-01-31', '2026-02-28', 'monthly', '2026-02-28'],
		['2026-01-31', '2026-03-01', 'monthly', '2026-03-31'],
		['2024-01-30', '2024-02-01', 'monthly', '2024-02-29'],
		['2026-12-31', '2026-01-01', 'monthly', '2026-12-31'],
		['2024-02-29', '2025-02-28', 'yearly', '2025-02-28'],
		['2024-02-29', '2027-03-01', 'yearly', '2028-02-29'],
		['2000-02-29', '2100-01-01', 'yearly', '2100-02-28']
	] as const)('%s from %s (%s) is %s', (anchor, from, recurrence, expected) => {
		expect(nextOccurrence(anchor, 30, from, recurrence)).toBe(expected);
	});
	it('keeps fixed day schedules distinct from calendar months', () => {
		expect(nextOccurrence('2026-01-31', 30, '2026-02-01')).toBe('2026-03-02');
		expect(repeatText(30)).toBe('every 30 days');
		expect(repeatText(30, 'monthly')).toBe('monthly');
		expect(repeatText(365, 'yearly')).toBe('yearly');
	});
});
