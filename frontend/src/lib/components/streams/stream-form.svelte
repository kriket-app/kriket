<script lang="ts">
	import { parseDate, type DateValue } from '@internationalized/date';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { FieldError, Stream, StreamKind, Tag } from '$lib/api/types';
	import TagDot from '$lib/components/tag-dot.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import * as Select from '$lib/components/ui/select';
	import { centsToDollars } from '$lib/money';

	let {
		kind,
		tags,
		stream,
		details,
		onsaved
	}: {
		kind: StreamKind;
		tags: Tag[];
		/** The stream being edited; without one the form adds a new stream. */
		stream?: Stream;
		/** Field messages from this form's last failed submit, keyed by the API field in `path`. */
		details?: FieldError[];
		/** Runs after a successful save, so the dialog around the form can close. */
		onsaved?: () => void;
	} = $props();

	const id = $props.id();

	/** The Tag select's "New tag…" option; a made-up id no real tag ever has. */
	const NEW_TAG_VALUE = '__new__';

	const REPEAT_OPTIONS = [
		{ days: 7, label: 'Weekly' },
		{ days: 14, label: 'Every 2 weeks' },
		{ days: 30, label: 'Monthly' }
	] as const;
	type RepeatChoice = 7 | 14 | 30 | 'custom';

	// The form mounts fresh each time its dialog opens, so it starts from the stream as it is then.
	let tagId = $state(untrack(() => stream?.tagId ?? ''));
	let usual = $state(untrack(() => (stream ? centsToDollars(stream.actualCents) : '')));
	let minimum = $state(untrack(() => (stream ? centsToDollars(stream.minCents) : '')));
	let maximum = $state(untrack(() => (stream ? centsToDollars(stream.maxCents) : '')));
	let rangeOpen = $state(
		untrack(() =>
			stream
				? stream.minCents !== stream.actualCents || stream.maxCents !== stream.actualCents
				: false
		)
	);
	let repeatChoice = $state<RepeatChoice>(
		untrack(() => {
			const days = stream?.intervalDays;
			if (days === 7 || days === 14 || days === 30) return days;
			return days === undefined ? 7 : 'custom';
		})
	);
	let customDays = $state<number | null>(
		untrack(() => {
			const days = stream?.intervalDays;
			return days !== undefined && days !== 7 && days !== 14 && days !== 30 ? days : null;
		})
	);
	let nextDate = $state<DateValue | undefined>(
		untrack(() => (stream?.firstDate ? parseDate(stream.firstDate) : undefined))
	);
	let nextDatePopoverOpen = $state(false);
	let saving = $state(false);
	// Only messages from a submit made since this form mounted: a reopened dialog starts clean.
	let submitted = $state(false);

	const nextDateIso = $derived(nextDate?.toString() ?? '');
	const selectedTag = $derived(tags.find((tag) => tag.id === tagId));
	const newTagChosen = $derived(tagId === NEW_TAG_VALUE);
	const errorFor = (path: string) =>
		submitted ? details?.find((detail) => detail.path === path)?.message : undefined;
	const describedBy = (path: string) => (errorFor(path) ? `${id}-${path}-error` : undefined);

	const dateButtonFormat = new Intl.DateTimeFormat('en-CA', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const formatNextDate = (date: DateValue) => dateButtonFormat.format(date.toDate('UTC'));

	function openRange() {
		if (!minimum) minimum = usual;
		if (!maximum) maximum = usual;
		rangeOpen = true;
	}

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

<form
	method="POST"
	action={stream ? '?/update' : '?/create'}
	use:enhance={submit}
	class="grid gap-4"
>
	{#if stream}<input type="hidden" name="id" value={stream.id} />{/if}
	<input type="hidden" name="firstDate" value={nextDateIso} />
	{#if repeatChoice !== 'custom'}
		<input type="hidden" name="intervalDays" value={repeatChoice} />
	{/if}

	<div class="grid gap-2">
		<Label for="{id}-name">Name</Label>
		<Input
			id="{id}-name"
			name="name"
			required
			maxlength={100}
			autocomplete="off"
			placeholder={kind === 'income' ? 'Pay cheque' : 'Rent'}
			value={stream?.name ?? ''}
			aria-invalid={errorFor('name') ? true : undefined}
			aria-describedby={describedBy('name')}
		/>
		{@render fieldError('name')}
	</div>

	<div class="grid gap-2">
		<Label for="{id}-usual">Usual amount</Label>
		<Input
			id="{id}-usual"
			name="usual"
			inputmode="decimal"
			placeholder="85.00"
			autocomplete="off"
			required
			bind:value={usual}
			aria-invalid={errorFor('actualCents') ? true : undefined}
			aria-describedby={describedBy('actualCents') ?? `${id}-usual-hint`}
		/>
		<p id="{id}-usual-hint" class="text-xs text-muted-foreground">Just the usual is enough</p>
		{@render fieldError('actualCents')}
	</div>

	<div class="grid gap-2">
		<Label id="{id}-repeat-label">Repeats</Label>
		<div class="flex flex-wrap gap-1" role="group" aria-labelledby="{id}-repeat-label">
			{#each REPEAT_OPTIONS as option (option.days)}
				<Button
					type="button"
					size="sm"
					variant={repeatChoice === option.days ? 'default' : 'outline'}
					aria-pressed={repeatChoice === option.days}
					onclick={() => (repeatChoice = option.days)}
				>
					{option.label}
				</Button>
			{/each}
			<Button
				type="button"
				size="sm"
				variant={repeatChoice === 'custom' ? 'default' : 'outline'}
				aria-pressed={repeatChoice === 'custom'}
				onclick={() => (repeatChoice = 'custom')}
			>
				Every N days
			</Button>
		</div>
		{#if repeatChoice === 'custom'}
			<div class="grid gap-2">
				<Label for="{id}-repeat-days">Days</Label>
				<Input
					id="{id}-repeat-days"
					name="intervalDays"
					type="number"
					min="1"
					max="366"
					step="1"
					required
					class="w-24"
					bind:value={customDays}
					aria-invalid={errorFor('intervalDays') ? true : undefined}
					aria-describedby={describedBy('intervalDays')}
				/>
			</div>
		{/if}
		{@render fieldError('intervalDays')}
	</div>

	<div class="grid gap-2">
		<Label id="{id}-next-date-label">Next date</Label>
		<Popover.Root bind:open={nextDatePopoverOpen}>
			<Popover.Trigger
				id="{id}-next-date-button"
				aria-labelledby="{id}-next-date-label {id}-next-date-button"
				aria-invalid={errorFor('firstDate') ? true : undefined}
				aria-describedby={describedBy('firstDate')}
				class="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
			>
				{nextDate ? formatNextDate(nextDate) : 'Pick a date'}
			</Popover.Trigger>
			<Popover.Content class="w-auto p-0">
				<Calendar
					type="single"
					value={nextDate}
					onValueChange={(value) => {
						nextDate = value;
						nextDatePopoverOpen = false;
					}}
				/>
			</Popover.Content>
		</Popover.Root>
		{@render fieldError('firstDate')}
	</div>

	<div class="grid gap-2">
		<Label for="{id}-tag">Tag</Label>
		<Select.Root type="single" name="tagId" bind:value={tagId}>
			<Select.Trigger
				id="{id}-tag"
				class="w-full"
				aria-invalid={errorFor('tagId') ? true : undefined}
				aria-describedby={describedBy('tagId')}
			>
				<span class="flex items-center gap-2">
					{#if selectedTag}
						<TagDot color={selectedTag.color} />{selectedTag.name}
					{:else if newTagChosen}
						New tag…
					{:else}
						No tag
					{/if}
				</span>
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="" label="No tag" />
				{#each tags as tag (tag.id)}
					<Select.Item value={tag.id} label={tag.name}>
						<TagDot color={tag.color} class="self-center" />{tag.name}
					</Select.Item>
				{/each}
				<Select.Item value={NEW_TAG_VALUE} label="New tag…" />
			</Select.Content>
		</Select.Root>
		{@render fieldError('tagId')}
		{#if newTagChosen}
			<div class="grid gap-2">
				<Label for="{id}-new-tag-name">New tag name</Label>
				<Input
					id="{id}-new-tag-name"
					name="newTagName"
					required
					maxlength={40}
					autocomplete="off"
					placeholder="Coffee"
					aria-invalid={errorFor('newTagName') ? true : undefined}
					aria-describedby={describedBy('newTagName')}
				/>
				{@render fieldError('newTagName')}
			</div>
		{/if}
	</div>

	<div class="grid gap-2">
		{#if !rangeOpen}
			<Button
				type="button"
				variant="link"
				class="justify-start px-0"
				aria-expanded="false"
				onclick={openRange}
			>
				Add a range
			</Button>
			<p class="text-xs text-muted-foreground">
				If you skip this, minimum and maximum equal the usual amount
			</p>
		{:else}
			<Button
				type="button"
				variant="link"
				class="justify-start px-0"
				aria-expanded="true"
				onclick={() => (rangeOpen = false)}
			>
				Remove the range
			</Button>
			<div class="grid grid-cols-2 gap-3">
				<div class="grid content-start gap-2">
					<Label for="{id}-minimum">Minimum</Label>
					<Input
						id="{id}-minimum"
						name="minimum"
						inputmode="decimal"
						placeholder="60.00"
						autocomplete="off"
						required
						bind:value={minimum}
						aria-invalid={errorFor('minCents') ? true : undefined}
						aria-describedby={describedBy('minCents')}
					/>
					{@render fieldError('minCents')}
				</div>
				<div class="grid content-start gap-2">
					<Label for="{id}-maximum">Maximum</Label>
					<Input
						id="{id}-maximum"
						name="maximum"
						inputmode="decimal"
						placeholder="120.00"
						autocomplete="off"
						required
						bind:value={maximum}
						aria-invalid={errorFor('maxCents') ? true : undefined}
						aria-describedby={describedBy('maxCents')}
					/>
					{@render fieldError('maxCents')}
				</div>
			</div>
		{/if}
	</div>

	<div class="flex justify-end">
		<Button type="submit" disabled={saving} class="w-full sm:w-auto">
			{stream ? 'Save' : kind === 'income' ? 'Add income' : 'Add expense'}
		</Button>
	</div>
</form>
