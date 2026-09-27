<script lang="ts">
	import { parseDate, type DateValue } from '@internationalized/date';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { FieldError, Goal } from '$lib/api/types';
	import { formatDate, monthsBetween, today } from '$lib/dates';
	import { parseDollars } from '$lib/money';
	import { Button } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import { centsToDollars, formatCents } from '$lib/money';

	let {
		goal,
		details,
		onsaved
	}: {
		goal?: Goal;
		details?: FieldError[];
		onsaved?: () => void;
	} = $props();

	const id = $props.id();
	const todayIso = today();

	const DURATIONS = [
		{ months: 3, label: '3 mo' },
		{ months: 6, label: '6 mo' },
		{ months: 12, label: '12 mo' }
	] as const;

	let amount = $state(untrack(() => (goal ? centsToDollars(goal.amountCents) : '')));
	let targetDate = $state<DateValue | undefined>(
		untrack(() => (goal?.targetDate ? parseDate(goal.targetDate) : undefined))
	);
	let popoverOpen = $state(false);
	let saving = $state(false);
	let submitted = $state(false);

	const targetIso = $derived(targetDate?.toString() ?? '');
	const errorFor = (path: string) =>
		submitted ? details?.find((detail) => detail.path === path)?.message : undefined;
	const describedBy = (path: string) => (errorFor(path) ? `${id}-${path}-error` : undefined);

	const dateButtonFormat = new Intl.DateTimeFormat('en-CA', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const formatTarget = (date: DateValue) => dateButtonFormat.format(date.toDate('UTC'));

	function setDuration(months: number) {
		const [y, m, d] = todayIso.split('-').map(Number);
		const total = (m - 1 + months) % 12;
		const year = y + Math.floor((m - 1 + months) / 12);
		const lastDay = new Date(Date.UTC(year, total + 1, 0)).getUTCDate();
		const day = Math.min(d, lastDay);
		targetDate = parseDate(
			`${year}-${String(total + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		);
	}

	// Live monthly preview: forecast-aware when editing (the goal carries its
	// status), naive target/months when adding (no forecast yet for the date).
	const preview = $derived(() => {
		const cents = parseDollars(amount);
		if (cents === null || cents <= 0 || !targetIso || targetIso < todayIso) return null;
		if (goal?.status.state === 'forecast' && goal.targetDate === targetIso) {
			const m = goal.status.monthlyNeededCents;
			if (m === null || m === undefined) return null;
			if (m === 0) return 'On track — no extra saving needed.';
			return `≈ ${formatCents(m)}/mo to get there.`;
		}
		const months = monthsBetween(todayIso, targetIso);
		return `≈ ${formatCents(Math.ceil(cents / months))}/mo for ${months} month${months === 1 ? '' : 's'} to reach ${formatCents(cents)} by ${formatDate(targetIso)}.`;
	});

	const submit: SubmitFunction = () => {
		saving = true;
		submitted = true;
		return async ({ result, update }) => {
			await update();
			saving = false;
			if (result.type === 'success') onsaved?.();
		};
	};
</script>

{#snippet fieldError(path: string)}
	{#if errorFor(path)}
		<p id="{id}-{path}-error" class="text-xs text-destructive first-letter:uppercase">
			{errorFor(path)}
		</p>
	{/if}
{/snippet}

<form method="POST" action={goal ? '?/update' : '?/create'} use:enhance={submit} class="grid gap-4">
	{#if goal}<input type="hidden" name="id" value={goal.id} />{/if}
	<input type="hidden" name="targetDate" value={targetIso} />

	<div class="grid gap-2">
		<Label for="{id}-name">What are you saving for?</Label>
		<Input
			id="{id}-name"
			name="name"
			required
			maxlength={100}
			autocomplete="off"
			placeholder="Trip home"
			value={goal?.name ?? ''}
			aria-invalid={errorFor('name') ? true : undefined}
			aria-describedby={describedBy('name')}
		/>
		{@render fieldError('name')}
	</div>

	<div class="grid gap-2">
		<Label for="{id}-amount">How much do you want to have?</Label>
		<Input
			id="{id}-amount"
			name="amount"
			inputmode="decimal"
			placeholder="1000.00"
			autocomplete="off"
			required
			bind:value={amount}
			aria-invalid={errorFor('amountCents') ? true : undefined}
			aria-describedby={describedBy('amountCents')}
		/>
		{@render fieldError('amountCents')}
	</div>

	<div class="grid gap-2">
		<Label for="{id}-description"
			>Description <span class="text-muted-foreground">(optional)</span></Label
		>
		<textarea
			id="{id}-description"
			name="description"
			maxlength={280}
			rows={2}
			placeholder="Flights for December"
			class="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
			>{goal?.description ?? ''}</textarea
		>
	</div>

	<div class="grid gap-2">
		<Label id="{id}-target-label">By when?</Label>
		<div class="flex flex-wrap gap-1" role="group" aria-label="Duration shortcuts">
			{#each DURATIONS as option (option.months)}
				<Button
					type="button"
					size="sm"
					variant="outline"
					onclick={() => setDuration(option.months)}
				>
					{option.label}
				</Button>
			{/each}
		</div>
		<Popover.Root bind:open={popoverOpen}>
			<Popover.Trigger
				id="{id}-target-button"
				aria-labelledby="{id}-target-label {id}-target-button"
				aria-invalid={errorFor('targetDate') ? true : undefined}
				aria-describedby={describedBy('targetDate')}
				class="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
			>
				{targetDate ? formatTarget(targetDate) : 'Pick a date'}
			</Popover.Trigger>
			<Popover.Content class="w-auto p-0">
				<Calendar
					type="single"
					value={targetDate}
					isDateDisabled={(date) => date.compare(parseDate(todayIso)) < 0}
					onValueChange={(value) => {
						targetDate = value;
						popoverOpen = false;
					}}
				/>
			</Popover.Content>
		</Popover.Root>
		{@render fieldError('targetDate')}
		{#if preview()}
			<p class="text-xs text-muted-foreground" aria-live="polite">{preview()}</p>
		{/if}
	</div>

	<div class="flex justify-end">
		<Button type="submit" disabled={saving} class="w-full sm:w-auto">
			{goal ? 'Save' : 'Set goal'}
		</Button>
	</div>
</form>
