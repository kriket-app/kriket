<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements';

	// The kriket logo: a white cricket on a rounded brand-green square. Decorative, so it sits
	// next to the "kriket" wordmark and stays hidden from screen readers.
	let { class: className, ...rest }: SVGAttributes<SVGSVGElement> = $props();
</script>

<svg viewBox="0 0 32 32" class={className} aria-hidden="true" {...rest}>
	<rect width="32" height="32" rx="8" fill="var(--brand)" />
	<g fill="none" stroke="var(--brand-foreground)" stroke-linecap="round" stroke-linejoin="round">
		<path
			d="M22.5 13.4C24 9.6 26 7.6 28.4 6.6M21 13C21.2 9.4 22.6 6.9 24.8 5.4"
			stroke-width="1.2"
		/>
		<path d="M13.4 17.6 8.6 11.8 6.2 22.4" stroke-width="1.8" />
		<path d="M18.4 20.2 19.6 24.4M15 21 14.4 24.8" stroke-width="1.3" />
	</g>
	<g fill="var(--brand-foreground)">
		<ellipse cx="14.6" cy="18.4" rx="6.8" ry="3.5" transform="rotate(-14 14.6 18.4)" />
		<circle cx="21.6" cy="15.6" r="2.6" />
	</g>
</svg>
