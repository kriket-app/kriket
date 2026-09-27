<script lang="ts">
	import { Pencil, Plus, Trash2 } from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import type { Tag } from '$lib/api/types';
	import ColorPicker from '$lib/components/color-picker.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { data, form } = $props();

	// The "Add a tag" row's colour, until the user picks one; the first swatch is as good a
	// default as any (colours only ever come from the API now, never a copy of the presets).
	let newColor = $state('#22c55e');

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

	// A row's colour picker submits itself the moment a colour is chosen, via the form
	// surrounding it: each row keeps its own form element here to call requestSubmit() on.
	const submitRecolor: SubmitFunction =
		() =>
		async ({ update }) =>
			update();
	let recolorForms: Record<string, HTMLFormElement> = {};
</script>

<svelte:head><title>Tags · kriket</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Tags</h1>
<p class="mt-1 text-sm text-muted-foreground">Four presets to start. Any colour you like.</p>

<Card.Root class="mt-6">
	<Card.Content>
		<form method="POST" action="?/create" use:enhance class="flex flex-wrap items-end gap-4">
			<div class="grid gap-2">
				<Label>Colour</Label>
				<ColorPicker name="color" bind:value={newColor} />
			</div>
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
			<Button type="submit"><Plus />Add tag</Button>
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
					<form
						method="POST"
						action="?/update"
						use:enhance={submitRecolor}
						bind:this={recolorForms[tag.id]}
					>
						<input type="hidden" name="id" value={tag.id} />
						<ColorPicker
							name="color"
							value={tag.color ?? ''}
							onchange={() => recolorForms[tag.id]?.requestSubmit()}
						/>
					</form>
					<a href="/app/tags/{tag.id}" class="min-w-0 flex-1 truncate font-medium hover:underline">
						{tag.name}
					</a>
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
