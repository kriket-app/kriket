import { describe, expect, it } from 'vitest';
import fixture from './fixtures/scotiabank-2024-01.items.json';
import { classify } from './classify';
import { buildPreview, draftsFrom } from './drafts';
import { parseStatement } from './statement';
import type { Classified, Statement, TextItem } from './types';
import { nextOccurrence } from '../dates';

const TODAY = '2026-09-26';
const statement = parseStatement(fixture.pages as TextItem[][], TODAY);
const preview = buildPreview(statement, TODAY);
const byName = (name: string) => preview.drafts.find((d) => d.name === name);

describe('buildPreview on the Scotiabank fixture', () => {
	it('totals money in and out without the transfers, and counts the transfers apart', () => {
		expect(preview.txnCount).toBe(36);
		expect(preview.totalInCents).toBe(1260430);
		// 19,213.83 withdrawn less the two credit-card transfers (850 + 1,000) and the ScotiaLine payment (3,400).
		expect(preview.totalOutCents).toBe(1921383 - 85000 - 100000 - 340000);
		expect(preview.transferOutCents).toBe(85000 + 100000 + 340000);
		expect(preview.transferInCents).toBe(0);
		expect(preview.reconciled).toBe(false);
	});

	it('drafts pay as one monthly stream of the statement’s total, income first', () => {
		expect(preview.drafts[0]).toMatchObject({
			kind: 'income',
			name: 'Acme Realty pay',
			hint: 'pay',
			actualCents: 101700 + 950386 + 93344,
			minCents: 101700 + 950386 + 93344,
			maxCents: 101700 + 950386 + 93344,
			intervalDays: 30,
			count: 3,
			lastSeen: '2024-01-29'
		});
		expect(byName('E-transfers received')).toMatchObject({
			kind: 'income',
			actualCents: 10000 + 5000 + 100000,
			count: 3
		});
	});

	it('drafts groceries and eating out as the statement’s average week', () => {
		const weeks = 33 / 7; // Jan 2 to Feb 3 inclusive is 33 days
		const groceries = byName('Groceries')!;
		expect(groceries).toMatchObject({ kind: 'expense', intervalDays: 7, count: 5 });
		expect(groceries.totalCents).toBe(1500 + 1015 + 1494 + 3364 + 800);
		expect(groceries.actualCents).toBe(Math.round(groceries.totalCents / weeks));
		expect(byName('Eating out')).toMatchObject({ kind: 'expense', intervalDays: 7 });
	});

	it('drafts subscriptions, fees, and repeated unknown payees monthly, never one-offs or cash', () => {
		expect(byName('Google Youtube')).toMatchObject({
			actualCents: 249 * 5 + 1999,
			count: 6,
			intervalDays: 30
		});
		expect(byName('Bank fees')).toMatchObject({ actualCents: 1595, count: 1, intervalDays: 30 });
		expect(byName('Maison Birks')).toBeUndefined();
		expect(byName('Town Shoes')).toBeUndefined();
		expect(preview.drafts.some((d) => d.hint === 'cash' || d.hint === 'transfer')).toBe(false);
	});

	it('preserves the observed calendar anchor, while weekly drafts advance to today', () => {
		for (const draft of preview.drafts) {
			if (draft.recurrence === 'monthly') expect(draft.firstDate).toBe(draft.lastSeen);
			else expect(draft.firstDate >= TODAY).toBe(true);
		}
		const pay = preview.drafts[0];
		expect(nextOccurrence(pay.firstDate, pay.intervalDays, TODAY, pay.recurrence)).toBe(
			'2026-09-29'
		);
	});

	it('says the amounts are one statement’s totals', () => {
		expect(preview.warnings).toContain(
			'Amounts are this statement’s totals; import more months, or edit a range, to widen them.'
		);
	});

	it('never lets memos, places, or reference numbers into the preview', () => {
		const json = JSON.stringify(preview);
		for (const text of [
			'Toronto',
			'ONCA',
			'Etobicoke',
			'90000001',
			'12345 67890 12',
			'JANE SAMPLE',
			'MB-Email'
		]) {
			expect(json).not.toContain(text);
		}
	});
});

describe('draftsFrom', () => {
	const base: Statement = {
		bank: 'generic',
		periodStart: '2026-03-01',
		periodEnd: '2026-03-31',
		openingCents: 0,
		closingCents: 0,
		txns: [],
		reconciled: true,
		unbalancedRows: 0,
		warnings: []
	};
	const out = (memo: string, amountCents: number, date = '2026-03-10'): Classified =>
		classify({ date, amountCents, direction: 'out', memo, balanceCents: null, balanceOk: true });

	it('needs two purchases before it drafts a weekly category', () => {
		expect(draftsFrom(base, [out('Fpos Metro #1', 4000)], TODAY).drafts).toEqual([]);
		expect(
			draftsFrom(base, [out('Fpos Metro #1', 4000), out('Sobeys #2', 3000, '2026-03-17')], TODAY)
				.drafts
		).toHaveLength(1);
	});

	it('drafts every income payee monthly, whatever it is called', () => {
		const payout = (date: string, amountCents: number): Classified =>
			classify({
				date,
				amountCents,
				direction: 'in',
				memo: 'Deposit DOORDASH INC PAYOUT',
				balanceCents: null,
				balanceOk: true
			});
		const { drafts } = draftsFrom(
			base,
			[payout('2026-03-07', 9640), payout('2026-03-14', 14275)],
			TODAY
		);
		expect(drafts).toEqual([
			expect.objectContaining({
				kind: 'income',
				name: 'Doordash',
				actualCents: 23915,
				intervalDays: 30,
				count: 2
			})
		]);
	});

	it('caps drafts at 20, largest totals first after income, and says how many were left out', () => {
		const txns: Classified[] = [];
		// 25 distinct utility payees (one word each, so the tokenizer keeps them apart),
		// each seen once (monthly hint), totals descending.
		const names = [
			'alpha',
			'bravo',
			'cinder',
			'delta',
			'echo',
			'foxtrot',
			'golf',
			'hotel',
			'india',
			'juliet',
			'kilo',
			'lima',
			'mike',
			'november',
			'oscar',
			'papa',
			'quebec',
			'romeo',
			'sierra',
			'tango',
			'uniform',
			'victor',
			'whiskey',
			'xray',
			'yankee'
		];
		for (let i = 0; i < 25; i++) {
			txns.push(out(`Utility Co ${names[i]} Telus`, 10000 - i * 100));
		}
		const { drafts, dropped } = draftsFrom(base, txns, TODAY);
		expect(drafts).toHaveLength(20);
		expect(dropped).toBe(5);
		expect(drafts[0].totalCents).toBeGreaterThan(drafts[19].totalCents);
	});
});
