<script lang="ts">
	import { untrack } from 'svelte';
	import { Plus } from '@lucide/svelte';
	import type { ActionState, Goal } from '$lib/api/types';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import Chirp from '$lib/components/chirp.svelte';
	import { sharedBalanceNote } from '$lib/goal-words';
	import GoalCard from './goal-card.svelte';
	import GoalForm from './goal-form.svelte';

	let {
		goals,
		form,
		forecastPoints
	}: {
		goals: Goal[];
		form: ActionState;
		forecastPoints: { date: string; actualCents: number }[];
	} = $props();

	const createDetails = $derived(form?.action === 'create' ? form.details : undefined);
	const balanceNote = $derived(sharedBalanceNote(goals));
	const expectedOn = (date: string) =>
		forecastPoints.find((point) => point.date === date)?.actualCents ?? null;
	let adding = $state(false);

	// Goals that arrive after first render were just created here: their cards hop
	// in with a chirp, then settle back to normal after a few seconds.
	const initialIds = new Set(untrack(() => goals.map((goal) => goal.id)));
	let freshIds = $state(new Set<string>());
	$effect(() => {
		const arrived = goals
			.map((goal) => goal.id)
			.filter((id) => !initialIds.has(id) && !freshIds.has(id));
		if (arrived.length === 0) return;
		freshIds = new Set([...freshIds, ...arrived]);
		const timer = setTimeout(() => {
			freshIds = new Set([...freshIds].filter((id) => !arrived.includes(id)));
		}, 3000);
		return () => clearTimeout(timer);
	});
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold tracking-tight">Goals</h1>
	<Dialog.Root bind:open={adding}>
		<Dialog.Trigger class={buttonVariants({})}><Plus />New goal</Dialog.Trigger>
		<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
			<Dialog.Header><Dialog.Title>New goal</Dialog.Title></Dialog.Header>
			<GoalForm details={createDetails} {expectedOn} onsaved={() => (adding = false)} />
		</Dialog.Content>
	</Dialog.Root>
</div>

{#if balanceNote}<p class="mt-2 text-sm text-muted-foreground">{balanceNote}</p>{/if}

{#if goals.length === 0}
	<div class="mt-6 rounded-lg border border-dashed p-8 text-center">
		<Chirp class="mx-auto size-8" />
		<p class="mt-3 font-medium">Quiet in here… just crickets.</p>
		<p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
			Name it, pick an amount and a date, and kriket reads your forecast on that day.
		</p>
		<div class="mt-4">
			<Button onclick={() => (adding = true)}>Set a goal</Button>
		</div>
	</div>
{:else}
	<ul class="mt-6 grid gap-4 md:grid-cols-2">
		{#each goals as goal (goal.id)}
			<li><GoalCard {goal} {form} {expectedOn} fresh={freshIds.has(goal.id)} /></li>
		{/each}
	</ul>
{/if}
