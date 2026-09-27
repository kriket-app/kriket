<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import AnswerCard from '$lib/components/answer-card.svelte';
	import CheckinCard from '$lib/components/checkin-card.svelte';
	import ComingUp from '$lib/components/coming-up.svelte';
	import ForecastChart from '$lib/components/forecast-chart.svelte';
	import ForecastTiles from '$lib/components/forecast-tiles.svelte';
	import PushSettings from '$lib/components/push-settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';

	let { data, form } = $props();

	const WINDOWS = [30, 90, 180];
	// Switching the window keeps the month Coming up shows (left out when it is today's month).
	const monthQuery = $derived(
		data.comingUp.month === data.comingUp.today.slice(0, 7) ? '' : `&month=${data.comingUp.month}`
	);
</script>

<svelte:head><title>Overview · kriket</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold tracking-tight">Your next {data.days} days</h1>
	<nav class="flex gap-1 rounded-full bg-muted p-1" aria-label="Forecast length">
		{#each WINDOWS as days (days)}
			<a
				href="?days={days}{monthQuery}"
				aria-current={days === data.days ? 'page' : undefined}
				class={cn(
					'rounded-full px-3 py-1 text-sm font-medium tabular-nums',
					days === data.days
						? 'bg-background text-brand-strong shadow-xs'
						: 'text-muted-foreground hover:text-foreground'
				)}>{days} days</a
			>
		{/each}
	</nav>
</div>

<!-- The check-in and the answer share the first row from md up; the check-in comes first below. -->
<div class="mt-6 grid gap-4 md:grid-cols-2">
	<CheckinCard
		latest={data.checkins[0]}
		today={data.comingUp.today}
		expectedTodayCents={data.forecast.points[0]?.actualCents ?? 0}
		{form}
	/>
	{#if data.hasStreams}
		<AnswerCard forecast={data.forecast} days={data.days} />
	{:else}
		<Card.Root class="border-0 bg-brand-soft ring-0">
			<Card.Header>
				<Card.Title class="text-lg">Let's hear some chirping</Card.Title>
				<Card.Description>
					Add the money that comes in, your pay or your shifts, and kriket draws where your balance
					is heading: worst case, usual, and best case.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button href="/app/income" class="self-start">Add your income<ArrowRight /></Button>
			</Card.Content>
		</Card.Root>
	{/if}
</div>

{#if data.hasStreams}
	<Card.Root class="mt-4">
		<Card.Header>
			<Card.Title>Balance forecast</Card.Title>
			<Card.Description>
				The line uses your usual amounts; the band runs from the worst case to the best. Each dot is
				a payment; tap one for its name and amount.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<ForecastChart points={data.forecast.points} events={data.forecast.events} />
			<ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
				<li class="flex items-center gap-1.5">
					<span class="size-2.5 rounded-full bg-brand"></span>Money in
				</li>
				<li class="flex items-center gap-1.5">
					<span class="size-2.5 rounded-full bg-expense"></span>Money out
				</li>
				{#if data.forecast.firstBelowZero}
					<li class="flex items-center gap-1.5">
						<span class="h-2 w-3.5 rounded-xs bg-expense/25"></span>Below zero
					</li>
				{/if}
			</ul>
		</Card.Content>
	</Card.Root>

	<ForecastTiles forecast={data.forecast} class="mt-4" />
{/if}

<ComingUp
	comingUp={data.comingUp}
	tags={data.tags}
	days={data.days}
	hasStreams={data.hasStreams}
	class="mt-4"
/>

<div class="mt-4">
	<PushSettings />
</div>
