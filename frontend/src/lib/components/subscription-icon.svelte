<script lang="ts">
	import { iconUrlFor, presetForName } from '$lib/subscriptions';
	let { name }: { name: string } = $props();
	const preset = $derived(presetForName(name));
	const url = $derived(preset ? iconUrlFor(preset) : null);
	let failedUrl = $state<string | null>(null);
</script>

<span class="inline-flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
	{#if url && failedUrl !== url}
		<img src={url} alt="" class="size-5 object-contain" onerror={() => (failedUrl = url)} />
	{:else}
		<span>{preset?.emoji ?? '🔁'}</span>
	{/if}
</span>
