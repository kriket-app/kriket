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
		// The server runs without VAPID keys until push is configured (production
		// included). The config comes first, before browser support and permission,
		// so a server without push shows the "not set up" state everywhere instead
		// of a button that can only fail. Nothing renders while it loads, and a
		// config request that fails reads as not set up.
		void pushConfig()
			.then(async (config) => {
				if (!config.enabled) {
					status = 'disabled';
					return;
				}
				if (!pushSupported()) {
					status = 'unsupported';
					return;
				}
				if (Notification.permission === 'denied') {
					status = 'denied';
					return;
				}
				const sub = await currentSubscription().catch(() => null);
				status = sub ? 'subscribed' : 'unsubscribed';
			})
			.catch(() => {
				status = 'disabled';
			});
	});

	async function enable() {
		busy = true;
		error = null;
		notice = null;
		try {
			await subscribePush();
			status = 'subscribed';
			// Prove it works straight away: the example below doubles as the
			// delivery check, so enabling and verifying are one step.
			try {
				const result = await sendTestPush(
					'Notifications are on',
					'This is an example — kriket can now reach this device.'
				);
				notice =
					result.sent > 0
						? 'Notifications are on — an example just went out, it should pop up in a moment.'
						: 'Notifications are on, but the example could not be delivered. Try Send test below.';
			} catch {
				notice = 'Notifications are on for this device.';
			}
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

{#if status !== 'loading'}
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
				Get a heads-up on this device when your expected balance is about to drop below zero in the
				coming week, plus a subscription cleanup reminder every 90 days.
			</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-3">
			{#if status === 'disabled'}
				<p class="text-sm text-muted-foreground">
					Push notifications aren't set up on this server yet, so there's nothing to enable here.
					They need VAPID keys (<code>VAPID_PUBLIC_KEY</code> and
					<code>VAPID_PRIVATE_KEY</code>) — generate them with
					<code>npx web-push generate-vapid-keys</code> in <code>backend/</code> and restart the server.
				</p>
			{:else if status === 'unsupported'}
				<!-- iPhone and iPad Safari expose push only to apps added to the Home Screen. -->
				<p class="text-sm text-muted-foreground">
					{#if showIosHint}
						On iPhone and iPad, notifications need kriket on your Home Screen first: tap Share, then
						Add to Home Screen, then open kriket from there and turn them on here.
					{:else}
						This browser doesn't support push notifications. Try Chrome, Edge, Firefox, or Safari.
					{/if}
				</p>
			{:else}
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
