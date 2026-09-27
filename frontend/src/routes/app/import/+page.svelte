<script lang="ts">
	import ImportFlow from '$lib/components/import/import-flow.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Import a statement · kriket</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Import a statement</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Start from a bank statement instead of typing everything in.
		</p>
	</div>
</div>

<ImportFlow tags={data.tags} {form} doneHref="/app" />
