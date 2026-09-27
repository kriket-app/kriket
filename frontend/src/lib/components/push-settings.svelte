<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, BellOff } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import {
		currentSubscription,
		isInstalled,
		isIos,
		pushConfig,
		pushSupported,
		sendTestPush,
		subscribePush,
		unsubscribePush,
		type PushStatus
	} from '$lib/push';

	let status: PushStatus = $state('loading');
	let error: string | null = $state(null);
	let notice: string | null = $state(null);
	let busy = $state(false);

	onMount(() => {
		if (!pushSupported()) {
			status = 'unsupported';
			return;
		}
		// The server runs without VAPID keys until push is configured (production
		// included): render nothing instead of a button that can only fail. This
		// check comes before the permission check so the card also stays hidden
		// where notifications are blocked but there is nothing to enable.
		void pushConfig()
			.then((config) => {
				if (!config.enabled) {
					status = 'disabled';
					return null;
				}
				if (Notification.permission === 'denied') {
					status = 'denied';
					return null;
				}
				return currentSubscription();
			})
			.then((sub) => {
				if (sub === null) return; // disabled or denied above
				status = sub ? 'subscribed' : 'unsubscribed';
			})
			.catch(() => {
				status = 'unsubscribed';
			});
	});

	async function enable() {
		busy = true;
		error = null;
		notice = null;
		try {
			await subscribePush();
			status = 'subscribed';
			notice = 'Notifications are on for this device.';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not enable notifications';
			if (Notification.permission === 'denied') status = 'denied';
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		error = null;
		notice = null;
		try {
			await unsubscribePush();
			status = 'unsubscribed';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not turn off notifications';
		} finally {
			busy = false;
		}
	}

	async function test() {
		busy = true;
		error = null;
		notice = null;
		try {
			const result = await sendTestPush('Kriket test', 'Notifications are working.');
			notice =
				result.sent > 0
					? 'Test sent — it should pop up in a moment.'
					: 'No devices received it. Re-enable notifications and try again.';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not send a test';
		} finally {
			busy = false;
		}
	}

	const showIosHint = $derived(isIos() && !isInstalled());
</script>

{#if status !== 'disabled'}
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2 text-base">
				{#if status === 'subscribed'}
					<Bell class="size-4 text-brand-strong" />
				{:else}
					<BellOff class="size-4 text-muted-foreground" />
				{/if}
				Notifications
			</Card.Title>
			<Card.Description>
				Switch notifications on for this device, then check delivery with a test. Automatic forecast
				alerts are next; nothing is sent on its own yet.
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-3">
			{#if status === 'unsupported'}
				<p class="text-sm text-muted-foreground">
					This browser doesn't support push notifications. Try Chrome, Edge, or Safari.
				</p>
			{:else if status === 'loading'}
				<p class="text-sm text-muted-foreground">Checking notification status…</p>
			{:else}
				{#if showIosHint}
					<p class="text-sm text-muted-foreground">
						On iPhone, notifications need kriket installed first: Share → Add to Home Screen, then
						open it from your Home Screen and enable here.
					</p>
				{/if}
				{#if status === 'denied'}
					<p class="text-sm text-muted-foreground">
						Notifications are blocked for this site. Allow them in your browser's site settings,
						then come back here.
					</p>
				{:else if status === 'subscribed'}
					<div class="flex flex-wrap gap-2">
						<Button size="sm" variant="outline" onclick={disable} disabled={busy}>
							Turn off on this device
						</Button>
						<Button size="sm" variant="secondary" onclick={test} disabled={busy}>Send test</Button>
					</div>
				{:else}
					<div>
						<Button size="sm" onclick={enable} disabled={busy}>
							{busy ? 'Enabling…' : 'Enable notifications'}
						</Button>
					</div>
				{/if}
				{#if error}
					<p role="alert" class="text-sm text-destructive">{error}</p>
				{/if}
				{#if notice}
					<p role="status" class="text-sm text-brand-strong">{notice}</p>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
{/if}
