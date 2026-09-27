<script lang="ts">
	import BrandMark from '$lib/components/brand-mark.svelte';
	import TermsContent from '$lib/components/legal/terms-content.svelte';
	import Seo from '$lib/components/seo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
</script>

<Seo
	title="Terms of use · kriket"
	description="The terms of use for kriket: a planning aid, your account, acceptable use, and liability."
	path="/terms"
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
				<Card.Title class="text-xl">Terms of use</Card.Title>
				<Card.Description>The ground rules for using kriket.</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4">
				<TermsContent />
				<p class="text-sm text-muted-foreground">
					The matching <a href="/privacy" class="font-medium text-brand-strong hover:underline"
						>privacy statement</a
					>.
				</p>
			</Card.Content>
			<Card.Footer>
				<Button href="/signup" class="w-full sm:w-auto">Get started</Button>
			</Card.Footer>
		</Card.Root>
	</main>
</div>
