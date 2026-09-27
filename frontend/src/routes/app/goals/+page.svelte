<script lang="ts">
	import GoalsPage from '$lib/components/goals/goals-page.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Goals · kriket</title></svelte:head>

<GoalsPage goals={data.goals} forecastPoints={data.forecastPoints} {form} />
