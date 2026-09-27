<script lang="ts" module>
	// The last shown value per id, kept outside the component so the count
	// survives the forecast window's keyed remounts (30/90/180 days).
	const previous = new Map<string, number>();
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { money } from '$lib/forecast-words';

	/** A money figure that counts (ease-out, ~350ms) toward a new value instead of swapping. */
	let { cents, id }: { cents: number; id: string } = $props();

	const reduceMotion = browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	// The server value on purpose: first paint (and SSR) shows the real figure.
	let shown = $state(untrack(() => cents));

	$effect(() => {
		if (!browser) return;
		const from = previous.get(id) ?? cents;
		previous.set(id, cents);
		if (from === cents || reduceMotion) {
			shown = cents;
			return;
		}
		let raf = 0;
		const start = performance.now();
		const duration = 350;
		const tick = (now: number) => {
			const k = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - k, 3);
			shown = Math.round(from + (cents - from) * eased);
			if (k < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<span class="whitespace-nowrap tabular-nums">{money(shown)}</span>
