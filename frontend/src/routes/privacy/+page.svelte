<script lang="ts">
	import BrandMark from '$lib/components/brand-mark.svelte';
	import PrivacyContent from '$lib/components/legal/privacy-content.svelte';
	import Seo from '$lib/components/seo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
</script>

<Seo
	title="Privacy · kriket"
	description="How kriket uses your data: statements stay on your device, nothing is sold, no bank access."
	path="/privacy"
/>

<div class="flex min-h-dvh flex-col bg-background text-foreground">
	<header class="pt-safe mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
		<a href="/" class="flex items-center gap-2 text-lg font-semibold">
			<BrandMark class="size-7" /> kriket
		</a>
	</header>
	<main class="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-xl">Privacy statement</Card.Title>
				<Card.Description>How kriket uses your data, in plain words.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				<PrivacyContent />
				<p class="text-sm text-muted-foreground">
					The matching <a href="/terms" class="font-medium text-brand-strong hover:underline"
						>terms of use</a
					>.
				</p>
			</Card.Content>
			<Card.Footer>
				<Button href="/signup" class="w-full sm:w-auto">Get started</Button>
			</Card.Footer>
		</Card.Root>
	</main>
</div>
