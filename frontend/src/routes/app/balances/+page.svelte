<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import type { Checkin } from '$lib/api/types';
	import AnswerCard from '$lib/components/answer-card.svelte';
	import ForecastChart from '$lib/components/forecast-chart.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { formatDate } from '$lib/dates';
	import { money } from '$lib/forecast-words';
	import { cn } from '$lib/utils';

	let { data } = $props();

	const href = (checkinId: string) => `?checkin=${checkinId}&days=${data.days}`;

	/** The difference label and its colour for one check-in, against what the previous one expected. */
	function difference(checkin: Checkin) {
		if (checkin.differenceCents === null) return { label: 'first check-in', class: '' };
		if (checkin.differenceCents < 0) {
			return {
				label: `${money(Math.abs(checkin.differenceCents))} under forecast`,
				class: 'text-expense-strong'
			};
		}
		if (checkin.differenceCents > 0) {
			return {
				label: `${money(checkin.differenceCents)} over forecast`,
				class: 'text-brand-strong'
			};
		}
		return { label: 'on forecast', class: '' };
	}
</script>

<svelte:head><title>Your balances · kriket</title></svelte:head>

<a
	href="/app"
	class="rounded-sm text-sm font-medium text-brand-strong hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
	>← Overview</a
>

<div class="mt-2 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold tracking-tight">Your balances</h1>
	{#if data.forecast}
		{@const currentId = data.checkins[data.selectedIndex].id}
		<nav class="flex items-center gap-1" aria-label="Check-in">
			<Button
				href={href(data.previousId ?? currentId)}
				variant="outline"
				size="icon-sm"
				disabled={!data.previousId}
				aria-label="Previous check-in"
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50"
			>
				<ChevronLeft />
			</Button>
			<Button
				href={href(data.nextId ?? currentId)}
				variant="outline"
				size="icon-sm"
				disabled={!data.nextId}
				aria-label="Next check-in"
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50"
			>
				<ChevronRight />
			</Button>
		</nav>
	{/if}
</div>

{#if data.forecast && data.forecast.checkin}
	<p class="mt-4 text-sm text-muted-foreground">
		Forecast as of {formatDate(data.forecast.checkin.checkedOn)}, from {money(
			data.forecast.checkin.balanceCents
		)}
	</p>

	<div class="mt-2">
		<AnswerCard forecast={data.forecast} days={data.days} />
	</div>

	<Card.Root class="mt-4">
		<Card.Content>
			<ForecastChart points={data.forecast.points} events={data.forecast.events} />
		</Card.Content>
	</Card.Root>

	<Card.Root class="mt-4">
		<Card.Header>
			<Card.Title>Every check-in</Card.Title>
		</Card.Header>
		<Card.Content>
			<ul class="grid gap-1">
				{#each data.checkins as checkin, i (checkin.id)}
					{@const diff = difference(checkin)}
					<li>
						<a
							href={href(checkin.id)}
							aria-current={i === data.selectedIndex ? 'page' : undefined}
							class={cn(
								'flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-md px-3 py-2 text-sm',
								i === data.selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
							)}
						>
							<span class="font-medium tabular-nums">{formatDate(checkin.checkedOn)}</span>
							<span
								class={cn(
									'tabular-nums',
									checkin.balanceCents < 0 ? 'text-expense-strong' : undefined
								)}>{money(checkin.balanceCents)}</span
							>
							<span class={cn('ml-auto text-xs tabular-nums', diff.class)}>{diff.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>

	<p class="mt-4 text-xs text-muted-foreground">
		Every time you save a balance, kriket keeps it. Flip back to see what the forecast looked like
		then.
	</p>
{:else}
	<p class="mt-6 text-muted-foreground">
		No balances yet. Save one on the <a
			href="/app"
			class="font-medium text-brand-strong hover:underline">overview</a
		>.
	</p>
{/if}
