/** One positioned string as PDF.js `getTextContent()` returns it, in PDF points; y grows upward. */
export type TextItem = { str: string; x: number; y: number; width: number; rotated: boolean };

/** One printed line: its items left to right and their text joined with single spaces. */
export type Row = { y: number; items: TextItem[]; text: string };

export type Direction = 'in' | 'out';

export type Txn = {
	/** YYYY-MM-DD, the year taken from the statement period. */
	date: string;
	/** Integer cents, always > 0; `direction` says which way. */
	amountCents: number;
	direction: Direction;
	/**
	 * The transaction line plus its continuation lines, as printed, for example
	 * "Point of sale purchase Fpos Metro #065 Etobicoke ONCA". Never leaves the pipeline.
	 */
	memo: string;
	/** The running balance printed on the line, when there is one. */
	balanceCents: number | null;
	/** False when the printed balance is not the previous balance plus or minus this amount. */
	balanceOk: boolean;
};

export type Statement = {
	bank: 'scotiabank' | 'generic';
	periodStart: string;
	periodEnd: string;
	openingCents: number | null;
	closingCents: number | null;
	txns: Txn[];
	/** opening − withdrawals + deposits equals closing; false when either balance is missing. */
	reconciled: boolean;
	unbalancedRows: number;
	warnings: string[];
};

export type Hint =
	| 'pay'
	| 'e-transfer'
	| 'groceries'
	| 'dining'
	| 'transport'
	| 'subscription'
	| 'utilities'
	| 'rent'
	| 'fees'
	| 'cash'
	| 'transfer'
	| 'other';

export type Classified = Txn & {
	hint: Hint;
	/** Up to two identifying words from the memo, lower case, for grouping ("metro", "acme realty"). */
	payee: string;
};

export type Draft = {
	/** Stable within one preview, `${kind}-${index}`; the form posts it back so errors find their card. */
	id: string;
	kind: 'income' | 'expense';
	name: string;
	actualCents: number;
	minCents: number;
	maxCents: number;
	intervalDays: number;
	firstDate: string;
	hint: Hint;
	/** How many transactions and how much they came to in this statement. */
	count: number;
	totalCents: number;
	lastSeen: string;
};

export type Preview = {
	bank: Statement['bank'];
	periodStart: string;
	periodEnd: string;
	/** Money in and out excluding transfers between the user's own accounts. */
	totalInCents: number;
	totalOutCents: number;
	transferInCents: number;
	transferOutCents: number;
	txnCount: number;
	reconciled: boolean;
	warnings: string[];
	drafts: Draft[];
};

export type ImportErrorCode =
	'not-pdf' | 'too-big' | 'too-many-pages' | 'encrypted' | 'no-text' | 'no-table';

/** A problem with the file itself; `message` is the sentence the page shows. */
export class ImportError extends Error {
	code: ImportErrorCode;
	constructor(code: ImportErrorCode, message: string) {
		super(message);
		this.name = 'ImportError';
		this.code = code;
	}
}
