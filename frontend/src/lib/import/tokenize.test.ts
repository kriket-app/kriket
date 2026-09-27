import { describe, expect, it } from 'vitest';
import { payeeOf, tokenize } from './tokenize';

describe('tokenize', () => {
	it('lower-cases, strips accents, numbers, store codes, places, and bank boilerplate', () => {
		expect(tokenize('Point of sale purchase Fpos Metro #065 Etobicoke ONCA')).toEqual(['metro']);
		expect(tokenize('Opos Google *Youtube Videg.co/payhelnsca')).toEqual([
			'google',
			'youtube',
			'videg',
			'payhelnsca'
		]);
		expect(tokenize('Deposit 90000001 MB-Email Money Trf')).toEqual([]);
		expect(tokenize('Paiement facture Hydro-Québec')).toEqual(['facture', 'hydro']);
	});
});

describe('payeeOf', () => {
	it('keeps up to two words', () => {
		expect(payeeOf(tokenize('Deposit 1044 Payroll ACME REALTY LTD'))).toBe('acme realty');
		expect(
			payeeOf(tokenize('Point of sale purchase Fpos Tim Hortons #3196# Qnorth York ONCD'))
		).toBe('tim hortons');
		expect(payeeOf(tokenize('Deposit 90000001 MB-Email Money Trf'))).toBe('');
		expect(payeeOf(tokenize('Service charge Monthly Fees'))).toBe('');
	});
});
