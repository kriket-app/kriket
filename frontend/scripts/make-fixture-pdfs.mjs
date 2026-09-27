// Writes the e2e fixture PDFs into e2e/fixtures (or the directory given as the first argument):
//
//   statement.pdf  a month of one persona's chequing account in the Scotiabank Day-to-Day layout
//                  (the layout the parser was built on): three pages, 46 transactions, every
//                  running balance and the summary computed here so the statement always adds up.
//                  Sam works café shifts (bi-weekly pay that varies), delivers for DoorDash on
//                  weekends, and spends on rent, utilities, five subscriptions and a gym, groceries,
//                  a lot of Tim Hortons and Skip, transit, plus two transfers to their own accounts
//                  that must not count. The month comes out short, so a demo has a decision in it.
//   scanned.pdf    one page holding only an image: a "scan" with no text layer.
//
// Run from frontend/:  node scripts/make-fixture-pdfs.mjs
// Then, once, for the password-protected fixture (pdf-lib cannot encrypt):
//   qpdf --encrypt secret secret 256 -- e2e/fixtures/statement.pdf e2e/fixtures/encrypted.pdf
//
// The generated files are committed; rerun this only when the rows change, and update the
// numbers in e2e/import.spec.ts to what this script prints.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const OUT = process.argv[2] ?? 'e2e/fixtures';
mkdirSync(OUT, { recursive: true });

// [date, type line, memo line, withdrawn cents, deposited cents], in statement order.
const ROWS = [
	['Aug 5', 'Deposit', '90000123 MB-Email Money Trf', 0, 7500],
	['Aug 5', 'Point of sale purchase', 'Opos Spotify P2A1B2C3', 1299, 0],
	['Aug 5', 'Point of sale purchase', 'Fpos Saskatoon Transit Saskatoon SKCA', 8300, 0],
	['Aug 6', 'Point of sale purchase', 'Fpos Co-op Food Store Saskatoon SKCA', 4732, 0],
	['Aug 6', 'Point of sale purchase', 'Fpos Tim Hortons #2210 Saskatoon SKCD', 235, 0],
	['Aug 7', 'Deposit', '1044 Payroll PRAIRIE BEAN CAFE LTD', 0, 81240],
	['Aug 8', 'PC Transfer to', 'Savings', 10000, 0],
	['Aug 8', 'Point of sale purchase', 'Opos GoodLife Fitness Saskatoon SK', 2999, 0],
	['Aug 9', 'ABM withdrawal', 'Midtown Plaza Saskatoon SK', 6000, 0],
	['Aug 9', 'Point of sale purchase', 'Opos Skip The Dishes Saskatoon SK', 2845, 0],
	['Aug 10', 'Deposit', 'DOORDASH INC PAYOUT', 0, 9640],
	['Aug 11', 'Point of sale purchase', 'Fpos Tim Hortons #2210 Saskatoon SKCD', 410, 0],
	['Aug 12', 'Point of sale purchase', 'Opos Netflix.com 866-716-0414', 2099, 0],
	['Aug 13', 'Point of sale purchase', 'Fpos Co-op Food Store Saskatoon SKCA', 6210, 0],
	['Aug 14', 'Point of sale purchase', 'Fpos Booster Juice #101 Saskatoon SKCA', 875, 0],
	['Aug 15', 'Bill payment', 'SASKTEL', 8500, 0],
	['Aug 15', 'Point of sale purchase', 'Opos Uber *Trip help.uber.com', 1480, 0],
	['Aug 16', 'Point of sale purchase', 'Fpos Sport Chek #345 Saskatoon SKCA', 8999, 0],
	['Aug 16', 'Point of sale purchase', 'Fpos Tim Hortons #2210 Saskatoon SKCD', 325, 0],
	['Aug 17', 'Deposit', 'DOORDASH INC PAYOUT', 0, 14275],
	['Aug 18', 'Point of sale purchase', 'Opos Google *Youtube Premium g.co/helppay', 1399, 0],
	['Aug 19', 'Point of sale purchase', 'Opos Skip The Dishes Saskatoon SK', 3490, 0],
	['Aug 20', 'Bill payment', 'SASKPOWER', 6420, 0],
	['Aug 20', 'Point of sale purchase', 'Fpos Real Cdn Superstore #1518 Saskatoon SKCA', 7145, 0],
	['Aug 21', 'Deposit', '1044 Payroll PRAIRIE BEAN CAFE LTD', 0, 93415],
	['Aug 21', 'Point of sale purchase', 'Fpos Boston Pizza #123 Saskatoon SKCA', 4120, 0],
	['Aug 22', 'PC Transfer to', 'Credit Card', 25000, 0],
	['Aug 22', 'Point of sale purchase', 'Opos GoodLife Fitness Saskatoon SK', 2999, 0],
	['Aug 23', 'Point of sale purchase', 'Fpos Tim Hortons #2210 Saskatoon SKCD', 560, 0],
	['Aug 24', 'Deposit', 'DOORDASH INC PAYOUT', 0, 8810],
	['Aug 24', 'Point of sale purchase', 'Fpos Safeway #8823 Saskatoon SKCA', 1975, 0],
	['Aug 25', 'Point of sale purchase', 'Opos Amazon Prime Member amazon.ca', 1099, 0],
	['Aug 26', 'Point of sale purchase', 'Fpos Winners #340 Saskatoon SKCA', 3450, 0],
	['Aug 27', 'Point of sale purchase', 'Fpos Co-op Food Store Saskatoon SKCA', 5488, 0],
	['Aug 27', 'Point of sale purchase', 'Fpos Tim Hortons #2210 Saskatoon SKCD', 235, 0],
	['Aug 28', 'Pre-authorized debit', 'TD INSURANCE TENANT PKG', 1850, 0],
	['Aug 28', 'Point of sale purchase', 'Fpos Shoppers Drug Mart #1177 Saskatoon SKCA', 2380, 0],
	['Aug 29', 'Point of sale purchase', 'Opos Skip The Dishes Saskatoon SK', 2615, 0],
	['Aug 30', 'Point of sale purchase', 'Fpos Starbucks #3001 Saskatoon SKCD', 645, 0],
	['Aug 30', 'Point of sale purchase', 'Opos Uber *Trip help.uber.com', 2235, 0],
	['Aug 31', 'Deposit', 'DOORDASH INC PAYOUT', 0, 12030],
	['Aug 31', 'Point of sale purchase', 'Fpos Tim Hortons #2210 Saskatoon SKCD', 410, 0],
	['Sep 1', 'Pre-authorized debit', 'MAINSTREET EQUITY CORP RENT', 95000, 0],
	['Sep 2', 'Point of sale purchase', 'Fpos Real Cdn Superstore #1518 Saskatoon SKCA', 3860, 0],
	['Sep 2', 'Point of sale purchase', 'Fpos Dollarama #4488 Saskatoon SKCA', 1250, 0],
	['Sep 3', 'Service charge', 'Monthly Fees', 1695, 0]
];
const OPENING = 64218;
const PERIOD = 'August 04 2026 to September 03, 2026';
const OPENING_ON = 'August 4, 2026';
const CLOSING_ON = 'September 3, 2026';
const NAME = 'MS SAM RIVERA';
const ADDRESS = ['88 CHIRP CRES', 'SASKATOON SK', 'S7K 0A1'];
const ACCOUNT = '12345 67890 12';
const DISCLAIMER = 'Sample statement generated for kriket tests and demos. Not a real bank document.';

// The three amount columns' right edges, as on the statement the parser was built from.
const COL = { out: 306, in: 371, bal: 436 };
const ROW_PITCH = 26;
const MEMO_DROP = 9;
const BOTTOM = 80;

const money = (cents) =>
	(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function statement() {
	const pdf = await PDFDocument.create();
	pdf.setTitle('August 2026 E-Statement');
	const regular = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

	const totalOut = ROWS.reduce((s, r) => s + r[3], 0);
	const totalIn = ROWS.reduce((s, r) => s + r[4], 0);
	const closing = OPENING - totalOut + totalIn;

	// Lay the rows out first so every page can print "Page n of N".
	const pages = [];
	let page = null;
	const newPage = () => {
		page = { rows: [], first: pages.length === 0 };
		pages.push(page);
		return page.first ? 444 : 613;
	};
	let y = newPage();
	for (const row of ROWS) {
		if (y < BOTTOM) y = newPage();
		page.rows.push({ row, y });
		y -= ROW_PITCH;
	}
	if (y < BOTTOM) y = newPage();
	page.closingY = y;

	let balance = OPENING;
	pages.forEach((p, index) => {
		const pg = pdf.addPage([612, 792]);
		const left = (text, x, yy, size = 9, font = regular) => pg.drawText(text, { x, y: yy, size, font });
		const right = (text, edge, yy, size = 9, font = regular) =>
			pg.drawText(text, { x: edge - font.widthOfTextAtSize(text, size), y: yy, size, font });

		if (p.first) {
			left('Scotiabank', 72, 740, 14, bold);
			right('Day-to-Day Banking', 540, 740, 12, bold);
			left(NAME, 72, 690);
			ADDRESS.forEach((line, i) => left(line, 72, 679 - i * 11));
			left('Your account number:', 386, 690);
			left(ACCOUNT, 386, 679, 9, bold);
			left('Your Basic Banking Plan account summary', 72, 625, 12, bold);
			left(PERIOD, 72, 609);
			left(`Opening Balance on ${OPENING_ON}`, 72, 586, 9, bold);
			right(`$${money(OPENING)}`, 480, 586, 9, bold);
			left('Minus total withdrawals', 86, 572);
			right(`$${money(totalOut)}`, 480, 572);
			left('Plus total deposits', 86, 558);
			right(`$${money(totalIn)}`, 480, 558);
			left(`Closing Balance on ${CLOSING_ON}`, 72, 540, 9, bold);
			right(`$${money(closing)}`, 480, 540, 9, bold);
			left("Here's what happened in your account this statement period", 72, 515, 11, bold);
		} else {
			left(NAME, 72, 740);
			left('Your Basic Banking Plan account', 72, 722);
			left(PERIOD, 72, 708);
			right(ACCOUNT, 540, 708);
			left("Here's what happened in your account (continued)", 72, 660, 11, bold);
		}

		const headerY = p.first ? 488 : 631;
		right('Amounts', COL.out, headerY + 9, 7.5, bold);
		right('Amounts', COL.in, headerY + 9, 7.5, bold);
		left('Date', 73, headerY, 7.5, bold);
		left('Transactions', 113, headerY, 7.5, bold);
		right('withdrawn ($)', COL.out, headerY, 7.5, bold);
		right('deposited ($)', COL.in, headerY, 7.5, bold);
		right('Balance ($)', COL.bal, headerY, 7.5, bold);

		if (p.first) {
			left(`Aug 4 Opening Balance`, 73, 470, 9, bold);
			right(money(OPENING), COL.bal, 470);
		}
		for (const { row, y: rowY } of p.rows) {
			const [date, type, memo, out, inn] = row;
			balance = balance - out + inn;
			left(date, 73, rowY);
			left(type, 113, rowY);
			if (out) right(money(out), COL.out, rowY);
			if (inn) right(money(inn), COL.in, rowY);
			right(money(balance), COL.bal, rowY);
			left(memo, 113, rowY - MEMO_DROP);
		}
		if (p.closingY !== undefined) {
			left('Sep 3 Closing Balance', 73, p.closingY, 9, bold);
			right(`$${money(balance)}`, COL.bal, p.closingY, 9, bold);
		} else {
			right('continued on next page', 480, 42, 8, oblique);
		}
		left(DISCLAIMER, 72, 30, 7, oblique);
		right(`Page ${index + 1} of ${pages.length}`, 540, 18, 8);
	});

	writeFileSync(join(OUT, 'statement.pdf'), await pdf.save());
	console.log(
		`statement.pdf: ${ROWS.length} transactions on ${pages.length} pages, opening ${money(OPENING)}, ` +
			`withdrawn ${money(totalOut)}, deposited ${money(totalIn)}, closing ${money(closing)}`
	);
}

async function scanned() {
	const pdf = await PDFDocument.create();
	const pg = pdf.addPage([612, 792]);
	// A 1×1 grey PNG stretched over the page: a "scan" with no text layer at all.
	const png = await pdf.embedPng(
		Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==',
			'base64'
		)
	);
	pg.drawImage(png, { x: 72, y: 72, width: 468, height: 648 });
	writeFileSync(join(OUT, 'scanned.pdf'), await pdf.save());
	console.log('scanned.pdf: one page, image only');
}

await statement();
await scanned();
