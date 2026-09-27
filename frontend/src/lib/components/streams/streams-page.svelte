<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import type { ActionState, Stream, StreamKind, Tag, SubscriptionDigest } from '$lib/api/types';
	import { page } from '$app/state';
	import SubscriptionReview from '$lib/components/subscription-review.svelte';
	import { formatCents } from '$lib/money';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Chirp from '$lib/components/chirp.svelte';
	import StreamCard from './stream-card.svelte';
	import StreamForm from './stream-form.svelte';

	let {
		data,
		form
	}: {
		data: { kind: StreamKind; streams: Stream[]; tags: Tag[]; digest?: SubscriptionDigest | null };
		form: ActionState;
	} = $props();

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
	let subscriptionMode = $state(false);
	const subscriptionsOnly = $derived(
		data.kind === 'expense' && page.url.searchParams.get('filter') === 'subscriptions'
	);
	const visibleStreams = $derived(
		subscriptionsOnly ? data.streams.filter((s) => s.isSubscription) : data.streams
	);
</script>

<svelte:head><title>{copy.title} · kriket</title></svelte:head>

{#snippet addButton()}
	<div class="flex flex-wrap gap-2">
		<Button
			onclick={() => {
				subscriptionMode = false;
				adding = true;
			}}><Plus />{copy.add}</Button
		>
		{#if data.kind === 'expense'}<Button
				variant="outline"
				onclick={() => {
					subscriptionMode = true;
					adding = true;
				}}><Plus />Add subscription</Button
			>{/if}
	</div>
{/snippet}

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">{copy.title}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
		<a
			href="/app/import"
			class="mt-1 inline-block text-sm text-brand-strong underline-offset-4 hover:underline"
		>
			Import from a statement
		</a>
	</div>
	{@render addButton()}
</div>

{#if data.kind === 'expense'}
	<nav class="mt-4 flex gap-2" aria-label="Expense filter">
		<Button
			href="/app/expenses"
			variant={subscriptionsOnly ? 'outline' : 'secondary'}
			aria-current={!subscriptionsOnly ? 'page' : undefined}>All expenses</Button
		>
		<Button
			href="/app/expenses?filter=subscriptions"
			variant={subscriptionsOnly ? 'secondary' : 'outline'}
			aria-current={subscriptionsOnly ? 'page' : undefined}>Subscriptions</Button
		>
	</nav>
	{#if data.digest}
		{#if subscriptionsOnly && data.digest.count > 0}
			<p class="mt-4 text-sm text-muted-foreground">
				{data.digest.count}
				{data.digest.count === 1 ? 'subscription' : 'subscriptions'} · about {formatCents(
					data.digest.monthlyCents
				)}/month
			</p>
		{/if}
		<SubscriptionReview digest={data.digest} />
	{/if}
{/if}

{#if visibleStreams.length === 0}
	<div
		class="mt-6 flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center"
	>
		<Chirp class="size-8" />
		<div class="grid gap-1">
			<p class="font-medium">Quiet in here… just crickets.</p>
			<p class="max-w-sm text-muted-foreground">
				{subscriptionsOnly
					? 'No subscriptions yet. Add one, or edit an existing expense and mark it as a subscription.'
					: copy.empty}
			</p>
		</div>
		{@render addButton()}
	</div>
{:else}
	<ul class="mt-6 grid gap-4 md:grid-cols-2">
		{#each visibleStreams as stream (stream.id)}
			<li><StreamCard kind={data.kind} {stream} tags={data.tags} {form} /></li>
		{/each}
	</ul>
{/if}

<Dialog.Root bind:open={adding}>
	<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
		<Dialog.Header
			><Dialog.Title>{subscriptionMode ? 'Add subscription' : copy.add}</Dialog.Title
			></Dialog.Header
		>
		<StreamForm
			kind={data.kind}
			{subscriptionMode}
			tags={data.tags}
			details={form?.action === 'create' ? form.details : undefined}
			onsaved={() => (adding = false)}
		/>
	</Dialog.Content>
</Dialog.Root>
