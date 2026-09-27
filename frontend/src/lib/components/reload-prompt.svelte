<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	// Listens for a waiting service worker and offers a one-tap update. Rendered
	// once in the root layout; hidden until an update is actually available.
	// SvelteKit only calls registration.update() on error recovery (client-side
	// navigations don't trigger the browser check), so also poll hourly and on
	// visibility change while the page is open.
	let waiting: ServiceWorker | null = $state(null);
	// Set only when the user accepts the update: the controllerchange fired by
	// the *initial* install must never reload the page (it would wipe forms).
	let updating = false;

	function watch(worker: ServiceWorker) {
		worker.addEventListener('statechange', () => {
			if (worker.state === 'installed' && navigator.serviceWorker.controller) {
				waiting = worker;
			}
		});
	}

	function track(reg: ServiceWorkerRegistration) {
		if (reg.waiting && navigator.serviceWorker.controller) waiting = reg.waiting;
		// A worker that started installing before this component mounted fires no
		// updatefound for us, and the hourly check finds nothing new, so watch it here.
		if (reg.installing) watch(reg.installing);
		reg.addEventListener('updatefound', () => {
			if (reg.installing) watch(reg.installing);
		});
	}

	async function checkForUpdate(reg: ServiceWorkerRegistration) {
		try {
			await reg.update();
		} catch {
			// Offline or throttled: the next poll or navigation retries.
		}
	}

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;
		let interval = 0;
		const onVisibility = () => {
			if (document.visibilityState === 'visible') {
				void navigator.serviceWorker
					.getRegistration()
					.then((reg) => reg && checkForUpdate(reg))
					.catch(() => undefined);
			}
		};
		// The worker is bundled for production only, never in dev.
		void navigator.serviceWorker
			.getRegistration()
			.then((reg) => {
				if (!reg) return;
				track(reg);
				interval = window.setInterval(() => void checkForUpdate(reg), 60 * 60 * 1000);
				document.addEventListener('visibilitychange', onVisibility);
			})
			.catch(() => undefined);
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (updating) window.location.reload();
		});

		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	function reload() {
		updating = true;
		waiting?.postMessage('SKIP_WAITING');
		// Fallback in case the new worker takes a moment: the controllerchange
		// listener above reloads as soon as it activates.
		window.setTimeout(() => window.location.reload(), 1500);
	}
</script>

{#if waiting}
	<div
		role="status"
		class="fixed inset-x-0 bottom-0 z-50 mx-auto mb-4 w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-4 shadow-lg"
		style="margin-bottom: calc(1rem + env(safe-area-inset-bottom))"
	>
		<p class="text-sm font-medium">A new version of kriket is available.</p>
		<p class="mt-1 text-sm text-muted-foreground">Refresh to get the latest forecast fixes.</p>
		<div class="mt-3 flex justify-end gap-2">
			<Button size="sm" variant="outline" onclick={() => (waiting = null)}>Later</Button>
			<Button size="sm" onclick={reload}>Refresh</Button>
		</div>
	</div>
{/if}
