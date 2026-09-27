<script lang="ts">
	import type { components } from '$lib/api/schema';
	import * as Card from '$lib/components/ui/card';
	import { formatDate } from '$lib/dates';
	import { money, signed } from '$lib/forecast-words';
	import { cn } from '$lib/utils';

	type Forecast = components['schemas']['Forecast'];

	/** The three small numbers under the chart: the lowest point, and the end of the window. */
	let {
		forecast,
		class: className
	}: {
		forecast: Pick<Forecast, 'points' | 'endDate' | 'endBalance' | 'lowest'>;
		class?: string;
	} = $props();

	// The forecast's first point is today's expected balance (the check-in, rolled forward).
	const change = $derived(forecast.endBalance.actualCents - (forecast.points[0]?.actualCents ?? 0));
	const end = $derived(formatDate(forecast.endDate));
	const balanceClass = (cents: number) => (cents < 0 ? 'text-expense-strong' : undefined);
</script>

<!-- Stacked rows on a phone (label left, number right); three cards side by side from sm up.
     A value of two amounts reads "$A to $B", and each amount stays on one line. -->
{#snippet tile(
	label: string,
	amounts: string[],
	valueClass?: string,
	note?: string,
	noteClass?: string
)}
	<Card.Root size="sm">
		<Card.Content
			class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 sm:grid-cols-1 sm:items-start"
		>
			<p class="text-muted-foreground">{label}</p>
			<p
				class={cn(
					'row-span-2 text-right text-lg font-semibold tracking-tight tabular-nums sm:row-span-1 sm:text-left sm:text-xl',
					valueClass
				)}
			>
				{#each amounts as text, i (i)}
					{#if i}{' to '}{/if}<span class="whitespace-nowrap">{text}</span>
				{/each}
			</p>
			{#if note}
				<p class={cn('text-muted-foreground tabular-nums', noteClass)}>{note}</p>
			{/if}
		</Card.Content>
	</Card.Root>
{/snippet}

<div class={cn('grid gap-3 sm:grid-cols-3', className)}>
	{@render tile(
		'Lowest point',
		[money(forecast.lowest.cents)],
		balanceClass(forecast.lowest.cents),
		formatDate(forecast.lowest.date)
	)}
	{@render tile(
		`Expected on ${end}`,
		[money(forecast.endBalance.actualCents)],
		balanceClass(forecast.endBalance.actualCents),
		`${signed(change)} from today`,
		change < 0 ? 'text-expense-strong' : 'text-brand-strong'
	)}
	{@render tile(
		`Worst to best on ${end}`,
		[money(forecast.endBalance.minCents), money(forecast.endBalance.maxCents)],
		balanceClass(forecast.endBalance.minCents)
	)}
</div>
