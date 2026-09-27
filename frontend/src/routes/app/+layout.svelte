<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { ArrowDownToLine, ArrowUpFromLine, ChartLine, Tags } from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { pushSupported, unsubscribePush } from '$lib/push';

	let { data, children } = $props();

	const items = [
		{ href: '/app', label: 'Overview', icon: ChartLine },
		{ href: '/app/income', label: 'Income', icon: ArrowDownToLine },
		{ href: '/app/expenses', label: 'Expenses', icon: ArrowUpFromLine },
		{ href: '/app/tags', label: 'Tags', icon: Tags }
	];
	// /app/balances is Overview's own detail page (flipping through past check-ins), not a
	// separate section, so it highlights Overview too.
	const active = (href: string) =>
		href === '/app'
			? page.url.pathname === '/app' || page.url.pathname.startsWith('/app/balances')
			: page.url.pathname.startsWith(href);

	async function signOut() {
		// Drop this device's push subscription first: otherwise the next person on
		// this browser would keep receiving the previous user's notifications.
		// Best-effort and skipped entirely where push is unavailable.
		if (pushSupported()) await unsubscribePush().catch(() => undefined);
		await authClient.signOut();
		await goto('/');
	}
</script>

<div class="min-h-dvh bg-background text-foreground">
	<header class="pt-safe sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
		<div class="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
			<a href="/app" class="flex items-center gap-2 font-semibold">
				<BrandMark class="size-6" /> kriket
			</a>
			<nav class="hidden items-center gap-1 md:flex" aria-label="Primary">
				{#each items as item (item.href)}
					<a
						href={item.href}
						aria-current={active(item.href) ? 'page' : undefined}
						class={cn(
							'rounded-md px-3 py-2 text-sm font-medium',
							active(item.href)
								? 'bg-accent text-accent-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}>{item.label}</a
					>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
				<span class="hidden sm:inline">{data.user.email}</span>
				<button type="button" class="hover:text-foreground" onclick={signOut}>Sign out</button>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-10">{@render children()}</main>
	<nav
		class="fixed inset-x-0 bottom-0 z-20 border-t bg-background md:hidden"
		aria-label="Primary"
		style="padding-bottom: env(safe-area-inset-bottom)"
	>
		<div class="grid grid-cols-4">
			{#each items as item (item.href)}
				{@const Icon = item.icon}
				<a
					href={item.href}
					aria-current={active(item.href) ? 'page' : undefined}
					class={cn(
						'flex flex-col items-center gap-1 py-2 text-xs',
						active(item.href) ? 'text-brand-strong' : 'text-muted-foreground'
					)}
				>
					<Icon class="size-5" /><span>{item.label}</span>
				</a>
			{/each}
		</div>
	</nav>
</div>
