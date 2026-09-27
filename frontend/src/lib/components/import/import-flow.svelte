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
		added = {};
		try {
			preview = await importStatement(file);
			status = 'ready';
		} catch (err) {
			problem = err instanceof ImportError ? err.message : 'That file could not be read.';
			status = 'failed';
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
		<ul class="mt-4 grid gap-4 md:grid-cols-2">
			{#each preview.drafts as draft (draft.id)}
				<li data-testid="draft">
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
									onsaved={() => (added[draft.id] = true)}
								/>
							{/if}
						</Card.Content>
					</Card.Root>
				</li>
			{/each}
		</ul>
	{/if}

	{#if doneHref}
		<div class="mt-8 flex justify-end">
			<Button href={doneHref}>Done<ArrowRight /></Button>
		</div>
	{/if}
{/if}
