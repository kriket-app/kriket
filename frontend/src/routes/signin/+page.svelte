<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	async function handleSubmit() {
		error = null;
		submitting = true;
		try {
			const { error: authError } = await authClient.signIn.email({ email, password });
			if (authError) {
				error = authError.message ?? 'Something went wrong';
				return;
			}
			await goto(page.url.searchParams.get('next') ?? '/app');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>Sign in · kriket</title></svelte:head>

<div class="flex min-h-dvh flex-col items-center justify-center gap-8 bg-brand-soft px-4 py-12">
	<a href="/" class="flex items-center gap-2 text-lg font-semibold">
		<BrandMark class="size-8" /> kriket
	</a>

	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-xl">Sign in</Card.Title>
			<Card.Description>Welcome back. Your forecast is waiting.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				class="flex flex-col gap-4"
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<div class="flex flex-col gap-2">
					<Label for="email">Email</Label>
					<Input id="email" type="email" autocomplete="email" required bind:value={email} />
				</div>
				<div class="flex flex-col gap-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						type="password"
						autocomplete="current-password"
						required
						bind:value={password}
					/>
				</div>

				{#if error}
					<p class="text-sm text-destructive" role="alert">{error}</p>
				{/if}

				<Button type="submit" size="lg" class="w-full" disabled={submitting}>
					{submitting ? 'Signing in…' : 'Sign in'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center text-sm text-muted-foreground">
			<p>
				No account yet?
				<a href="/signup" class="font-medium text-brand-strong hover:underline">Create an account</a
				>
			</p>
		</Card.Footer>
	</Card.Root>
</div>
