<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import ForecastChart from '$lib/components/forecast-chart.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatDate } from '$lib/dates';
	import { centsToDollars, formatCents } from '$lib/money';
	import { cn } from '$lib/utils';

	let { data, form } = $props();

	const WINDOWS = [30, 90, 180];
	const stats = $derived([
		{ label: 'Worst case', cents: data.forecast.endBalance.minCents },
		{ label: 'Expected', cents: data.forecast.endBalance.actualCents },
		{ label: 'Best case', cents: data.forecast.endBalance.maxCents }
	]);
	const upcoming = $derived(data.forecast.events.slice(0, 8));
	const signed = (cents: number) => `${cents < 0 ? '−' : '+'}${formatCents(Math.abs(cents))}`;
	const errorFor = (path: string) =>
		form?.action === 'settings'
			? form.details?.find((detail) => detail.path === path)?.message
			: undefined;
	const balanceError = $derived(errorFor('startingBalanceCents'));
	const dateError = $derived(errorFor('startingDate'));
</script>

<svelte:head><title>Overview · kriket</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold tracking-tight">Your next {data.days} days</h1>
	<nav class="flex gap-1 rounded-full bg-muted p-1" aria-label="Forecast length">
		{#each WINDOWS as days (days)}
			<a
				href="?days={days}"
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

{#if data.hasStreams}
	<div class="mt-6 grid gap-3 sm:grid-cols-3">
		{#each stats as stat (stat.label)}
			{@const change = stat.cents - data.forecast.startingBalanceCents}
			<Card.Root size="sm">
				<Card.Content class="grid gap-1">
					<p class="text-muted-foreground">{stat.label}</p>
					<p class="text-2xl font-semibold tabular-nums">{formatCents(stat.cents)}</p>
					<p
						class={cn('tabular-nums', change >= 0 ? 'text-brand-strong' : 'text-muted-foreground')}
					>
						{signed(change)} from today
					</p>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<Card.Root class="mt-4">
		<Card.Header>
			<Card.Title>Balance forecast</Card.Title>
			<Card.Description>
				The line uses your usual amounts; the band runs from the worst case to the best.
			</Card.Description>
		</Card.Header>
		<Card.Content><ForecastChart points={data.forecast.points} /></Card.Content>
	</Card.Root>
{:else}
	<Card.Root class="mt-6 border-0 bg-brand-soft ring-0">
		<Card.Header>
			<Card.Title class="text-lg">Let's hear some chirping</Card.Title>
			<Card.Description>
				Add the money that comes in, your pay or your shifts, and kriket draws where your balance is
				heading: worst case, usual, and best case.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button href="/app/income" class="self-start">Add your income<ArrowRight /></Button>
		</Card.Content>
	</Card.Root>
{/if}

<div class="mt-4 grid gap-4 md:grid-cols-2">
	<Card.Root>
		<Card.Header>
			<Card.Title>Your balance today</Card.Title>
			<Card.Description>The forecast starts from here.</Card.Description>
		</Card.Header>
		<Card.Content>
			<!-- reset: false keeps the saved values in the inputs instead of the page's first render. -->
			<form
				method="POST"
				action="?/settings"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
				class="grid gap-4"
			>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid content-start gap-2">
						<Label for="balance">Balance</Label>
						<!-- No inputmode="decimal": the iOS decimal pad has no minus key, and balances can be negative. -->
						<Input
							id="balance"
							name="balance"
							autocomplete="off"
							required
							value={centsToDollars(data.settings.startingBalanceCents)}
							aria-invalid={balanceError ? true : undefined}
							aria-describedby={balanceError ? 'balance-error' : undefined}
						/>
						{#if balanceError}
							<p id="balance-error" class="text-xs text-destructive first-letter:uppercase">
								{balanceError}
							</p>
						{/if}
					</div>
					<div class="grid content-start gap-2">
						<Label for="as-of">As of</Label>
						<Input
							id="as-of"
							name="asOf"
							type="date"
							required
							value={data.settings.startingDate}
							aria-invalid={dateError ? true : undefined}
							aria-describedby={dateError ? 'as-of-error' : undefined}
						/>
						{#if dateError}
							<p id="as-of-error" class="text-xs text-destructive first-letter:uppercase">
								{dateError}
							</p>
						{/if}
					</div>
				</div>
				<div class="flex justify-end">
					<Button type="submit" class="w-full sm:w-auto">Save</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header><Card.Title>Coming up</Card.Title></Card.Header>
		<Card.Content>
			{#if upcoming.length}
				<ul class="divide-y">
					{#each upcoming as event (`${event.streamId}-${event.date}`)}
						<li class="flex items-center gap-3 py-2">
							<span class="w-14 shrink-0 text-muted-foreground tabular-nums">
								{formatDate(event.date)}
							</span>
							<span class="min-w-0 flex-1 truncate">{event.name}</span>
							<span
								class={cn(
									'font-medium tabular-nums',
									event.kind === 'income' ? 'text-brand-strong' : 'text-foreground'
								)}
							>
								{event.kind === 'income' ? '+' : '−'}{formatCents(event.actualCents)}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-muted-foreground">
					Nothing scheduled yet. Add
					<a href="/app/income" class="font-medium text-brand-strong hover:underline">income</a>
					or
					<a href="/app/expenses" class="font-medium text-brand-strong hover:underline">expenses</a>
					to see what's coming.
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
