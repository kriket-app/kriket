<script lang="ts">
	import { page } from '$app/state';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import Seo from '$lib/components/seo.svelte';
	import { Button } from '$lib/components/ui/button';

	const status = $derived(page.status);
	const isMissing = $derived(status === 404);
	const headline = $derived(isMissing ? 'Just crickets out here.' : 'The crickets got startled.');
	const body = $derived(
		isMissing
			? 'This page wandered off into the tall grass. Have a listen:'
			: 'Something went wrong on our end and the crickets have gone quiet. Try again in a moment.'
	);
</script>

<Seo
	title="{status} · kriket"
	description="Something went wrong — but the crickets are still here."
	noindex
/>

<div
	class="pt-safe flex min-h-dvh flex-col items-center justify-center gap-6 bg-brand-soft px-4 py-12 text-center"
>
	<BrandMark class="animate-chirp size-16" />
	<p class="text-6xl font-bold tracking-tight text-brand-strong tabular-nums">{status}</p>
	<div class="grid max-w-sm gap-2">
		<h1 class="text-2xl font-semibold tracking-tight text-balance">{headline}</h1>
		<p class="text-muted-foreground">{body}</p>
		<p class="mt-2 text-sm tracking-[0.3em] text-muted-foreground uppercase" aria-hidden="true">
			<span class="chirp-word">chirp</span> … <span class="chirp-word">chirp</span> …
			<span class="chirp-word">chirp</span>
		</p>
	</div>
	<div class="flex flex-wrap justify-center gap-3">
		<Button href="/app" size="lg" class="px-5">Back to your forecast</Button>
		<Button
			size="lg"
			variant="outline"
			class="px-5"
			onclick={() => {
				if (window.history.length > 1) window.history.back();
				else window.location.href = '/';
			}}
		>
			Go back
		</Button>
	</div>
</div>
