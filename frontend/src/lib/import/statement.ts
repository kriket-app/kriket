import { rowsFromItems } from './rows';
import { ImportError, type Row, type Statement, type TextItem, type Txn } from './types';

const MONTHS: Record<string, number> = {
	jan: 1,
	janv: 1,
	feb: 2,
	fev: 2,
	fevr: 2,
	mar: 3,
	mars: 3,
	apr: 4,
	avr: 4,
	may: 5,
	mai: 5,
	jun: 6,
	juin: 6,
	jul: 7,
	juil: 7,
	aug: 8,
	aout: 8,
	sep: 9,
	sept: 9,
	oct: 10,
	nov: 11,
	dec: 12
};
/** "janv." / "février" / "Sept" to a month number, or 0. */
export function monthOf(word: string): number {
	const key = word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.$/, '');
	return MONTHS[key] ?? MONTHS[key.slice(0, 4)] ?? MONTHS[key.slice(0, 3)] ?? 0;
}

const EN_AMOUNT = /^-?\$?\s?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/;
const FR_AMOUNT = /^-?(\d{1,3}(?:\s\d{3})*|\d+),(\d{2})\s?\$?$/;
/** "1,252.53", "$7,698.25", "1 234,56 $" to integer cents (sign dropped: direction comes from the column). */
export function parseAmountCents(s: string): number | null {
	const t = s.trim().replace(/\s/g, ' ');
	const m = EN_AMOUNT.exec(t) ?? FR_AMOUNT.exec(t);
	if (!m) return null;
	return Number(m[1].replace(/[,\s]/g, '')) * 100 + Number(m[2]);
}

const DATE_LEFT_EDGE = 120;
/**
 * A date at the start of a row: "Jan" + "9" as two items, "Jan 3" in one, "Jan 3 Opening Balance"
 * as a prefix, or French "4 mars". Returns the month and day and the items left over.
 */
export function parseDatePrefix(items: TextItem[]) {
	const first = items[0];
	if (!first || first.x > DATE_LEFT_EDGE) return null;
	const second = items[1];
	const joinTwo =
		second && /^[A-Za-zéû.]+$/.test(first.str.trim()) && /^\d{1,2}$/.test(second.str.trim());
	const joined = joinTwo ? `${first.str.trim()} ${second.str.trim()}` : first.str.trim();
	const en = /^([A-Za-zéû]{3,9})\.?\s+(\d{1,2})\b\.?,?\s*(.*)$/.exec(joined);
	const fr = /^(\d{1,2})\s+([A-Za-zéû]{3,9})\.?\s*(.*)$/.exec(joined);
	const m = en ?? fr;
	if (!m) return null;
	const month = monthOf(en ? m[1] : m[2]);
	const day = Number(en ? m[2] : m[1]);
	if (!month || day < 1 || day > 31) return null;
	const rest = items.slice(joinTwo ? 2 : 1);
	if (m[3]) rest.unshift({ ...first, str: m[3] });
	return { month, day, rest };
}

const iso = (y: number, m: number, d: number) =>
	`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const PERIOD =
	/([A-Za-zéû]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(?:to|au)\s+([A-Za-zéû]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i;
const PERIOD_FR =
	/(\d{1,2})\s+([A-Za-zéû]{3,9})\.?\s+(\d{4})\s+au\s+(\d{1,2})\s+([A-Za-zéû]{3,9})\.?\s+(\d{4})/i;
/** The "January 02 2024 to February 03, 2024" (or "1 mars 2026 au 31 mars 2026") line, if any. */
function findPeriod(rows: Row[]): { start: string; end: string } | null {
	for (const row of rows) {
		const en = PERIOD.exec(row.text);
		if (en && monthOf(en[1]) && monthOf(en[4])) {
			return {
				start: iso(Number(en[3]), monthOf(en[1]), Number(en[2])),
				end: iso(Number(en[6]), monthOf(en[4]), Number(en[5]))
			};
		}
		const fr = PERIOD_FR.exec(row.text);
		if (fr && monthOf(fr[2]) && monthOf(fr[5])) {
			return {
				start: iso(Number(fr[3]), monthOf(fr[2]), Number(fr[1])),
				end: iso(Number(fr[6]), monthOf(fr[5]), Number(fr[4]))
			};
		}
	}
	return null;
}

const HEADER = {
	out: /withdraw|debit|débit|retrait/i,
	in: /deposit|dépôt|depot|credit|crédit/i,
	bal: /^balance|^solde/i
};
type Columns = { out: number; in: number; bal: number };
/** The right edges of the three amount columns when this row is the table header, else null. */
function headerColumns(row: Row): Columns | null {
	const find = (re: RegExp) => row.items.find((it) => re.test(it.str.trim()));
	const out = find(HEADER.out);
	const inn = find(HEADER.in);
	const bal = find(HEADER.bal);
	if (!out || !inn || !bal) return null;
	return { out: out.x + out.width, in: inn.x + inn.width, bal: bal.x + bal.width };
}

/** Amounts are right-aligned under their header; 30 pt of slack covers bold and wider fonts. */
const COLUMN_SLACK = 30;
function columnOf(cols: Columns, it: TextItem): keyof Columns | null {
	const right = it.x + it.width;
	let best: keyof Columns | null = null;
	let bestGap = COLUMN_SLACK;
	for (const key of ['out', 'in', 'bal'] as const) {
		const gap = Math.abs(cols[key] - right);
		if (gap <= bestGap) {
			best = key;
			bestGap = gap;
		}
	}
	return best;
}

const OPENING =
	/opening balance|solde d.ouverture|solde précédent|solde precedent|previous balance/i;
const CLOSING = /closing balance|solde de fermeture|solde final|solde de clôture/i;
const PAGE_END = /continued on next page|suite à la page|suite a la page/i;

export function parseStatement(pages: TextItem[][], today: string): Statement {
	const pageRows = pages.map(rowsFromItems);
	const allRows = pageRows.flat();
	const bank = allRows.some((r) => /scotiabank/i.test(r.text)) ? 'scotiabank' : 'generic';
	const period = findPeriod(allRows);
	const warnings: string[] = [];
	const thisYear = Number(today.slice(0, 4));
	const startYear = period ? Number(period.start.slice(0, 4)) : thisYear;
	const startMonth = period ? Number(period.start.slice(5, 7)) : 1;
	const endYear = period ? Number(period.end.slice(0, 4)) : thisYear;
	// A statement covers at most a year, so a month before the start month belongs to the end year.
	const yearOf = (month: number) => (month >= startMonth ? startYear : endYear);

	let opening: number | null = null;
	let closing: number | null = null;
	const txns: Txn[] = [];
	let sawTable = false;
	let skipped = 0;

	for (const rows of pageRows) {
		let cols: Columns | null = null;
		for (const row of rows) {
			const header = headerColumns(row);
			if (header) {
				cols = header;
				sawTable = true;
				continue;
			}
			if (!cols) continue;
			if (PAGE_END.test(row.text)) {
				cols = null;
				continue;
			}
			const dated = parseDatePrefix(row.items);
			const amounts: Partial<Record<keyof Columns, number>> = {};
			const text: string[] = [];
			for (const it of dated?.rest ?? row.items) {
				const cents = parseAmountCents(it.str);
				const col = cents === null ? null : columnOf(cols, it);
				if (cents !== null && col && amounts[col] === undefined) {
					// Direction comes from the column, so a sign on a withdrawal or deposit is
					// ignored; on the running balance it matters ("-307.82", "(307.82)").
					const raw = it.str.trim();
					const negative = col === 'bal' && (/^-\s?\$?/.test(raw) || /^\(.*\)$/.test(raw));
					amounts[col] = negative ? -cents : cents;
				} else text.push(it.str.trim());
			}
			const memo = text.join(' ').trim();
			const last = txns.at(-1);
			if (OPENING.test(memo)) {
				opening = amounts.bal ?? opening;
				continue;
			}
			if (CLOSING.test(memo)) {
				closing = amounts.bal ?? closing;
				cols = null;
				continue;
			}
			if (amounts.out === undefined && amounts.in === undefined) {
				// A balance alone belongs to the line above; words alone are its memo's continuation.
				if (amounts.bal !== undefined && last && last.balanceCents === null && !dated) {
					last.balanceCents = amounts.bal;
				} else if (last && !dated && memo) {
					last.memo = `${last.memo} ${memo}`.trim();
				}
				continue;
			}
			const date = dated ? iso(yearOf(dated.month), dated.month, dated.day) : last?.date;
			if (!date) {
				skipped++;
				continue;
			}
			txns.push({
				date,
				amountCents: amounts.out ?? amounts.in!,
				direction: amounts.out !== undefined ? 'out' : 'in',
				memo,
				balanceCents: amounts.bal ?? null,
				balanceOk: true
			});
		}
	}

	if (!sawTable)
		throw new ImportError('no-table', 'Kriket doesn’t know this statement layout yet.');

	let running = opening;
	let unbalanced = 0;
	let sumIn = 0;
	let sumOut = 0;
	for (const t of txns) {
		if (t.direction === 'in') sumIn += t.amountCents;
		else sumOut += t.amountCents;
		if (t.balanceCents !== null) {
			if (running !== null) {
				const expected = running + (t.direction === 'in' ? t.amountCents : -t.amountCents);
				t.balanceOk = expected === t.balanceCents;
				if (!t.balanceOk) unbalanced++;
			}
			running = t.balanceCents;
		}
	}
	const reconciled = opening !== null && closing !== null && opening - sumOut + sumIn === closing;

	if (!period) warnings.push(`No statement period was found, so dates assume ${thisYear}.`);
	if (unbalanced > 0) {
		warnings.push(
			`The running balance does not add up on ${unbalanced} line${unbalanced === 1 ? '' : 's'}, so double-check those amounts.`
		);
	}
	if (skipped > 0) {
		warnings.push(
			`${skipped} line${skipped === 1 ? '' : 's'} had an amount but no date and were skipped.`
		);
	}

	const dates = txns.map((t) => t.date).sort();
	return {
		bank,
		periodStart: period?.start ?? dates[0] ?? today,
		periodEnd: period?.end ?? dates.at(-1) ?? today,
		openingCents: opening,
		closingCents: closing,
		txns,
		reconciled,
		unbalancedRows: unbalanced,
		warnings
	};
}
