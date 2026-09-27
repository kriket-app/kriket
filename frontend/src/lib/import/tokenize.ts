/** Words that say what kind of transaction it was, not who it was with. Unaccented, lower case. */
const TYPE_WORDS = new Set([
	'point',
	'of',
	'sale',
	'purchase',
	'fpos',
	'opos',
	'pos',
	'deposit',
	'depot',
	'withdrawal',
	'retrait',
	'payment',
	'paiement',
	'achat',
	'payroll',
	'paie',
	'salary',
	'salaire',
	'transfer',
	'tfr',
	'trf',
	'etrf',
	'interac',
	'email',
	'money',
	'mb',
	'pc',
	'to',
	'from',
	'service',
	'charge',
	'monthly',
	'fees',
	'fee',
	'frais',
	'abm',
	'atm',
	'the',
	'and',
	'inc',
	'ltd',
	'ltee',
	'co',
	'corp',
	'pre',
	'authorized',
	'pad',
	'debit',
	'bill',
	'payout'
]);
/** Places banks print after the merchant; dropped so "metro toronto" and "metro regina" group together. */
const PLACE_WORDS = new Set([
	'on',
	'ab',
	'bc',
	'sk',
	'mb',
	'qc',
	'ns',
	'nb',
	'pe',
	'nl',
	'ca',
	'onca',
	'oncd',
	'abca',
	'bcca',
	'skca',
	'mbca',
	'qcca',
	'toronto',
	'etobicoke',
	'oakville',
	'mississauga',
	'ottawa',
	'saskatoon',
	'regina',
	'winnipeg',
	'calgary',
	'edmonton',
	'vancouver',
	'victoria',
	'montreal',
	'quebec',
	'halifax',
	'york',
	'north',
	'qnorth',
	'skcd',
	'abcd',
	'bccd',
	'mbcd',
	'qccd'
]);

/** Lower-case words from a memo with accents, numbers, store codes, places, and boilerplate removed. */
export function tokenize(memo: string): string[] {
	return memo
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[*#]?\d[\d,./:-]*/g, ' ')
		.replace(/[^a-z\s'&-]/g, ' ')
		.split(/[\s-]+/)
		.map((t) => t.replace(/^[-'&]+|[-'&]+$/g, ''))
		.filter((t) => t.length > 1 && !TYPE_WORDS.has(t) && !PLACE_WORDS.has(t));
}

/** Up to two words that identify the other party, for grouping; '' when the memo was all boilerplate. */
export function payeeOf(tokens: string[]): string {
	return tokens.slice(0, 2).join(' ');
}
