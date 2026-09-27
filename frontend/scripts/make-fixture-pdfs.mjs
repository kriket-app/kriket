// Maintains the statement fixtures for the import flow:
//   e2e/fixtures/statement.pdf  - the canonical template (checked in as a binary; its source is
//                                 statement.pdf at the repo root). Never overwrite it from this script.
//   e2e/fixtures/scanned.pdf    - graphics only, no text layer (generated below).
//   e2e/fixtures/encrypted.pdf  - statement.pdf behind the password `secret` (made with qpdf).
//
// The canonical statement is Sam's August 2026 month: 46 transactions on 3 pages, opening $642.18,
// withdrawn $2,406.28, deposited $2,269.10, closing $505.00, 7 deposits, reconciled. Keep
// e2e/import.spec.ts in sync with those numbers.
//
// Usage: node scripts/make-fixture-pdfs.mjs [outDir]   (default: e2e/fixtures)
// Requires: qpdf on PATH.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';

const HERE = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? join(HERE, '..', 'e2e', 'fixtures');

async function scannedPdf() {
	const doc = await PDFDocument.create();
	const page = doc.addPage([612, 792]);
	page.drawRectangle({ x: 100, y: 400, width: 412, height: 200, color: rgb(0.9, 0.9, 0.9) });
	page.drawRectangle({ x: 100, y: 350, width: 200, height: 20, color: rgb(0.8, 0.8, 0.8) });
	return await doc.save();
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'scanned.pdf'), await scannedPdf());

// The encrypted copy is the canonical statement behind the password `secret`.
const statementPath = join(outDir, 'statement.pdf');
if (!existsSync(statementPath)) {
	console.error(`missing ${statementPath}: copy the canonical template there first`);
	process.exit(1);
}
execFileSync('qpdf', [
	'--encrypt',
	'secret',
	'secret',
	'256',
	'--',
	statementPath,
	join(outDir, 'encrypted.pdf')
]);
console.log(`fixtures refreshed in ${outDir}: scanned.pdf + encrypted.pdf from statement.pdf`);
