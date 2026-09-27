<script lang="ts">
	import { WifiOff } from '@lucide/svelte';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
</script>

<svelte:head><title>Offline · kriket</title></svelte:head>

<div class="flex min-h-dvh flex-col bg-background text-foreground">
	<header class="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
		<a href="/" class="flex items-center gap-2 text-lg font-semibold">
			<BrandMark class="size-7" /> kriket
		</a>
	</header>
	<main class="mx-auto flex w-full max-w-md flex-1 items-center px-4 sm:px-6">
		<Card.Root class="w-full">
			<Card.Header>
				<span
					class="mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"
				>
					<WifiOff class="size-5" />
				</span>
				<Card.Title class="text-xl">You're offline</Card.Title>
				<Card.Description>
					Kriket needs a connection to load your forecast. Anything you already opened stays
					available; new pages will load when you're back.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-wrap gap-2">
				<Button href="/" class="flex-1">Back home</Button>
				<!-- A reload, not a link: the service worker shows this page at the address the
					visitor asked for, so reloading retries that page. (This page is prerendered, and
					hooks.server.ts fails the build if a prerendered page links to /app.) -->
				<Button variant="outline" class="flex-1" onclick={() => window.location.reload()}>
					Retry
				</Button>
			</Card.Content>
		</Card.Root>
	</main>
</div>
