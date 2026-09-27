import { today as todayIso } from '../dates';
import { buildPreview } from './drafts';
import { readPdfText } from './pdf-text';
import { parseStatement } from './statement';
import type { Preview } from './types';

export { ImportError } from './types';
export type { Draft, Hint, Preview } from './types';

/**
 * Reads a statement PDF in the browser and returns totals and stream drafts. Throws `ImportError`
 * with a sentence for the page when the file can't be used. Nothing here touches the network.
 */
export async function importStatement(file: File, today = todayIso()): Promise<Preview> {
	const pages = await readPdfText(file);
	return buildPreview(parseStatement(pages, today), today);
}
