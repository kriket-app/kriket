import type { Row, TextItem } from './types';

/**
 * Items on one printed line differ in y by up to about 1.5 pt (different fonts on one baseline); the
 * memo line under a transaction sits about 9 pt lower and rows are about 26 pt apart, so 4 pt splits
 * lines without splitting a line.
 */
const ROW_GAP = 4;

/** Groups items into printed lines, top to bottom and left to right. Rotated margin text is dropped. */
export function rowsFromItems(items: TextItem[]): Row[] {
	const sorted = items
		.filter((it) => !it.rotated && it.str.trim() !== '')
		.sort((a, b) => b.y - a.y || a.x - b.x);
	const rows: Row[] = [];
	let current: Row | null = null;
	for (const it of sorted) {
		if (!current || current.y - it.y > ROW_GAP) {
			current = { y: it.y, items: [], text: '' };
			rows.push(current);
		}
		current.items.push(it);
	}
	for (const row of rows) {
		row.items.sort((a, b) => a.x - b.x);
		row.text = row.items.map((it) => it.str.trim()).join(' ');
	}
	return rows;
}
