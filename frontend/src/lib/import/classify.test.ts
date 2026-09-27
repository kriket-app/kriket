import { describe, expect, it } from 'vitest';
import { classify } from './classify';
import holdout from './holdout.json';
import seed from './seed.json';
import type { Txn } from './types';

const txn = (memo: string, direction: 'in' | 'out' = 'out'): Txn => ({
	date: '2024-01-10',
	amountCents: 1000,
	direction,
	memo,
	balanceCents: null,
	balanceOk: true
});

describe('classify rules', () => {
	it('reads an Interac e-Transfer as an e-transfer, never as a transfer', () => {
		expect(classify(txn('Deposit 90000001 MB-Email Money Trf', 'in')).hint).toBe('e-transfer');
		expect(classify(txn('INTERAC E-TRANSFER SENT', 'out')).hint).toBe('e-transfer');
		expect(classify(txn('Interac e-Transfer From: LANDLORD', 'in')).hint).toBe('e-transfer');
	});

	it('reads transfers to the user’s own cards and lines as transfers, by direction', () => {
		expect(classify(txn('PC Transfer to Credit Card', 'out')).hint).toBe('transfer');
		expect(classify(txn('PC Transfer to ScotiaLine 0000', 'out')).hint).toBe('transfer');
		expect(classify(txn('Transfer from Savings', 'in')).hint).toBe('transfer');
	});

	it('reads payroll as pay only when money comes in, and never "paiement"', () => {
		expect(classify(txn('Deposit 1044 Payroll ACME REALTY LTD', 'in'))).toMatchObject({
			hint: 'pay',
			payee: 'acme realty'
		});
		expect(classify(txn('Depot Paie Ville de Regina', 'in')).hint).toBe('pay');
		expect(classify(txn('Paiement facture Hydro-Quebec', 'out')).hint).toBe('utilities');
	});

	it('reads cash and bank fees', () => {
		expect(classify(txn('ABM withdrawal Yorkdale S.C. #2 Toronto ON')).hint).toBe('cash');
		expect(classify(txn('Withdrawal')).hint).toBe('cash');
		expect(classify(txn('Service charge Monthly Fees')).hint).toBe('fees');
	});

	it('falls back to "other" for a payee it has never seen', () => {
		expect(classify(txn('Fpos Zxqv Boutique Toronto ONCA')).hint).toBe('other');
	});

	it('leaves a deposit no rule names as "other" income with its payee, never a spending category', () => {
		expect(classify(txn('Deposit DOORDASH INC PAYOUT', 'in'))).toMatchObject({
			hint: 'other',
			payee: 'doordash'
		});
	});
});

describe('classify model', () => {
	it('gets at least 80% of the held-out memos right', () => {
		const cases = Object.entries(holdout).flatMap(([hint, memos]) => memos.map((m) => [m, hint]));
		const right = cases.filter(([memo, hint]) => classify(txn(memo)).hint === hint).length;
		expect(right / cases.length).toBeGreaterThanOrEqual(0.8);
	});

	it('trains and tests on different memos', () => {
		const seen = new Set(Object.values(seed).flat());
		for (const memo of Object.values(holdout).flat()) expect(seen.has(memo)).toBe(false);
	});
});
