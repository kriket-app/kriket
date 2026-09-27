<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import type { ActionState, Goal } from '$lib/api/types';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import GoalCard from './goal-card.svelte';
	import GoalForm from './goal-form.svelte';

	let { goals, form }: { goals: Goal[]; form: ActionState } = $props();

	const createDetails = $derived(form?.action === 'create' ? form.details : undefined);
	let adding = $state(false);
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold tracking-tight">Goals</h1>
	<Dialog.Root bind:open={adding}>
		<Dialog.Trigger class={buttonVariants({})}><Plus />New goal</Dialog.Trigger>
		<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
			<Dialog.Header><Dialog.Title>New goal</Dialog.Title></Dialog.Header>
			<GoalForm details={createDetails} onsaved={() => (adding = false)} />
		</Dialog.Content>
	</Dialog.Root>
</div>

{#if goals.length === 0}
	<div class="mt-6 rounded-lg border border-dashed p-8 text-center">
		<p class="font-medium">Saving for something?</p>
		<p class="mt-1 text-sm text-muted-foreground">
			Name it, pick an amount and a date, and kriket reads your forecast on that day.
		</p>
		<div class="mt-4">
			<Button onclick={() => (adding = true)}>Set a goal</Button>
		</div>
	</div>
{:else}
	<ul class="mt-6 grid gap-4 md:grid-cols-2">
		{#each goals as goal (goal.id)}
			<li><GoalCard {goal} {form} /></li>
		{/each}
	</ul>
{/if}
