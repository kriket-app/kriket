<script lang="ts">
	import { onMount } from 'svelte';
	import { Download } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	// Surfaces the browser's install prompt as an in-page button. Renders nothing
	// until the browser fires `beforeinstallprompt` (i.e. the app is installable
	// here and now), and nothing at all once installed.
	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let deferred: BeforeInstallPromptEvent | null = $state(null);
	let installed = $state(false);

	function isStandalone() {
		return (
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true
		);
	}

	onMount(() => {
		if (isStandalone()) {
			installed = true;
			return;
		}
		const onPrompt = (event: Event) => {
			event.preventDefault();
			deferred = event as BeforeInstallPromptEvent;
		};
		const onInstalled = () => {
			installed = true;
			deferred = null;
		};
		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		const { outcome } = await deferred.userChoice;
		if (outcome === 'accepted') deferred = null;
		// On dismiss the event stays cached: the button remains for another try.
	}
</script>

{#if deferred && !installed}
	<Button variant="outline" size="lg" class="px-5" onclick={install}>
		<Download /> Install app
	</Button>
{/if}
