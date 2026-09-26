<script lang="ts">
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { FieldError, Stream, StreamKind, Tag } from '$lib/api/types';
	import TagDot from '$lib/components/tag-dot.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
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
	const INTERVAL_PRESETS = [7, 14, 30, 365];

	// The form mounts fresh each time its dialog opens, so it starts from the stream as it is then.
	let tagId = $state(untrack(() => stream?.tagId ?? ''));
	let intervalDays = $state<number | null>(untrack(() => stream?.intervalDays ?? null));
	let saving = $state(false);
	// Only messages from a submit made since this form mounted: a reopened dialog starts clean.
	let submitted = $state(false);

	const selectedTag = $derived(tags.find((tag) => tag.id === tagId));
	const errorFor = (path: string) =>
		submitted ? details?.find((detail) => detail.path === path)?.message : undefined;
	const describedBy = (path: string) => (errorFor(path) ? `${id}-${path}-error` : undefined);

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

{#snippet amount(name: string, label: string, path: string, cents: number | undefined)}
	<div class="grid content-start gap-2">
		<Label for="{id}-{name}">{label}</Label>
		<Input
			id="{id}-{name}"
			{name}
			inputmode="decimal"
			placeholder="800.00"
			autocomplete="off"
			required
			value={cents === undefined ? '' : centsToDollars(cents)}
			aria-invalid={errorFor(path) ? true : undefined}
			aria-describedby={describedBy(path)}
		/>
		{@render fieldError(path)}
	</div>
{/snippet}

<form
	method="POST"
	action={stream ? '?/update' : '?/create'}
	use:enhance={submit}
	class="grid gap-4"
>
	{#if stream}<input type="hidden" name="id" value={stream.id} />{/if}

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
			</Select.Content>
		</Select.Root>
		{@render fieldError('tagId')}
	</div>

	<div class="grid grid-cols-3 gap-3">
		{@render amount('minimum', 'Minimum', 'minCents', stream?.minCents)}
		{@render amount('usual', 'Usual', 'actualCents', stream?.actualCents)}
		{@render amount('maximum', 'Maximum', 'maxCents', stream?.maxCents)}
	</div>

	<div class="grid gap-2">
		<Label for="{id}-interval">Repeats every (days)</Label>
		<div class="flex flex-wrap items-center gap-2">
			<Input
				id="{id}-interval"
				name="intervalDays"
				type="number"
				min="1"
				max="366"
				step="1"
				placeholder="14"
				required
				class="w-24"
				bind:value={intervalDays}
				aria-invalid={errorFor('intervalDays') ? true : undefined}
				aria-describedby={describedBy('intervalDays')}
			/>
			<div class="flex gap-1" role="group" aria-label="Common intervals, in days">
				{#each INTERVAL_PRESETS as days (days)}
					<Button
						size="xs"
						variant={intervalDays === days ? 'default' : 'outline'}
						aria-pressed={intervalDays === days}
						onclick={() => (intervalDays = days)}>{days}</Button
					>
				{/each}
			</div>
		</div>
		{@render fieldError('intervalDays')}
	</div>

	<div class="grid gap-2">
		<Label for="{id}-first-date">First payment date</Label>
		<Input
			id="{id}-first-date"
			name="firstDate"
			type="date"
			required
			value={stream?.firstDate ?? ''}
			aria-invalid={errorFor('firstDate') ? true : undefined}
			aria-describedby={describedBy('firstDate')}
		/>
		{@render fieldError('firstDate')}
	</div>

	<div class="flex justify-end">
		<Button type="submit" disabled={saving} class="w-full sm:w-auto">
			{stream ? 'Save' : kind === 'income' ? 'Add income' : 'Add expense'}
		</Button>
	</div>
</form>
