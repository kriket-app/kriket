<script lang="ts">
	import { CircleCheck } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import type { ActionState, Checkin } from '$lib/api/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatDate } from '$lib/dates';
	import { money } from '$lib/forecast-words';
	import { centsToDollars } from '$lib/money';

	/** The balance check-in: the one habit, first on the overview. Posts to the page's `checkin` action. */
	let {
		latest,
		today,
		expectedTodayCents,
		form
	}: {
		/** The newest check-in, if there is one. */
		latest: Checkin | undefined;
		/** Today, as the API returned it. */
		today: string;
		/** What the forecast expects the balance to be today, carried forward from the latest check-in. */
		expectedTodayCents: number;
		form: ActionState;
	} = $props();

	const balanceError = $derived(
		form?.action === 'checkin'
			? form.details?.find((detail) => detail.path === 'balanceCents')?.message
			: undefined
	);
	const saved = $derived(form?.ok && latest ? money(latest.balanceCents) : null);
	// Today's own check-in prefills its value; anything older is stale, so the field starts empty
	// with the expected amount only as a placeholder (one tap on Save would otherwise store the
	// old balance as today's).
	const checkedInToday = $derived(latest?.checkedOn === today);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Your balance today</Card.Title>
		<Card.Description>
			{#if checkedInToday}
				The forecast starts from here.
			{:else if latest}
				Last saved {money(latest.balanceCents)} on {formatDate(latest.checkedOn)}. kriket expects {money(
					expectedTodayCents
				)} by the end of today.
			{:else}
				Tell kriket what's in your account today; the forecast starts from it.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<!-- reset: false keeps the saved value in the input instead of the page's first render. -->
		<form
			method="POST"
			action="?/checkin"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
			class="grid gap-3"
		>
			<div class="grid gap-2">
				<Label for="balance">Balance</Label>
				<div class="flex gap-2">
					<!-- No inputmode="decimal": the iOS decimal pad has no minus key, and balances can be negative. -->
					<Input
						id="balance"
						name="balance"
						autocomplete="off"
						required
						class="tabular-nums"
						value={checkedInToday ? centsToDollars(latest?.balanceCents ?? 0) : ''}
						placeholder={checkedInToday ? undefined : centsToDollars(expectedTodayCents)}
						aria-invalid={balanceError ? true : undefined}
						aria-describedby={balanceError ? 'balance-error' : undefined}
					/>
					<Button type="submit" class="px-4">Save</Button>
				</div>
				{#if balanceError}
					<p id="balance-error" class="text-xs text-destructive first-letter:uppercase">
						{balanceError}
					</p>
				{/if}
			</div>
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<!-- Always in the page, so screen readers announce the line when it appears. -->
				<p role="status">
					{#if saved}
						<span class="flex items-start gap-1.5 text-brand-strong">
							<CircleCheck class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<span>Saved · {saved}. Your forecast starts from today.</span>
						</span>
					{/if}
				</p>
				{#if latest}
					<a
						href="/app/balances"
						class="ml-auto rounded-sm font-medium text-brand-strong hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
						>Your balances ›</a
					>
				{/if}
			</div>
		</form>
	</Card.Content>
</Card.Root>
