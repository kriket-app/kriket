<script lang="ts">
	import { Pencil, Plus, Trash2 } from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import type { Tag } from '$lib/api/types';
	import TagDot from '$lib/components/tag-dot.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data, form } = $props();

	// The preset tags' colours (PRESET_TAGS in the backend's tags service), offered for new tags.
	const SWATCHES = [
		{ color: '#16a34a', label: 'Green' },
		{ color: '#22c55e', label: 'Bright green' },
		{ color: '#0f766e', label: 'Teal' },
		{ color: '#65a30d', label: 'Lime' },
		{ color: '#0891b2', label: 'Cyan' },
		{ color: '#4d7c0f', label: 'Olive' },
		{ color: '#84cc16', label: 'Light lime' },
		{ color: '#15803d', label: 'Forest green' }
	];
	const swatchClass =
		'cursor-pointer rounded-full p-0.5 ring-offset-2 ring-offset-background has-checked:ring-2 has-checked:ring-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-ring';

	// One rename dialog and one delete dialog serve every row; `target` is the row they act on.
	let target = $state<Tag | null>(null);
	let renaming = $state(false);
	let deleting = $state(false);
	// Reset each time the rename dialog opens, so it never shows the previous attempt's error.
	let renameSubmitted = $state(false);

	const errorFor = (action: string, path: string) =>
		form?.action === action
			? form.details?.find((detail) => detail.path === path)?.message
			: undefined;
	const renameError = $derived(renameSubmitted ? errorFor('update', 'name') : undefined);

	const submitRename: SubmitFunction = () => {
		renameSubmitted = true;
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') renaming = false;
		};
	};
	const submitDelete: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') deleting = false;
		};
</script>

<svelte:head><title>Tags · kriket</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Tags</h1>
<p class="mt-1 text-sm text-muted-foreground">
	Group your income and expenses. Eight come ready to use; add your own.
</p>

<Card.Root class="mt-6">
	<Card.Content>
		<form method="POST" action="?/create" use:enhance class="flex flex-wrap items-start gap-4">
			<div class="grid min-w-48 grow basis-56 gap-2">
				<Label for="new-tag-name">New tag</Label>
				<Input
					id="new-tag-name"
					name="name"
					required
					maxlength={40}
					autocomplete="off"
					placeholder="Coffee"
					value={form?.action === 'create' ? (form.values?.name ?? '') : ''}
					aria-invalid={errorFor('create', 'name') ? true : undefined}
					aria-describedby={errorFor('create', 'name') ? 'new-tag-name-error' : undefined}
				/>
				{#if errorFor('create', 'name')}
					<p id="new-tag-name-error" class="text-xs text-destructive first-letter:uppercase">
						{errorFor('create', 'name')}
					</p>
				{/if}
			</div>
			<fieldset>
				<legend class="mb-2 text-sm leading-none font-medium">Colour</legend>
				<div class="flex flex-wrap items-center gap-1.5">
					<label class={swatchClass}>
						<input type="radio" name="color" value="" checked class="sr-only" />
						<span class="block rounded-full border px-2.5 py-1 text-xs">None</span>
					</label>
					{#each SWATCHES as swatch (swatch.color)}
						<label class={swatchClass}>
							<input type="radio" name="color" value={swatch.color} class="sr-only" />
							<span class="block size-7 rounded-full" style:background-color={swatch.color}></span>
							<span class="sr-only">{swatch.label}</span>
						</label>
					{/each}
				</div>
				{#if errorFor('create', 'color')}
					<p class="mt-2 text-xs text-destructive first-letter:uppercase">
						{errorFor('create', 'color')}
					</p>
				{/if}
			</fieldset>
			<Button type="submit" class="self-end"><Plus />Add tag</Button>
		</form>
	</Card.Content>
</Card.Root>

{#if data.tags.length === 0}
	<p class="mt-6 text-muted-foreground">No tags yet. Add one above.</p>
{:else}
	<Card.Root class="mt-6 py-0">
		<ul class="divide-y">
			{#each data.tags as tag (tag.id)}
				<li class="flex items-center gap-3 px-4 py-3">
					<TagDot color={tag.color} class="size-3" />
					<span class="min-w-0 flex-1 truncate font-medium">{tag.name}</span>
					{#if tag.isPreset}<Badge variant="secondary">preset</Badge>{/if}
					<Button
						variant="ghost"
						size="sm"
						aria-label="Rename {tag.name}"
						onclick={() => {
							target = tag;
							renameSubmitted = false;
							renaming = true;
						}}
					>
						<Pencil /><span class="hidden sm:inline">Rename</span>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						aria-label="Delete {tag.name}"
						onclick={() => {
							target = tag;
							deleting = true;
						}}
					>
						<Trash2 /><span class="hidden sm:inline">Delete</span>
					</Button>
				</li>
			{/each}
		</ul>
	</Card.Root>
{/if}

<Dialog.Root bind:open={renaming}>
	<Dialog.Content>
		{#if target}
			<Dialog.Header><Dialog.Title>Rename {target.name}</Dialog.Title></Dialog.Header>
			<form method="POST" action="?/update" use:enhance={submitRename} class="grid gap-4">
				<input type="hidden" name="id" value={target.id} />
				<div class="grid gap-2">
					<Label for="rename-tag-name">Name</Label>
					<Input
						id="rename-tag-name"
						name="name"
						required
						maxlength={40}
						autocomplete="off"
						value={target.name}
						aria-invalid={renameError ? true : undefined}
						aria-describedby={renameError ? 'rename-tag-name-error' : undefined}
					/>
					{#if renameError}
						<p id="rename-tag-name-error" class="text-xs text-destructive first-letter:uppercase">
							{renameError}
						</p>
					{/if}
				</div>
				<div class="flex justify-end">
					<Button type="submit" class="w-full sm:w-auto">Save</Button>
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={deleting}>
	<AlertDialog.Content>
		{#if target}
			<AlertDialog.Header>
				<AlertDialog.Title>Delete {target.name}?</AlertDialog.Title>
				<AlertDialog.Description>
					Streams using this tag keep working, untagged.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<form method="POST" action="?/delete" use:enhance={submitDelete}>
				<input type="hidden" name="id" value={target.id} />
				<AlertDialog.Footer>
					<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
					<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
				</AlertDialog.Footer>
			</form>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
