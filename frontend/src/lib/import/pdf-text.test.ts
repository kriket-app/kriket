import { describe, expect, it } from 'vitest';
import { MAX_BYTES, checkPdfFile, isPdfBytes } from './pdf-text';
import { ImportError } from './types';

describe('checkPdfFile', () => {
	it('accepts a PDF by type or by name', () => {
		expect(() =>
			checkPdfFile({ name: 'jan.pdf', type: 'application/pdf', size: 1000 })
		).not.toThrow();
		expect(() => checkPdfFile({ name: 'jan.PDF', type: '', size: 1000 })).not.toThrow();
	});
	it('rejects other files and files over 10 MB with a sentence', () => {
		expect(() => checkPdfFile({ name: 'jan.csv', type: 'text/csv', size: 10 })).toThrow(
			ImportError
		);
		expect(() => checkPdfFile({ name: 'jan.csv', type: 'text/csv', size: 10 })).toThrow(
			'That isn’t a PDF.'
		);
		expect(() =>
			checkPdfFile({ name: 'jan.pdf', type: 'application/pdf', size: MAX_BYTES + 1 })
		).toThrow('That PDF is bigger than 10 MB.');
	});
});

describe('isPdfBytes', () => {
	it('checks the %PDF- magic', () => {
		expect(isPdfBytes(new TextEncoder().encode('%PDF-1.5 rest'))).toBe(true);
		expect(isPdfBytes(new TextEncoder().encode('hello'))).toBe(false);
	});
});
