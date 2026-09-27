<script lang="ts">
	import { Pencil, Trash2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { ActionState, Stream, StreamKind, Tag } from '$lib/api/types';
	import TagDot from '$lib/components/tag-dot.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { formatDate, nextOccurrence, repeatText as repeatTextOf } from '$lib/dates';
	import { formatCents } from '$lib/money';
	import StreamForm from './stream-form.svelte';

	let {
		kind,
		stream,
		tags,
		form
	}: { kind: StreamKind; stream: Stream; tags: Tag[]; form: ActionState } = $props();

	// A stream whose tag was deleted has tagId null and simply shows no badge.
	const tag = $derived(tags.find((t) => t.id === stream.tagId));
	const failedEdit = $derived(
		form?.action === 'update' && form.values?.id === stream.id ? form.details : undefined
	);
	const repeatText = $derived(repeatTextOf(stream.intervalDays));
	const isRanged = $derived(
		stream.minCents !== stream.actualCents || stream.maxCents !== stream.actualCents
	);
	const amountClass = $derived(kind === 'income' ? 'text-brand-strong' : 'text-expense-strong');
	const nextDateText = $derived(
		`next ${formatDate(nextOccurrence(stream.firstDate, stream.intervalDays))}`
	);
	let editing = $state(false);
</script>

<Card.Root size="sm" class="h-full">
	<Card.Header>
		<Card.Title class="text-base font-semibold">{stream.name}</Card.Title>
		{#if tag}
			<Card.Description>
				<Badge variant="outline"><TagDot color={tag.color} />{tag.name}</Badge>
			</Card.Description>
		{/if}
		<Card.Action class="flex gap-1">
			<Dialog.Root bind:open={editing}>
				<Dialog.Trigger
					class={buttonVariants({ variant: 'ghost', size: 'sm' })}
					aria-label="Edit {stream.name}"
				>
					<Pencil /><span class="hidden sm:inline">Edit</span>
				</Dialog.Trigger>
				<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto">
					<Dialog.Header><Dialog.Title>Edit {stream.name}</Dialog.Title></Dialog.Header>
					<StreamForm
						{kind}
						{tags}
						{stream}
						details={failedEdit}
						onsaved={() => (editing = false)}
					/>
				</Dialog.Content>
			</Dialog.Root>
			<AlertDialog.Root>
				<AlertDialog.Trigger
					class={buttonVariants({ variant: 'ghost', size: 'sm' })}
					aria-label="Delete {stream.name}"
				>
					<Trash2 /><span class="hidden sm:inline">Delete</span>
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Delete {stream.name}?</AlertDialog.Title>
						<AlertDialog.Description
							>It stops counting toward your forecast.</AlertDialog.Description
						>
					</AlertDialog.Header>
					<!-- A successful delete reruns the page's load, which removes this card and its dialog. -->
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={stream.id} />
						<AlertDialog.Footer>
							<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
							<AlertDialog.Action type="submit" variant="destructive">Delete</AlertDialog.Action>
						</AlertDialog.Footer>
					</form>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</Card.Action>
	</Card.Header>
	<Card.Content class="grid gap-1">
		{#if isRanged}
			<p class="font-medium tabular-nums">
				Usually <span class={amountClass}>{formatCents(stream.actualCents)}</span> ·
				<span class={amountClass}
					>{formatCents(stream.minCents)} to {formatCents(stream.maxCents)}</span
				>
				· {repeatText} · {nextDateText}
			</p>
		{:else}
			<p class="font-medium tabular-nums">
				<span class={amountClass}>{formatCents(stream.actualCents)}</span> · {repeatText} · {nextDateText}
			</p>
		{/if}
	</Card.Content>
</Card.Root>
