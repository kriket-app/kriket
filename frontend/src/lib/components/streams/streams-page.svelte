<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import type { ActionState, Stream, StreamKind, Tag } from '$lib/api/types';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Chirp from '$lib/components/chirp.svelte';
	import StreamCard from './stream-card.svelte';
	import StreamForm from './stream-form.svelte';

	let {
		data,
		form
	}: { data: { kind: StreamKind; streams: Stream[]; tags: Tag[] }; form: ActionState } = $props();

	const COPY = {
		income: {
			title: 'Income',
			add: 'Add income',
			subtitle: 'Add what comes in on a rhythm. Just the usual amount is enough.',
			empty: 'No income streams yet. Add your pay, shifts, or any money that comes in on a rhythm.'
		},
		expense: {
			title: 'Expenses',
			add: 'Add expense',
			subtitle: 'Add what goes out on a rhythm. Just the usual amount is enough.',
			empty:
				'No expenses yet. Add rent, groceries, subscriptions, or anything that goes out on a rhythm.'
		}
	};
	const copy = $derived(COPY[data.kind]);
	let adding = $state(false);
</script>

<svelte:head><title>{copy.title} · kriket</title></svelte:head>

{#snippet addButton()}
	<Button onclick={() => (adding = true)}><Plus />{copy.add}</Button>
{/snippet}

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{copy.title}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
	</div>
	{@render addButton()}
</div>

{#if data.streams.length === 0}
	<div
		class="mt-6 flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center"
	>
		<Chirp class="size-8" />
		<div class="grid gap-1">
			<p class="font-medium">Quiet in here… just crickets.</p>
			<p class="max-w-sm text-muted-foreground">{copy.empty}</p>
		</div>
		{@render addButton()}
	</div>
{:else}
	<ul class="mt-6 grid gap-4 md:grid-cols-2">
		{#each data.streams as stream (stream.id)}
			<li><StreamCard kind={data.kind} {stream} tags={data.tags} {form} /></li>
		{/each}
	</ul>
{/if}

<Dialog.Root bind:open={adding}>
	<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
		<Dialog.Header><Dialog.Title>{copy.add}</Dialog.Title></Dialog.Header>
		<StreamForm
			kind={data.kind}
			tags={data.tags}
			details={form?.action === 'create' ? form.details : undefined}
			onsaved={() => (adding = false)}
		/>
	</Dialog.Content>
</Dialog.Root>
