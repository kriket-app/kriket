<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { ActionState, Goal } from '$lib/api/types';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { formatGoalDate } from '$lib/dates';
	import { dollars } from '$lib/forecast-words';
	import { goalWords, monthlyWords } from '$lib/goal-words';
	import GoalForm from './goal-form.svelte';

	let {
		goal,
		form,
		expectedOn
	}: {
		goal: Goal;
		form: ActionState;
		expectedOn?: (date: string) => number | null;
	} = $props();

	const words = $derived(goalWords(goal));
	const monthly = $derived(monthlyWords(goal));
	const failedEdit = $derived(
		form?.action === 'update' && form.values?.id === goal.id ? form.details : undefined
	);
	const progress = $derived(
		goal.status.state === 'forecast' && goal.status.expectedCents !== null && goal.amountCents > 0
			? Math.min(100, Math.max(0, (goal.status.expectedCents / goal.amountCents) * 100))
			: null
	);
	const barClass = $derived(words.tone === 'short' ? 'bg-expense' : 'bg-brand');
	let editing = $state(false);
</script>

<Card.Root size="sm" class="h-full">
	<Card.Header>
		<Card.Title class="text-base font-semibold">
			<a href="/app/goals/{goal.id}" class="hover:underline">{goal.name}</a>
		</Card.Title>
		<Card.Description>
			{dollars(goal.amountCents)} by {formatGoalDate(goal.targetDate)}
		</Card.Description>
		<Card.Action class="flex gap-1">
			<Dialog.Root bind:open={editing}>
				<Dialog.Trigger
					class={buttonVariants({ variant: 'ghost', size: 'sm' })}
					aria-label="Edit {goal.name}"
				>
					<Pencil /><span class="hidden sm:inline">Edit</span>
				</Dialog.Trigger>
				<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
					<Dialog.Header><Dialog.Title>Edit {goal.name}</Dialog.Title></Dialog.Header>
					<GoalForm {goal} {expectedOn} details={failedEdit} onsaved={() => (editing = false)} />
				</Dialog.Content>
			</Dialog.Root>
			<AlertDialog.Root>
				<AlertDialog.Trigger
					class={buttonVariants({ variant: 'ghost', size: 'sm' })}
					aria-label="Delete {goal.name}"
				>
					<Trash2 /><span class="hidden sm:inline">Delete</span>
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Delete {goal.name}?</AlertDialog.Title>
						<AlertDialog.Description
							>kriket stops checking your forecast against it.</AlertDialog.Description
						>
					</AlertDialog.Header>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={goal.id} />
						<AlertDialog.Footer>
							<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
							<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
						</AlertDialog.Footer>
					</form>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</Card.Action>
	</Card.Header>
	<Card.Content class="grid gap-2">
		<p class="text-sm">{words.text}</p>
		{#if words.note}<p class="text-xs text-muted-foreground">{words.note}</p>{/if}
		{#if monthly}<p class="text-xs text-muted-foreground tabular-nums">{monthly}</p>{/if}
		{#if progress !== null}
			<div
				class="h-2 overflow-hidden rounded-full bg-muted"
				role="progressbar"
				aria-valuenow={Math.round(progress)}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="{goal.name} progress"
			>
				<div class="h-full {barClass}" style="width: {progress}%"></div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
