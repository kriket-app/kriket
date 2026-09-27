<script lang="ts">
	import { onMount } from 'svelte';
	import { Share } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { isInstalled, isIos } from '$lib/push';
	import { cn } from '$lib/utils';

	// iPhones and iPads never fire `beforeinstallprompt`, so the install button
	// stays hidden there. This card shows those visitors the Safari flow instead.
	// It renders nothing anywhere else, including once the app is installed.
	let { class: className }: { class?: string } = $props();
	let show = $state(false);

	onMount(() => {
		show = isIos() && !isInstalled();
	});
</script>

{#if show}
	<Card.Root class={cn('border-brand/30 bg-brand-soft/50', className)}>
		<Card.Header>
			<Card.Title class="text-base">Install on iPhone or iPad</Card.Title>
			<Card.Description>
				Apple doesn't offer an install button, so it takes three taps in Safari — then kriket opens
				full-screen from your Home Screen like a native app.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="grid gap-3">
				<li class="flex gap-3">
					<span
						class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground"
						aria-hidden="true">1</span
					>
					<p class="text-sm">
						Tap the <Share class="inline size-4" /> Share button in Safari's toolbar.
					</p>
				</li>
				<li class="flex gap-3">
					<span
						class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground"
						aria-hidden="true">2</span
					>
					<p class="text-sm">
						Scroll down and tap <strong class="font-semibold">Add to Home Screen</strong>, then
						<strong class="font-semibold">Add</strong>.
					</p>
				</li>
				<li class="flex gap-3">
					<span
						class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground"
						aria-hidden="true">3</span
					>
					<p class="text-sm">
						Open kriket from your Home Screen. It stays signed in and works offline.
					</p>
				</li>
			</ol>
		</Card.Content>
	</Card.Root>
{/if}
