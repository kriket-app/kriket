<script lang="ts">
	import StreamsPage from '$lib/components/streams/streams-page.svelte';

	let { data, form } = $props();
</script>

<StreamsPage {data} {form} />
