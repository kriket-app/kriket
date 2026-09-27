<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';

	// The kriket logo, served from the same file as the favicon and PWA icons
	// so the in-app mark always matches the installed icon. Decorative, so it
	// sits next to the "kriket" wordmark and stays hidden from screen readers.
	let { class: className, ...rest }: HTMLImgAttributes = $props();
</script>

<img src="/Kriket.svg" alt="" draggable="false" class={className} {...rest} />
