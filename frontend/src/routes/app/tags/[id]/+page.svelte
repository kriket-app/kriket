<script lang="ts">
	import StreamCard from '$lib/components/streams/stream-card.svelte';
	import TagDot from '$lib/components/tag-dot.svelte';
	import { repeatText } from '$lib/dates';
	import { formatCents } from '$lib/money';

	let { data, form } = $props();

	const totalCount = $derived(data.incomeStreams.length + data.expenseStreams.length);

	// Only sum a single figure when every stream on the tag is the same kind AND shares an
	// interval — never net income against expenses into one number (controller ruling R11).
	// `oneKindTotal` is set only in that case, so the markup can colour the amount the same way
	// stream-card does (brand-strong in, expense-strong out).
	const oneKindTotal = $derived.by(() => {
		if (totalCount === 0) return null;
		const sameKind = data.incomeStreams.length === 0 || data.expenseStreams.length === 0;
		const intervals = new Set(
			[...data.incomeStreams, ...data.expenseStreams].map((stream) => stream.intervalDays)
		);
		if (!sameKind || intervals.size !== 1) return null;
		const [interval] = intervals;
		const isIncome = data.expenseStreams.length === 0;
		const streams = isIncome ? data.incomeStreams : data.expenseStreams;
		const total = streams.reduce((sum, stream) => sum + stream.actualCents, 0);
		return { total, isIncome, interval };
	});
	const summaryPrefix = $derived.by(() => {
		if (totalCount === 0) return 'No streams yet.';
		const streamsWord = totalCount === 1 ? 'stream' : 'streams';
		return `${totalCount} ${streamsWord}`;
	});
	const summarySuffix = $derived.by(() => {
		if (oneKindTotal) return repeatText(oneKindTotal.interval);
		if (totalCount === 0) return null;
		return `${data.incomeStreams.length} in, ${data.expenseStreams.length} out`;
	});
</script>

<svelte:head><title>{data.tag.name} · Tags · kriket</title></svelte:head>

<a href="/app/tags" class="text-sm text-muted-foreground hover:text-foreground hover:underline">
	← Tags
</a>

<div class="mt-2 flex items-center gap-2">
	<TagDot color={data.tag.color} class="size-4" />
	<h1 class="text-2xl font-semibold tracking-tight">{data.tag.name}</h1>
</div>
<p class="mt-1 text-sm text-muted-foreground">
	{#if oneKindTotal}
		{summaryPrefix} ·
		<span class={oneKindTotal.isIncome ? 'text-brand-strong' : 'text-expense-strong'}
			>{formatCents(oneKindTotal.total)} {oneKindTotal.isIncome ? 'in' : 'out'}</span
		>
		{summarySuffix}
	{:else}
		{summaryPrefix}{#if summarySuffix}
			· {summarySuffix}{/if}
	{/if}
</p>

{#if totalCount > 0}
	<ul class="mt-6 grid gap-4 md:grid-cols-2">
		{#each data.incomeStreams as stream (stream.id)}
			<li><StreamCard kind="income" {stream} tags={data.tags} {form} /></li>
		{/each}
		{#each data.expenseStreams as stream (stream.id)}
			<li><StreamCard kind="expense" {stream} tags={data.tags} {form} /></li>
		{/each}
	</ul>
{/if}
