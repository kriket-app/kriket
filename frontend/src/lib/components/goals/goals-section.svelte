<script lang="ts">
	import type { Goal } from '$lib/api/types';
	import * as Card from '$lib/components/ui/card';
	import { formatGoalDate, today } from '$lib/dates';
	import { dollars } from '$lib/forecast-words';
	import { goalWords, monthlyWords, sharedBalanceNote } from '$lib/goal-words';

	let { goals, todayIso }: { goals: Goal[]; todayIso: string } = $props();

	// The API returns upcoming closest-first with past goals last; the overview shows at most three.
	const shown = $derived(goals.slice(0, 3));
	const extra = $derived(goals.length - shown.length);
	const balanceNote = $derived(sharedBalanceNote(goals));
	const todayValue = $derived(todayIso ?? today());
</script>

<Card.Root class="mt-4">
	<Card.Header>
		<Card.Title>Goals</Card.Title>
		<Card.Description>
			{#if goals.length === 0}
				What are you saving for? kriket reads your forecast on that day.
			{:else}
				Closest date first.
			{/if}
		</Card.Description>
		<Card.Action>
			<a href="/app/goals" class="text-sm font-medium text-brand-strong hover:underline">
				{goals.length === 0 ? 'Set a goal ›' : 'View all ›'}
			</a>
		</Card.Action>
	</Card.Header>
	{#if goals.length > 0}
		<Card.Content>
			<ul class="grid gap-3">
				{#each shown as goal (goal.id)}
					{@const words = goalWords(goal, todayValue)}
					{@const monthly = monthlyWords(goal)}
					<li class="flex items-baseline justify-between gap-3">
						<div class="min-w-0">
							<a href="/app/goals/{goal.id}" class="font-medium hover:underline">{goal.name}</a>
							<p class="truncate text-sm text-muted-foreground">
								{dollars(goal.amountCents)} by {formatGoalDate(goal.targetDate, todayValue)} ·
								{words.text}
								{#if monthly}· {monthly}{/if}
							</p>
						</div>
						<a
							href="/app/goals/{goal.id}"
							class="shrink-0 text-sm text-muted-foreground hover:text-foreground"
							aria-label="Open {goal.name}">›</a
						>
					</li>
				{/each}
			</ul>
			{#if extra > 0}
				<p class="mt-3 text-sm text-muted-foreground">
					<a href="/app/goals" class="hover:underline"
						>+{extra} more goal{extra === 1 ? '' : 's'} ›</a
					>
				</p>
			{/if}
			{#if balanceNote}<p class="mt-3 text-xs text-muted-foreground">{balanceNote}</p>{/if}
		</Card.Content>
	{/if}
</Card.Root>
