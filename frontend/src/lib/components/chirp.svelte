<script lang="ts">
	import BrandMark from './brand-mark.svelte';
	import { cn } from '$lib/utils';

	// The celebrating cricket: a squash-and-stretch hop, with an optional
	// hopping label ("Chirp!", "Goal set!"). Decorative, like BrandMark.
	// The hop replays every time the component mounts, so wrap it in a
	// {#key ...} to replay it for repeat moments (e.g. every check-in save).
	let { class: className, label = null }: { class?: string; label?: string | null } = $props();
</script>

<span class="inline-flex shrink-0 items-center gap-1.5" aria-hidden="true">
	<BrandMark class={cn('size-5', 'animate-chirp', className)} />
	{#if label}<span class="animate-hop-in text-sm font-semibold text-brand-strong">{label}</span
		>{/if}
</span>
