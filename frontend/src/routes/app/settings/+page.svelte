<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import InstallPrompt from '$lib/components/install-prompt.svelte';
	import IosInstallHint from '$lib/components/ios-install-hint.svelte';
	import PushSettings from '$lib/components/push-settings.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { setTheme, theme, THEME_CHOICES, type ThemeChoice } from '$lib/theme.svelte';
	import { pushSupported, unsubscribePush } from '$lib/push';
	import { ChevronRight, Laptop, Moon, Sun, Tags } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let { data } = $props();

	const REPO_URL = 'https://github.com/kriket-app/kriket';

	const themeIcons = { system: Laptop, light: Sun, dark: Moon } as const;
	const themeLabels: Record<ThemeChoice, string> = {
		system: 'System',
		light: 'Light',
		dark: 'Dark'
	};

	let signingOut = $state(false);
	let confirmSignOut = $state(false);

	async function signOut() {
		signingOut = true;
		try {
			// Drop this device's push subscription first: otherwise the next person on
			// this browser would keep receiving the previous user's notifications.
			// Best-effort and skipped entirely where push is unavailable.
			if (pushSupported()) await unsubscribePush().catch(() => undefined);
			await authClient.signOut();
			await goto('/');
		} finally {
			signingOut = false;
			confirmSignOut = false;
		}
	}
</script>

<svelte:head><title>Settings · kriket</title></svelte:head>

<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
<p class="mt-1 text-sm text-muted-foreground">Your account, notifications, and how kriket looks.</p>

<div class="mt-6 grid gap-4">
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">Account</Card.Title>
			<Card.Description>Signed in on this device as</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm font-medium break-all">{data.user.email}</p>
			<AlertDialog.Root bind:open={confirmSignOut}>
				<AlertDialog.Trigger class={buttonVariants({ variant: 'destructive' })}>
					Sign out
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Sign out?</AlertDialog.Title>
						<AlertDialog.Description>
							You'll need your email and password to sign back in on this device.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action variant="destructive" onclick={signOut} disabled={signingOut}>
							{signingOut ? 'Signing out…' : 'Sign out'}
						</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">Appearance</Card.Title>
			<Card.Description>System follows your device's light or dark mode.</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex gap-1 rounded-full bg-muted p-1" role="group" aria-label="Colour theme">
				{#each THEME_CHOICES as choice (choice)}
					{@const Icon = themeIcons[choice]}
					<button
						type="button"
						aria-pressed={theme.choice === choice}
						onclick={() => setTheme(choice)}
						class={cn(
							'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
							theme.choice === choice
								? 'bg-background text-brand-strong shadow-xs'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<Icon class="size-4" />{themeLabels[choice]}
					</button>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>

	<PushSettings />

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">Organise</Card.Title>
			<Card.Description>Labels for the money moving in and out.</Card.Description>
		</Card.Header>
		<Card.Content>
			<a
				href="/app/tags"
				class="flex min-h-12 items-center gap-3 rounded-lg px-1 py-2 transition active:scale-[0.99]"
			>
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"
				>
					<Tags class="size-4" />
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-sm font-medium">Tags</span>
					<span class="block truncate text-sm text-muted-foreground">
						Group streams and see where the money goes.
					</span>
				</span>
				<ChevronRight class="size-4 shrink-0 text-muted-foreground" />
			</a>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">About</Card.Title>
			<Card.Description>
				Kriket forecasts where your money is heading from the income and expenses you actually have,
				ranges included.
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-wrap items-center gap-2">
			<Button variant="outline" size="sm" href={REPO_URL}>Open source on GitHub</Button>
			<InstallPrompt />
		</Card.Content>
	</Card.Root>

	<IosInstallHint />
</div>
