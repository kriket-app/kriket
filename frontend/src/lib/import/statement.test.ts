import { describe, expect, it } from 'vitest';
import fixture from './fixtures/scotiabank-2024-01.items.json';
import { parseAmountCents, parseDatePrefix, parseStatement } from './statement';
import { ImportError, type TextItem } from './types';

const TODAY = '2026-09-26';
const item = (str: string, x: number, y: number, width = str.length * 4): TextItem => ({
	str,
	x,
	y,
	width,
	rotated: false
});
/** A one-page statement in the Scotiabank shape: header row, then rows of [date+text, out, in, bal]. */
function page(
	period: string,
	lines: [text: string, out: string, inn: string, bal: string][],
	headers = ['withdrawn ($)', 'deposited ($)', 'Balance ($)']
): TextItem[] {
	const items: TextItem[] = [item(period, 170, 700)];
	items.push(item('Date', 73, 598), item(headers[0], 252.5, 598, 53.5));
	items.push(item(headers[1], 321.8, 598, 49.1), item(headers[2], 395.3, 598, 40.7));
	let y = 580;
	for (const [text, out, inn, bal] of lines) {
		items.push(item(text, 73, y));
		if (out) items.push(item(out, 306 - out.length * 5, y, out.length * 5));
		if (inn) items.push(item(inn, 371 - inn.length * 5, y, inn.length * 5));
		if (bal) items.push(item(bal, 436 - bal.length * 5, y, bal.length * 5));
		y -= 26;
	}
	return items;
}

describe('parseAmountCents', () => {
	it('reads English and French amounts to cents, ignoring the sign', () => {
		expect(parseAmountCents('1,252.53')).toBe(125253);
		expect(parseAmountCents('$7,698.25')).toBe(769825);
		expect(parseAmountCents('15.00')).toBe(1500);
		expect(parseAmountCents('-42.10')).toBe(4210);
		expect(parseAmountCents('1 234,56 $')).toBe(123456);
		expect(parseAmountCents('Jan')).toBeNull();
		expect(parseAmountCents('#065')).toBeNull();
	});
});

describe('parseDatePrefix', () => {
	it('reads a date split across items, in one item, or as a prefix of the description', () => {
		expect(
			parseDatePrefix([item('Jan', 73, 1), item('9', 89, 1), item('Deposit', 113, 1)])
		).toEqual({
			month: 1,
			day: 9,
			rest: [item('Deposit', 113, 1)]
		});
		expect(parseDatePrefix([item('Jan 3', 73, 1)])).toEqual({ month: 1, day: 3, rest: [] });
		const prefixed = parseDatePrefix([item('Jan 3 Opening Balance', 73, 1)]);
		expect(prefixed?.month).toBe(1);
		expect(prefixed?.rest.map((it) => it.str)).toEqual(['Opening Balance']);
		expect(parseDatePrefix([item('févr. 14', 73, 1)])?.month).toBe(2);
		expect(parseDatePrefix([item('Point of sale', 113, 1)])).toBeNull();
	});
});

describe('parseStatement on the Scotiabank fixture', () => {
	const statement = parseStatement(fixture.pages as TextItem[][], TODAY);

	it('finds the period, the balances, and every transaction', () => {
		expect(statement.bank).toBe('scotiabank');
		expect(statement.periodStart).toBe('2024-01-02');
		expect(statement.periodEnd).toBe('2024-02-03');
		expect(statement.openingCents).toBe(1432474);
		expect(statement.closingCents).toBe(769825);
		expect(statement.txns).toHaveLength(36);
		expect(statement.txns.filter((t) => t.direction === 'in')).toHaveLength(6);
	});

	it('matches the statement’s own totals to the cent', () => {
		const sum = (d: 'in' | 'out') =>
			statement.txns.filter((t) => t.direction === d).reduce((s, t) => s + t.amountCents, 0);
		expect(sum('out')).toBe(1921383);
		expect(sum('in')).toBe(1260430);
	});

	it('attaches the memo line to the transaction above it and keeps one-line transactions', () => {
		expect(statement.txns[0]).toMatchObject({
			date: '2024-01-03',
			amountCents: 1500,
			direction: 'out',
			memo: 'Point of sale purchase Fpos Valley Farms Produce etobicoke ONCA'
		});
		expect(statement.txns.find((t) => t.memo === 'Withdrawal')).toMatchObject({
			date: '2024-01-06',
			amountCents: 150000
		});
		expect(statement.txns.find((t) => /Metro #065/.test(t.memo))?.memo).toBe(
			'Point of sale purchase Fpos Metro #065 Etobicoke ONCA'
		);
	});

	it('catches the four doctored running balances and says the statement does not add up', () => {
		const bad = statement.txns.filter((t) => !t.balanceOk);
		expect(bad.map((t) => [t.date, t.amountCents])).toEqual([
			['2024-01-03', 1015],
			['2024-01-04', 168],
			['2024-01-04', 101700],
			['2024-01-05', 3364]
		]);
		expect(statement.unbalancedRows).toBe(4);
		expect(statement.reconciled).toBe(false);
		expect(statement.warnings).toContain(
			'The running balance does not add up on 4 lines, so double-check those amounts.'
		);
	});

	it('never keeps the account holder, address, or account number', () => {
		const json = JSON.stringify(statement);
		for (const secret of ['JANE SAMPLE', '123 SAMPLE ST', '12345 67890 12', 'A1A 1A1']) {
			expect(json).not.toContain(secret);
		}
	});
});

describe('parseStatement on small synthetic pages', () => {
	it('assigns the year by the period when it crosses New Year', () => {
		const statement = parseStatement(
			[
				page('December 20, 2025 to January 19, 2026', [
					['Dec 20 Opening Balance', '', '', '100.00'],
					['Dec 28 Point of sale purchase', '10.00', '', '90.00'],
					['Jan 4 Deposit', '', '50.00', '140.00'],
					['Jan 19 Closing Balance', '', '', '140.00']
				])
			],
			TODAY
		);
		expect(statement.txns.map((t) => t.date)).toEqual(['2025-12-28', '2026-01-04']);
		expect(statement.reconciled).toBe(true);
	});

	it('gives dateless rows the previous row’s date (dates printed once per day)', () => {
		const statement = parseStatement(
			[
				page('March 1, 2026 to March 31, 2026', [
					['Mar 1 Opening Balance', '', '', '500.00'],
					['Mar 3 Coffee', '4.00', '', '496.00'],
					['Groceries', '40.00', '', '456.00'],
					['Mar 31 Closing Balance', '', '', '456.00']
				])
			],
			TODAY
		);
		expect(statement.txns.map((t) => [t.date, t.memo])).toEqual([
			['2026-03-03', 'Coffee'],
			['2026-03-03', 'Groceries']
		]);
	});

	it('takes a balance printed on its own line as the line above’s balance', () => {
		const items = page('March 1, 2026 to March 31, 2026', [
			['Mar 1 Opening Balance', '', '', '500.00'],
			['Mar 3 Coffee', '4.00', '', ''],
			['', '', '', '496.00'],
			['Mar 31 Closing Balance', '', '', '496.00']
		]).filter((it) => it.str !== '');
		const statement = parseStatement([items], TODAY);
		expect(statement.txns[0]).toMatchObject({
			memo: 'Coffee',
			balanceCents: 49600,
			balanceOk: true
		});
		expect(statement.reconciled).toBe(true);
	});

	it('reads a French header and amounts', () => {
		const statement = parseStatement(
			[
				page(
					'1 mars 2026 au 31 mars 2026',
					[
						['1 mars Solde d’ouverture', '', '', '1 000,00'],
						['4 mars Paiement facture Hydro-Québec', '120,50', '', '879,50'],
						['15 mars Dépôt Paie', '', '1 500,00', '2 379,50'],
						['31 mars Solde de fermeture', '', '', '2 379,50']
					],
					['Retraits ($)', 'Dépôts ($)', 'Solde ($)']
				)
			],
			TODAY
		);
		expect(statement.periodStart).toBe('2026-03-01');
		expect(statement.txns.map((t) => [t.date, t.direction, t.amountCents])).toEqual([
			['2026-03-04', 'out', 12050],
			['2026-03-15', 'in', 150000]
		]);
		expect(statement.reconciled).toBe(true);
	});

	it('warns and assumes this year when no period is printed', () => {
		const items = page('', [
			['Mar 3 Coffee', '4.00', '', ''],
			['Mar 9 Deposit', '', '50.00', '']
		]).filter((it) => it.str !== '');
		const statement = parseStatement([items], TODAY);
		expect(statement.txns.map((t) => t.date)).toEqual(['2026-03-03', '2026-03-09']);
		expect(statement.periodStart).toBe('2026-03-03');
		expect(statement.periodEnd).toBe('2026-03-09');
		expect(statement.warnings).toContain('No statement period was found, so dates assume 2026.');
	});

	it('keeps the sign of a negative running balance', () => {
		const statement = parseStatement(
			[
				page('March 1, 2026 to March 31, 2026', [
					['Mar 1 Opening Balance', '', '', '100.00'],
					['Mar 3 Rent', '950.00', '', '-850.00'],
					['Mar 9 Deposit', '', '900.00', '50.00'],
					['Mar 31 Closing Balance', '', '', '50.00']
				])
			],
			TODAY
		);
		expect(statement.txns[0]).toMatchObject({ balanceCents: -85000, balanceOk: true });
		expect(statement.reconciled).toBe(true);
	});

	it('rejects a PDF with no withdrawn/deposited/balance table', () => {
		expect(() => parseStatement([[item('Your invoice', 73, 700)]], TODAY)).toThrow(ImportError);
		expect(() => parseStatement([[item('Your invoice', 73, 700)]], TODAY)).toThrow(
			'Kriket doesn’t know this statement layout yet.'
		);
	});
});
