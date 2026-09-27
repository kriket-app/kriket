<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import Seo from '$lib/components/seo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let error = $state<string | null>(null);

	async function handleSubmit() {
		error = null;
		submitting = true;
		try {
			const { error: authError } = await authClient.signUp.email({ name, email, password });
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

<Seo
	title="Get started · kriket"
	description="Create your free kriket account with just an email and password — no bank access, ever."
	path="/signup"
	noindex
/>

<div
	class="pt-safe flex min-h-dvh flex-col items-center justify-center gap-8 bg-brand-soft px-4 py-12"
>
	<a href="/" class="flex items-center gap-2 text-lg font-semibold">
		<BrandMark class="size-8" /> kriket
	</a>

	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-xl">Create your account</Card.Title>
			<Card.Description>
				Kriket forecasts where your money is heading from the income and expenses you actually have,
				ranges included, so you know weeks ahead whether you'll make it, and what to change if you
				won't.
			</Card.Description>
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
					<Label for="name">Name</Label>
					<Input id="name" autocomplete="name" required bind:value={name} />
				</div>
				<div class="flex flex-col gap-2">
					<Label for="email">Email</Label>
					<Input id="email" type="email" autocomplete="email" required bind:value={email} />
				</div>
				<div class="flex flex-col gap-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						type="password"
						autocomplete="new-password"
						required
						minlength={8}
						bind:value={password}
					/>
				</div>

				{#if error}
					<p class="text-sm text-destructive" role="alert">{error}</p>
				{/if}

				<Button type="submit" size="lg" class="w-full" disabled={submitting}>
					{submitting ? 'Creating account…' : 'Create account'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center text-sm text-muted-foreground">
			<p>
				Already have an account?
				<a href="/signin" class="font-medium text-brand-strong hover:underline">Sign in</a>
			</p>
		</Card.Footer>
	</Card.Root>
</div>
