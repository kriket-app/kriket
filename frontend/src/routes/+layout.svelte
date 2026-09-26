<script lang="ts">
	import './layout.css';

	// Each area brings its own chrome: the landing page and auth pages have their own header,
	// and /app has the app shell with the responsive nav.
	let { children } = $props();
</script>

<svelte:head><link rel="icon" href="/icon.svg" type="image/svg+xml" /></svelte:head>

{@render children()}
