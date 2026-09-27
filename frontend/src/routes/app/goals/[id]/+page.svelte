<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Pencil, Trash2 } from '@lucide/svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { formatDate } from '$lib/dates';
	import { dollars } from '$lib/forecast-words';
	import { goalWords, monthlyWords } from '$lib/goal-words';
	import GoalForm from '$lib/components/goals/goal-form.svelte';

	let { data, form } = $props();

	const words = $derived(goalWords(data.goal));
	const monthly = $derived(monthlyWords(data.goal));
	const failedEdit = $derived(form?.action === 'update' ? form.details : undefined);
	const borderClass = $derived(
		words.tone === 'short' ? 'border-l-4 border-l-expense' : 'border-l-4 border-l-brand'
	);
	let editing = $state(false);
</script>

<svelte:head><title>{data.goal.name} · Goals · kriket</title></svelte:head>

<a href="/app/goals" class="text-sm text-muted-foreground hover:text-foreground">← Goals</a>

<div class="mt-2 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-semibold tracking-tight">{data.goal.name}</h1>
	<div class="flex gap-1">
		<Dialog.Root bind:open={editing}>
			<Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
				<Pencil />Edit
			</Dialog.Trigger>
			<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<Dialog.Header><Dialog.Title>Edit {data.goal.name}</Dialog.Title></Dialog.Header>
				<GoalForm goal={data.goal} details={failedEdit} onsaved={() => (editing = false)} />
			</Dialog.Content>
		</Dialog.Root>
		<AlertDialog.Root>
			<AlertDialog.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
				<Trash2 />Delete
			</AlertDialog.Trigger>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>Delete {data.goal.name}?</AlertDialog.Title>
					<AlertDialog.Description
						>kriket stops checking your forecast against it.</AlertDialog.Description
					>
				</AlertDialog.Header>
				<form
					method="POST"
					action="?/delete"
					use:enhance={() =>
						async ({ result, update }) => {
							await update();
							if (result.type === 'success') await goto('/app/goals');
						}}
				>
					<input type="hidden" name="id" value={data.goal.id} />
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
					</AlertDialog.Footer>
				</form>
			</AlertDialog.Content>
		</AlertDialog.Root>
	</div>
</div>

{#if data.goal.description}
	<p class="mt-1 text-sm text-muted-foreground">{data.goal.description}</p>
{/if}

<Card.Root class="mt-6 {borderClass}">
	<Card.Header>
		<Card.Title>{dollars(data.goal.amountCents)} by {formatDate(data.goal.targetDate)}</Card.Title>
		<Card.Description>{words.text}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-2">
		{#if words.note}<p class="text-sm text-muted-foreground">{words.note}</p>{/if}
		{#if monthly}<p class="text-sm tabular-nums">{monthly}</p>{/if}
		{#if data.goal.status.state === 'forecast'}
			<p class="text-sm text-muted-foreground tabular-nums">
				Worst {dollars(data.goal.status.worstCents!)} · Expected {dollars(
					data.goal.status.expectedCents!
				)} · Best {dollars(data.goal.status.bestCents!)} on {formatDate(data.goal.targetDate)}
			</p>
		{/if}
	</Card.Content>
</Card.Root>
