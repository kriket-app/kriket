<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import type { ComingUp, Tag } from '$lib/api/types';
	import TagDot from '$lib/components/tag-dot.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { formatDate } from '$lib/dates';
	import { amount, money } from '$lib/forecast-words';
	import { formatCents } from '$lib/money';
	import { cn } from '$lib/utils';

	/** One month of payments, grouped by day, with links to the months before and after. */
	let {
		comingUp,
		tags,
		days,
		hasStreams,
		class: className
	}: {
		comingUp: ComingUp;
		/** Colours the dots; an event's tag that is missing here gets no dot. */
		tags: Tag[];
		/** The forecast window, kept in the month links. */
		days: number;
		hasStreams: boolean;
		class?: string;
	} = $props();

	// Formatting only: the months and days come from the API, never from the browser's clock.
	const utc = (date: string) => new Date(`${date}T00:00:00Z`);
	const monthName = new Intl.DateTimeFormat('en-CA', { month: 'long', timeZone: 'UTC' });
	const monthAndYear = new Intl.DateTimeFormat('en-CA', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const weekdayAndDate = new Intl.DateTimeFormat('en-CA', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});

	/** "2026-12", 1 -> "2027-01". */
	function shiftMonth(month: string, by: number) {
		const [year, number] = month.split('-').map(Number);
		return new Date(Date.UTC(year, number - 1 + by, 1)).toISOString().slice(0, 7);
	}

	const colorOf = $derived(new Map(tags.map((tag) => [tag.id, tag.color])));
	const label = $derived(monthAndYear.format(utc(`${comingUp.month}-01`)));
	const isThisMonth = $derived(comingUp.month === comingUp.today.slice(0, 7));
	const atFirst = $derived(comingUp.month <= comingUp.firstMonth);
	const atLast = $derived(comingUp.month >= comingUp.lastMonth);
	const edgeNote = $derived(
		atFirst
			? `You started kriket in ${monthName.format(utc(`${comingUp.firstMonth}-01`))}.`
			: atLast
				? 'kriket looks a year ahead.'
				: null
	);
	// In today's month, the "Today" divider goes before the first day that is not past, or after
	// the last day when every one is.
	const todayAt = $derived.by(() => {
		if (!isThisMonth) return -1;
		const next = comingUp.days.findIndex((day) => !day.past);
		return next === -1 ? comingUp.days.length : next;
	});
	const monthHref = (month: string) => `?days=${days}&month=${month}`;
	const edgeNoteId = $props.id();
</script>

{#snippet todayDivider()}
	<li class="flex items-center gap-2 text-xs font-semibold text-brand-strong">
		<span class="h-0.5 w-3 rounded-full bg-brand" aria-hidden="true"></span>
		Today, {formatDate(comingUp.today)}
		<span class="h-0.5 flex-1 rounded-full bg-brand" aria-hidden="true"></span>
	</li>
{/snippet}

<Card.Root class={className}>
	<!-- On a phone the month switcher runs the card's full width, under the title. -->
	<Card.Header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<h2 class="text-base font-medium">Coming up</h2>
		<!-- Month links keep the page where it is instead of jumping to the top. -->
		<nav
			class="flex w-full items-center justify-between gap-1 sm:w-auto"
			aria-label="Month"
			data-sveltekit-noscroll
		>
			<Button
				href={monthHref(shiftMonth(comingUp.month, -1))}
				variant="outline"
				size="icon-sm"
				disabled={atFirst}
				aria-label="Previous month"
				aria-describedby={atFirst ? edgeNoteId : undefined}
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50"
			>
				<ChevronLeft />
			</Button>
			<p class="min-w-36 text-center font-semibold tabular-nums" aria-live="polite">{label}</p>
			<Button
				href={monthHref(shiftMonth(comingUp.month, 1))}
				variant="outline"
				size="icon-sm"
				disabled={atLast}
				aria-label="Next month"
				aria-describedby={atLast ? edgeNoteId : undefined}
				class="aria-disabled:pointer-events-none aria-disabled:opacity-50"
			>
				<ChevronRight />
			</Button>
		</nav>
		{#if edgeNote}
			<p id={edgeNoteId} class="w-full text-center text-xs text-muted-foreground sm:text-right">
				{edgeNote}
			</p>
		{/if}
	</Card.Header>
	<Card.Content class="gap-4">
		{#if comingUp.days.length && comingUp.month >= comingUp.today.slice(0, 7)}
			<p class="tabular-nums">
				<span class="whitespace-nowrap">
					In <span class="font-semibold text-brand-strong">{formatCents(comingUp.inCents)}</span>
				</span>
				·
				<span class="whitespace-nowrap">
					Out <span class="font-semibold text-expense-strong">{formatCents(comingUp.outCents)}</span
					>
				</span>
				{#if comingUp.endBalanceCents !== null}
					·
					<span class="whitespace-nowrap">
						Ends at
						<span class={cn('font-semibold', comingUp.endBalanceCents < 0 && 'text-expense-strong')}
							>{money(comingUp.endBalanceCents)}</span
						>
						expected
					</span>
				{/if}
				{#if isThisMonth}
					<span class="text-muted-foreground"
						>· <span class="whitespace-nowrap">counting from today</span></span
					>
				{/if}
			</p>
			<ol class="grid gap-3">
				{#each comingUp.days as day, i (day.date)}
					{#if i === todayAt}{@render todayDivider()}{/if}
					<li
						class={cn(
							'grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3',
							day.past && 'opacity-60'
						)}
					>
						<h3 class="text-xs font-medium text-muted-foreground sm:pt-1 sm:text-sm">
							{weekdayAndDate.format(utc(day.date))}
						</h3>
						<ul class="grid">
							{#each day.events as event (event.streamId)}
								{@const color = event.tagId ? colorOf.get(event.tagId) : undefined}
								<li class="flex items-center gap-3 py-1">
									{#if color !== undefined}
										<TagDot {color} />
									{:else}
										<span class="size-2.5 shrink-0" aria-hidden="true"></span>
									{/if}
									<span class="min-w-0 flex-1 truncate">{event.name}</span>
									<span
										class={cn(
											'font-medium whitespace-nowrap tabular-nums',
											event.kind === 'income' ? 'text-brand-strong' : 'text-expense-strong'
										)}>{amount(event.kind, event.actualCents)}</span
									>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
				{#if todayAt === comingUp.days.length}{@render todayDivider()}{/if}
			</ol>
		{:else if hasStreams}
			<p class="text-muted-foreground">Nothing scheduled in {label}.</p>
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
