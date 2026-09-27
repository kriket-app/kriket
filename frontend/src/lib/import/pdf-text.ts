// The legacy build, not the default one: the default build calls very new APIs such as
// Map.prototype.getOrInsertComputed without a fallback, and iOS Safari lacks them, so every
// read failed there. The legacy build polyfills them.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { ImportError, type TextItem } from './types';

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 30;
/** Fewer characters than this across the whole file means a scan, not a text PDF. */
const MIN_CHARS = 20;

/** The cheap checks before the file is read; exported so they can be unit-tested without a browser. */
export function checkPdfFile(file: { name: string; type: string; size: number }) {
	const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
	if (!isPdf) throw new ImportError('not-pdf', 'That isn’t a PDF.');
	if (file.size > MAX_BYTES) throw new ImportError('too-big', 'That PDF is bigger than 10 MB.');
}

export const isPdfBytes = (bytes: Uint8Array) =>
	bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';

/**
 * The file's text, one array of positioned items per page, read by PDF.js in its Web Worker.
 * Browser only: `pdfjs-dist` is imported here and nowhere else, and only when this runs.
 * No fonts or character maps are fetched: text extraction does not need them (PDF.js logs one
 * warning about `standardFontDataUrl`, which is expected).
 */
export async function readPdfText(file: File): Promise<TextItem[][]> {
	checkPdfFile(file);
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!isPdfBytes(bytes)) throw new ImportError('not-pdf', 'That isn’t a PDF.');

	const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
	pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
	const loadingTask = pdfjs.getDocument({ data: bytes, disableFontFace: true });
	let doc;
	try {
		doc = await loadingTask.promise;
	} catch (err) {
		if ((err as { name?: string }).name === 'PasswordException') {
			throw new ImportError(
				'encrypted',
				'This PDF is password-protected; export it again without a password.'
			);
		}
		throw err;
	}
	try {
		if (doc.numPages > MAX_PAGES) {
			throw new ImportError(
				'too-many-pages',
				`That PDF has more than ${MAX_PAGES} pages; export one statement at a time.`
			);
		}
		const pages: TextItem[][] = [];
		let chars = 0;
		for (let n = 1; n <= doc.numPages; n++) {
			const page = await doc.getPage(n);
			const content = await page.getTextContent();
			const items: TextItem[] = [];
			for (const it of content.items) {
				if (!('str' in it) || !it.str.trim()) continue;
				const [, b, c, , x, y] = it.transform;
				items.push({
					str: it.str,
					x,
					y,
					width: it.width,
					rotated: Math.abs(b) > 0.01 || Math.abs(c) > 0.01
				});
				chars += it.str.trim().length;
			}
			pages.push(items);
		}
		if (chars < MIN_CHARS) {
			throw new ImportError(
				'no-text',
				'This PDF has no text layer (it’s a scan); kriket can’t read scans yet.'
			);
		}
		return pages;
	} finally {
		await loadingTask.destroy();
	}
}
