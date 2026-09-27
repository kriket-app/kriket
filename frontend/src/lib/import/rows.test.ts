import { describe, expect, it } from 'vitest';
import { rowsFromItems } from './rows';
import type { TextItem } from './types';

const item = (str: string, x: number, y: number, rotated = false): TextItem => ({
	str,
	x,
	y,
	width: str.length * 4,
	rotated
});

describe('rowsFromItems', () => {
	it('joins items whose y differs by the jitter of one printed line, left to right', () => {
		// The Scotiabank sample: date at 581.0, amount at 580.6, balance at 582.0, memo 9 pt lower.
		const rows = rowsFromItems([
			item('12,406.49', 396, 582.0),
			item('12.87', 283.4, 580.6),
			item('Jan', 73, 581.0),
			item('9', 89, 581.0),
			item('Point of sale purchase', 113, 581.0),
			item('Pho House Toronto ONCA', 112.8, 571.7)
		]);
		expect(rows.map((r) => r.text)).toEqual([
			'Jan 9 Point of sale purchase 12.87 12,406.49',
			'Pho House Toronto ONCA'
		]);
	});

	it('orders rows top to bottom', () => {
		const rows = rowsFromItems([item('low', 10, 100), item('high', 10, 700), item('mid', 10, 400)]);
		expect(rows.map((r) => r.text)).toEqual(['high', 'mid', 'low']);
	});

	it('drops rotated margin text and blank items', () => {
		const rows = rowsFromItems([
			item('Jan 3', 73, 500),
			item('SBSAV00000_0000000_000', 25.9, 500, true),
			item('   ', 200, 500)
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].text).toBe('Jan 3');
	});
});
