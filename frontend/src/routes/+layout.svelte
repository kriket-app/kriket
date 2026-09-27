<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import ReloadPrompt from '$lib/components/reload-prompt.svelte';

	// Each area brings its own chrome: the landing page and auth pages have their own header,
	// and /app has the app shell with the responsive nav.
	let { children } = $props();

	onMount(() => {
		// A push may have badged the app icon while it was closed; opening the app
		// clears it. No-op where badging is unsupported.
		(navigator as Navigator & { clearAppBadge?: () => Promise<void> })
			.clearAppBadge?.()
			?.catch(() => undefined);
	});
</script>

<svelte:head>
	<link rel="icon" href="/Kriket.svg" type="image/svg+xml" />
	<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
	<link rel="icon" href="/Kriket16x16.png" sizes="16x16" type="image/png" />
	<link rel="icon" href="/Kriket32x32.png" sizes="32x32" type="image/png" />
</svelte:head>

{@render children()}
<ReloadPrompt />
