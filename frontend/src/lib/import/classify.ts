import { classifyNaiveBayes, trainNaiveBayes } from './nb';
import seed from './seed.json';
import { payeeOf, tokenize } from './tokenize';
import type { Classified, Direction, Hint, Txn } from './types';

/**
 * Rules run first and win; they are the decisions that move the totals (transfers) or name income.
 * The e-transfer rule comes before the transfer rule because "Interac e-Transfer" contains "transfer".
 */
const RULES: { test: RegExp; direction?: Direction; hint: Hint }[] = [
	{ test: /e-?transfer|e-?trf|interac|email money|virement interac/i, hint: 'e-transfer' },
	{
		test: /transfer to|tfr to|pc transfer|credit card|cc payment|scotialine|line of credit|loc payment|to savings|mastercard|visa/i,
		direction: 'out',
		hint: 'transfer'
	},
	{
		test: /transfer from|tfr from|from savings|from chequing/i,
		direction: 'in',
		hint: 'transfer'
	},
	{ test: /\b(payroll|salary|salaire|paie)\b/i, direction: 'in', hint: 'pay' },
	{
		test: /\b(abm|atm)\b|^withdrawal$|cash withdrawal|retrait au guichet/i,
		direction: 'out',
		hint: 'cash'
	},
	{
		test: /service charge|monthly fee|account fee|frais mensuels|frais de service|overdraft|nsf/i,
		direction: 'out',
		hint: 'fees'
	}
];

const model = trainNaiveBayes(
	Object.entries(seed as Record<string, string[]>).flatMap(([label, memos]) =>
		memos.map((memo) => ({ tokens: tokenize(memo), label }))
	)
);

function ruleHint(memo: string, direction: Direction): Hint | null {
	for (const rule of RULES) {
		if (rule.direction && rule.direction !== direction) continue;
		if (rule.test.test(memo.trim())) return rule.hint;
	}
	return null;
}

/** A hint and a grouping payee for one transaction: rules first, then the model, else "other". */
export function classify(txn: Txn): Classified {
	const tokens = tokenize(txn.memo);
	let hint = ruleHint(txn.memo, txn.direction);
	if (!hint && txn.direction === 'in') {
		// The model knows spending, not income: a deposit no rule names is "other" income, grouped
		// by payee (a DoorDash payout, a refund, a client's payment), and drafted like any income.
		hint = 'other';
	} else if (!hint) {
		const guess = classifyNaiveBayes(model, tokens);
		hint = guess.known ? (guess.label as Hint) : 'other';
	}
	const payee = hint === 'e-transfer' || hint === 'cash' || hint === 'fees' ? '' : payeeOf(tokens);
	return { ...txn, hint, payee };
}
