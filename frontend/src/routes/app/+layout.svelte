<script lang="ts">
	import { navigating, page } from '$app/state';
	import { cn } from '$lib/utils';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { tap } from '$lib/haptics';
	import { ArrowDownToLine, ArrowUpFromLine, ChartLine, Target } from '@lucide/svelte';

	let { data, children } = $props();

	const items = [
		{ href: '/app', label: 'Overview', icon: ChartLine },
		{ href: '/app/income', label: 'Income', icon: ArrowDownToLine },
		{ href: '/app/expenses', label: 'Expenses', icon: ArrowUpFromLine },
		{ href: '/app/goals', label: 'Goals', icon: Target }
	];
	// /app/balances is Overview's own detail page (flipping through past check-ins), not a
	// separate section, so it highlights Overview too. /app/settings is reached from the
	// header avatar and never highlights a tab.
	const active = (href: string) =>
		href === '/app'
			? page.url.pathname === '/app' || page.url.pathname.startsWith('/app/balances')
			: page.url.pathname.startsWith(href);
	const settingsActive = $derived(page.url.pathname.startsWith('/app/settings'));
	const initial = $derived(data.user.email.trim().charAt(0).toUpperCase() || 'K');
	// The header cricket hops on every tap; the key replays the hop.
	let hops = $state(0);
</script>

<!-- The whole signed-in area sits behind auth: keep it out of search indexes. -->
<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

<div class="min-h-dvh bg-background text-foreground">
	<header class="pt-safe sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
		<div
			class="mx-auto flex h-14 max-w-5xl items-center gap-6 ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))]"
		>
			<a
				href="/app"
				class="flex items-center gap-2 font-semibold"
				onclick={() => {
					tap();
					hops += 1;
				}}
			>
				{#key hops}<BrandMark class="size-6 {hops > 0 ? 'animate-chirp' : ''}" />{/key} kriket
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
			<div class="ml-auto flex items-center gap-3">
				<a
					href="/app/settings"
					aria-label="Settings"
					aria-current={settingsActive ? 'page' : undefined}
					class={cn(
						'flex size-10 items-center justify-center rounded-full text-sm font-semibold transition active:scale-95',
						settingsActive
							? 'bg-brand text-brand-foreground'
							: 'bg-brand-soft text-brand-strong hover:bg-brand-soft/70'
					)}
				>
					{initial}
				</a>
			</div>
		</div>
		{#if navigating.to}
			<div class="nav-pending absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
				<div class="nav-pending-bar h-full w-1/3 bg-brand"></div>
			</div>
		{/if}
	</header>
	<main
		class="mx-auto max-w-5xl ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] pt-6 pb-24 md:pb-10"
	>
		{@render children()}
	</main>
	<nav
		class="fixed inset-x-0 bottom-0 z-20 border-t bg-background md:hidden"
		aria-label="Primary"
		data-sveltekit-preload-data="tap"
		style="padding-bottom: env(safe-area-inset-bottom)"
	>
		<div class="grid grid-cols-4 ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)]">
			{#each items as item (item.href)}
				{@const Icon = item.icon}
				{@const isActive = active(item.href)}
				<a
					href={item.href}
					aria-current={isActive ? 'page' : undefined}
					onclick={tap}
					class={cn(
						'flex min-h-12 flex-col items-center justify-center gap-1 py-2 text-xs transition active:scale-95 active:bg-accent/50',
						isActive ? 'text-brand-strong' : 'text-muted-foreground'
					)}
				>
					{#key isActive}
						<Icon class="size-5 {isActive ? 'animate-hop-in' : ''}" /><span>{item.label}</span>
					{/key}
				</a>
			{/each}
		</div>
	</nav>
</div>
