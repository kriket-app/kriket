<script lang="ts">
	import { ArrowRight, Check, FileText } from '@lucide/svelte';
	import type { ActionState, Tag } from '$lib/api/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatDate } from '$lib/dates';
	import { ImportError, importStatement, type Draft, type Hint, type Preview } from '$lib/import';
	import { formatCents } from '$lib/money';
	import StreamForm from '$lib/components/streams/stream-form.svelte';

	let {
		tags,
		form,
		doneHref = '/app'
	}: {
		tags: Tag[];
		form: ActionState;
		/** Where the Done button goes; null hides it (the host page continues the flow). */
		doneHref?: string | null;
	} = $props();

	let status = $state<'idle' | 'reading' | 'ready' | 'failed'>('idle');
	let preview = $state<Preview | null>(null);
	let problem = $state('');
	// The raw error behind the generic message, shown small so a phone user can report it.
	let problemDetail = $state('');
	// Draft ids the user has added this visit; a fresh file starts over. Never stored anywhere.
	let added = $state<Record<string, boolean>>({});

	/** The preset tag a draft's hint maps to, when the user still has it. */
	const TAG_FOR: Partial<Record<Hint, string>> = {
		pay: 'Pay cheque',
		'e-transfer': 'Side hustle',
		groceries: 'Groceries',
		subscription: 'Bill',
		utilities: 'Bill',
		rent: 'Bill',
		fees: 'Bill'
	};
	const tagIdFor = (draft: Draft) =>
		draft.kind === 'expense' && draft.hint === 'e-transfer'
			? null
			: (tags.find((tag) => tag.name === TAG_FOR[draft.hint])?.id ?? null);

	async function read(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		status = 'reading';
		preview = null;
		problem = '';
		problemDetail = '';
		added = {};
		try {
			preview = await importStatement(file);
			status = 'ready';
		} catch (err) {
			// Not an ImportError means something unexpected; keep the cause for whoever debugs it.
			if (!(err instanceof ImportError)) console.error('Statement import failed', err);
			if (!(err instanceof ImportError))
				problemDetail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
			problem = err instanceof ImportError ? err.message : 'That file could not be read.';
			status = 'failed';
		}
	}

	const incomeDrafts = $derived(preview?.drafts.filter((d) => d.kind === 'income') ?? []);
	const expenseDrafts = $derived(preview?.drafts.filter((d) => d.kind === 'expense') ?? []);
	const remaining = $derived(preview?.drafts.filter((d) => !added[d.id]).length ?? 0);

	// "Add all" submits each remaining draft's own form, one at a time, so edits the user
	// made to a draft are kept and each add goes through the same action as its button.
	let list: HTMLElement | undefined = $state();
	let addingAll = $state(false);
	const waiting = new Map<string, () => void>();
	function saved(id: string) {
		added[id] = true;
		waiting.get(id)?.();
		waiting.delete(id);
	}
	async function addAll() {
		if (!list || !preview) return;
		addingAll = true;
		try {
			for (const draft of preview.drafts) {
				if (added[draft.id]) continue;
				const formEl = list.querySelector<HTMLFormElement>(`[data-draft-id="${draft.id}"] form`);
				if (!formEl) continue;
				// Resolve on save, or give up on this draft after 10 s (a validation error leaves it open).
				await new Promise<void>((resolve) => {
					waiting.set(draft.id, resolve);
					setTimeout(resolve, 10_000);
					formEl.requestSubmit();
				});
				waiting.delete(draft.id);
			}
		} finally {
			addingAll = false;
		}
	}

	const evidence = (draft: Draft) =>
		`${draft.count} ${draft.kind === 'income' ? 'deposit' : 'payment'}${draft.count === 1 ? '' : 's'} this statement, ${formatCents(draft.totalCents)}`;
</script>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="flex items-center gap-2"
			><FileText class="size-5" /> Statement PDF</Card.Title
		>
		<Card.Description>
			It's read here in your browser and never uploaded; only the streams you add are saved. Reload
			and it's gone.
		</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-2">
		<Label for="statement">Statement PDF</Label>
		<Input id="statement" type="file" accept="application/pdf,.pdf" onchange={read} />
		{#if status === 'reading'}
			<p class="text-sm text-muted-foreground" aria-live="polite">Reading…</p>
		{:else if status === 'failed'}
			<p class="text-sm text-destructive" role="alert">{problem}</p>
			{#if problemDetail}
				<p class="font-mono text-xs break-all text-muted-foreground">{problemDetail}</p>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>

{#if preview}
	<Card.Root class="mt-4">
		<Card.Header>
			<Card.Title>Statement</Card.Title>
			<Card.Description>
				{formatDate(preview.periodStart)} to {formatDate(preview.periodEnd)} · {preview.txnCount} transactions
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4">
			<dl class="grid grid-cols-3 gap-3 text-sm">
				<div>
					<dt class="text-muted-foreground">Money in</dt>
					<dd class="font-semibold text-brand-strong">{formatCents(preview.totalInCents)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Money out</dt>
					<dd class="font-semibold text-expense-strong">{formatCents(preview.totalOutCents)}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Between your accounts</dt>
					<dd class="font-semibold">
						{formatCents(preview.transferOutCents + preview.transferInCents)}
					</dd>
				</div>
			</dl>
			{#if preview.reconciled}
				<p class="flex items-center gap-1.5 text-sm text-brand-strong">
					<Check class="size-4" /> Adds up: opening balance, minus what went out, plus what came in, matches
					the closing balance.
				</p>
			{/if}
			{#if preview.warnings.length}
				<ul class="grid gap-1 text-sm text-muted-foreground">
					{#each preview.warnings as warning (warning)}<li>{warning}</li>{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if preview.drafts.length}
		<h2 class="mt-8 text-lg font-semibold">Streams kriket found</h2>
		<p class="mt-1 text-sm text-muted-foreground">
			Change anything, then add the ones you want. Skip the rest.
		</p>
		<div class="mt-4 flex items-center justify-between gap-3">
			<p class="text-sm text-muted-foreground" aria-live="polite">
				{remaining === 0 ? 'All added.' : `${remaining} left to add`}
			</p>
			<Button onclick={addAll} disabled={addingAll || remaining === 0}>
				{addingAll ? 'Adding…' : 'Add all'}
			</Button>
		</div>
		<div bind:this={list}>
			{#each [{ title: 'Income', drafts: incomeDrafts }, { title: 'Expenses', drafts: expenseDrafts }] as section (section.title)}
				{#if section.drafts.length}
					<h3 class="mt-6 text-base font-semibold">{section.title}</h3>
					<ul class="mt-3 grid gap-4 md:grid-cols-2">
						{#each section.drafts as draft (draft.id)}
							{@render draftCard(draft)}
						{/each}
					</ul>
				{/if}
			{/each}
		</div>
	{/if}

	{#if doneHref}
		<div class="mt-8 flex justify-end">
			<Button href={doneHref}>Done<ArrowRight /></Button>
		</div>
	{/if}
{/if}

{#snippet draftCard(draft: Draft)}
	<li data-testid="draft" data-draft-id={draft.id}>
		<Card.Root>
			<Card.Header>
				<Card.Title>{draft.name}</Card.Title>
				<Card.Description>{evidence(draft)}</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if added[draft.id]}
					<p class="flex items-center gap-1.5 text-sm text-brand-strong">
						<Check class="size-4" /> Added
					</p>
				{:else}
					<StreamForm
						kind={draft.kind}
						{tags}
						initial={{
							name: draft.name,
							tagId: tagIdFor(draft),
							minCents: draft.minCents,
							maxCents: draft.maxCents,
							actualCents: draft.actualCents,
							intervalDays: draft.intervalDays,
							firstDate: draft.firstDate
						}}
						hidden={{ kind: draft.kind, draftId: draft.id }}
						details={form?.values?.draftId === draft.id ? form.details : undefined}
						onsaved={() => saved(draft.id)}
					/>
				{/if}
			</Card.Content>
		</Card.Root>
	</li>
{/snippet}
