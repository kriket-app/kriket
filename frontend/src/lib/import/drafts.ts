import { nextOccurrence } from '../dates';
import { classify } from './classify';
import type { Classified, Draft, Hint, Preview, Statement } from './types';

export const MAX_DRAFTS = 20;
/** Spending that happens several times a week: one weekly stream per category, the statement's average week. */
const WEEKLY: Hint[] = ['groceries', 'dining', 'transport'];
/** Payments that come once a month: one monthly stream per payee, the statement's total. */
const MONTHLY: Hint[] = ['pay', 'e-transfer', 'subscription', 'utilities', 'rent', 'fees'];
/** An unknown payee seen this often in one statement is a habit, not a one-off. */
const REPEATED_OTHER = 3;

const DAY_MS = 86_400_000;
const daysInclusive = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

const titleCase = (words: string) =>
	words
		.replace(/\b[a-z]/g, (c) => c.toUpperCase())
		.replace(/\b(And|Of|De|Du|Le|La)\b/g, (w) => w.toLowerCase());

function nameFor(hint: Hint, payee: string, kind: Draft['kind']): string {
	switch (hint) {
		case 'pay':
			return payee ? `${titleCase(payee)} pay` : 'Pay';
		case 'e-transfer':
			return kind === 'income' ? 'E-transfers received' : 'E-transfers sent';
		case 'groceries':
			return 'Groceries';
		case 'dining':
			return 'Eating out';
		case 'transport':
			return 'Getting around';
		case 'fees':
			return 'Bank fees';
		default:
			return titleCase(payee || hint);
	}
}

type Group = { key: string; kind: Draft['kind']; hint: Hint; payee: string; txns: Classified[] };

export function draftsFrom(statement: Statement, txns: Classified[], today: string) {
	const groups = new Map<string, Group>();
	for (const t of txns) {
		if (t.hint === 'transfer' || t.hint === 'cash') continue;
		const kind = t.direction === 'in' ? 'income' : 'expense';
		const weekly = WEEKLY.includes(t.hint) && kind === 'expense';
		const key = weekly ? `${kind}:${t.hint}` : `${kind}:${t.hint}:${t.payee}`;
		const group = groups.get(key) ?? { key, kind, hint: t.hint, payee: t.payee, txns: [] };
		group.txns.push(t);
		groups.set(key, group);
	}
	const weeks = daysInclusive(statement.periodStart, statement.periodEnd) / 7;
	const drafts: Draft[] = [];
	for (const g of groups.values()) {
		const weekly = WEEKLY.includes(g.hint) && g.kind === 'expense';
		// Every kind of income matters; for spending, only the monthly kinds and repeated unknown payees.
		const monthly =
			g.kind === 'income' ||
			MONTHLY.includes(g.hint) ||
			(g.hint === 'other' && g.txns.length >= REPEATED_OTHER);
		if (weekly && g.txns.length < 2) continue;
		if (!weekly && !monthly) continue;
		const totalCents = g.txns.reduce((s, t) => s + t.amountCents, 0);
		const actualCents = weekly ? Math.round(totalCents / weeks) : totalCents;
		if (actualCents < 1) continue;
		const intervalDays = weekly ? 7 : 30;
		const recurrence = weekly ? 'days' : 'monthly';
		const lastSeen = g.txns
			.map((t) => t.date)
			.sort()
			.at(-1)!;
		drafts.push({
			id: '',
			kind: g.kind,
			name: nameFor(g.hint, g.payee, g.kind),
			actualCents,
			minCents: actualCents,
			maxCents: actualCents,
			intervalDays,
			recurrence,
			// Preserve the observed anchor, including month-end, in the saved stream.
			firstDate: weekly ? nextOccurrence(lastSeen, intervalDays, today) : lastSeen,
			hint: g.hint,
			count: g.txns.length,
			totalCents,
			lastSeen
		});
	}
	drafts.sort((a, b) =>
		a.kind === b.kind ? b.totalCents - a.totalCents : a.kind === 'income' ? -1 : 1
	);
	const kept = drafts.slice(0, MAX_DRAFTS).map((d, i) => ({ ...d, id: `${d.kind}-${i}` }));
	return { drafts: kept, dropped: drafts.length - kept.length };
}

export function buildPreview(statement: Statement, today: string): Preview {
	const txns = statement.txns.map(classify);
	const sum = (pick: (t: Classified) => boolean) =>
		txns.filter(pick).reduce((s, t) => s + t.amountCents, 0);
	const { drafts, dropped } = draftsFrom(statement, txns, today);
	const warnings = [...statement.warnings];
	if (drafts.length > 0) {
		warnings.push(
			'Amounts are this statement’s totals; import more months, or edit a range, to widen them.'
		);
	} else {
		warnings.push('No repeating payments were found; the totals above are still right.');
	}
	if (dropped > 0)
		warnings.push(`${dropped} smaller groups were left out to keep this list short.`);
	return {
		bank: statement.bank,
		periodStart: statement.periodStart,
		periodEnd: statement.periodEnd,
		totalInCents: sum((t) => t.direction === 'in' && t.hint !== 'transfer'),
		totalOutCents: sum((t) => t.direction === 'out' && t.hint !== 'transfer'),
		transferInCents: sum((t) => t.direction === 'in' && t.hint === 'transfer'),
		transferOutCents: sum((t) => t.direction === 'out' && t.hint === 'transfer'),
		txnCount: txns.length,
		reconciled: statement.reconciled,
		warnings,
		drafts
	};
}
