<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { ArrowLeft, ArrowRight, Check, FileText, PencilLine, ShieldCheck } from '@lucide/svelte';
	import type { ActionState, Tag } from '$lib/api/types';
	import type { components } from '$lib/api/schema';
	import ImportFlow from '$lib/components/import/import-flow.svelte';
	import PrivacyContent from '$lib/components/legal/privacy-content.svelte';
	import TermsContent from '$lib/components/legal/terms-content.svelte';
	import StreamForm from '$lib/components/streams/stream-form.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	type Status = components['schemas']['OnboardingStatus'];
	type Step = 'consent' | 'choice' | 'statement' | 'guide' | 'done';
	type GuideStep = 'balance' | 'income' | 'expenses';

	let {
		data,
		form
	}: {
		data: { status: Status; tags: Tag[] };
		form: ActionState;
	} = $props();

	// After the consent post reloads the data, consented users start at the choice.
	// untrack: the step is owned by the wizard from here on, not by the data.
	let step = $state<Step>(untrack(() => (data.status.needsConsent ? 'consent' : 'choice')));
	let guideStep = $state<GuideStep>('balance');
	let privacyOk = $state(false);
	let termsOk = $state(false);
	let balanceSaved = $state(false);
	let incomeAdded = $state(false);
	let expenseAdded = $state(false);

	const consentErrors = (path: string) =>
		form?.action === 'consent'
			? form.details?.find((detail) => detail.path === path)?.message
			: undefined;
	const balanceError = () =>
		form?.action === 'checkin'
			? form.details?.find((detail) => detail.path === 'balanceCents')?.message
			: undefined;
	const detailsFor = (kind: 'income' | 'expense') =>
		form?.action === 'create' && form.values?.kind === kind ? form.details : undefined;

	// The statement and guide paths rejoin at done; show 4 dots once chosen.
	const dotSteps = $derived(
		step === 'statement' || step === 'guide'
			? (['consent', 'choice', 'setup', 'done'] as const)
			: (['consent', 'choice', 'done'] as const)
	);
	const dotActive = $derived(
		step === 'consent' ? 0 : step === 'choice' ? 1 : step === 'done' ? dotSteps.length - 1 : 2
	);
</script>

<svelte:head><title>Get set up · kriket</title></svelte:head>

<div class="mx-auto w-full max-w-2xl">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Get set up</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				A minute now and kriket can forecast from your real numbers.
			</p>
		</div>
		<div class="flex gap-1.5" aria-label="Progress">
			{#each dotSteps as dot, i (dot)}
				<span
					class="h-1.5 w-6 rounded-full {i <= dotActive ? 'bg-brand' : 'bg-muted'}"
					aria-hidden="true"
				></span>
			{/each}
		</div>
	</div>

	{#if step === 'consent'}
		<Card.Root class="mt-6">
			<Card.Header>
				<Card.Title class="flex items-center gap-2"
					><ShieldCheck class="size-5" /> First, the ground rules</Card.Title
				>
				<Card.Description>
					Read both, accept both, and you're in. You'll only ever see this again if the texts
					change.
				</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-6">
				<div class="grid gap-2">
					<h2 class="font-medium">Privacy statement</h2>
					<div class="max-h-64 overflow-y-auto rounded-md border p-4">
						<PrivacyContent />
					</div>
					<p class="text-sm text-muted-foreground">
						The full page: <a href="/privacy" class="font-medium text-brand-strong hover:underline"
							>Privacy statement</a
						>.
					</p>
				</div>
				<div class="grid gap-2">
					<h2 class="font-medium">Terms of use</h2>
					<div class="max-h-64 overflow-y-auto rounded-md border p-4">
						<TermsContent />
					</div>
					<p class="text-sm text-muted-foreground">
						The full page: <a href="/terms" class="font-medium text-brand-strong hover:underline"
							>Terms of use</a
						>.
					</p>
				</div>
				<form
					method="POST"
					action="?/consent"
					use:enhance={() =>
						async ({ result, update }) => {
							await update();
							if (result.type === 'success') step = 'choice';
						}}
					class="grid gap-3"
				>
					<label class="flex cursor-pointer items-start gap-3 text-sm">
						<input
							type="checkbox"
							name="privacyAccepted"
							value="true"
							bind:checked={privacyOk}
							class="mt-1 size-4 shrink-0 accent-brand"
						/>
						<span>I have read and accept the privacy statement.</span>
					</label>
					{#if consentErrors('privacyAccepted')}
						<p class="text-xs text-destructive">{consentErrors('privacyAccepted')}</p>
					{/if}
					<label class="flex cursor-pointer items-start gap-3 text-sm">
						<input
							type="checkbox"
							name="termsAccepted"
							value="true"
							bind:checked={termsOk}
							class="mt-1 size-4 shrink-0 accent-brand"
						/>
						<span>I have read and accept the terms of use.</span>
					</label>
					{#if consentErrors('termsAccepted')}
						<p class="text-xs text-destructive">{consentErrors('termsAccepted')}</p>
					{/if}
					<div class="flex justify-end">
						<Button type="submit" disabled={!privacyOk || !termsOk}>
							Accept and continue<ArrowRight />
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{:else if step === 'choice'}
		<div class="mt-6 grid gap-4 md:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-lg"
						><FileText class="size-5" /> Use a bank statement</Card.Title
					>
					<Card.Description>
						Upload your most recent statement. It's read in your browser — never uploaded — and
						kriket groups the repeating income and expenses for you to keep or skip.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button class="w-full" onclick={() => (step = 'statement')}>
						Set up with a statement<ArrowRight />
					</Button>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-lg"
						><PencilLine class="size-5" /> Type it in</Card.Title
					>
					<Card.Description>
						A short walkthrough: your balance today, one income, one expense. Just the usual amounts
						— ranges can wait.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button variant="outline" class="w-full" onclick={() => (step = 'guide')}>
						Walk me through the forms<ArrowRight />
					</Button>
				</Card.Content>
			</Card.Root>
		</div>
		<div class="mt-4 flex justify-end">
			<form method="POST" action="?/complete">
				<Button variant="link" type="submit">Skip setup for now</Button>
			</form>
		</div>
	{:else if step === 'statement'}
		<div class="mt-2">
			<Button variant="ghost" size="sm" onclick={() => (step = 'choice')}>
				<ArrowLeft /> Back
			</Button>
		</div>
		<ImportFlow tags={data.tags} {form} doneHref={null} />
		<div class="mt-8 flex items-center justify-between">
			<p class="text-sm text-muted-foreground">Added what you want? Or skip the rest.</p>
			<Button onclick={() => (step = 'done')}>Continue<ArrowRight /></Button>
		</div>
	{:else if step === 'guide'}
		<div class="mt-2">
			<Button
				variant="ghost"
				size="sm"
				onclick={() => (guideStep === 'balance' ? (step = 'choice') : (guideStep = 'balance'))}
			>
				<ArrowLeft /> Back
			</Button>
		</div>
		{#if guideStep === 'balance'}
			<Card.Root class="mt-6">
				<Card.Header>
					<Card.Title class="text-lg">What's your balance today?</Card.Title>
					<Card.Description>
						Step 1 of 3. Every forecast starts from here — it can be negative.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if balanceSaved || (form?.action === 'checkin' && form.ok)}
						<p class="flex items-center gap-1.5 text-sm text-brand-strong">
							<Check class="size-4" /> Saved. You can change it anytime from the overview.
						</p>
						<div class="mt-4 flex justify-end">
							<Button onclick={() => (guideStep = 'income')}>Next: income<ArrowRight /></Button>
						</div>
					{:else}
						<form
							method="POST"
							action="?/checkin"
							use:enhance={() =>
								async ({ result, update }) => {
									await update();
									if (result.type === 'success') balanceSaved = true;
								}}
							class="grid gap-3"
						>
							<div class="grid gap-2">
								<Label for="balance">Balance today</Label>
								<Input
									id="balance"
									name="balance"
									autocomplete="off"
									required
									placeholder="420.00"
									aria-invalid={balanceError() ? true : undefined}
								/>
								{#if balanceError()}
									<p class="text-xs text-destructive first-letter:uppercase">
										{balanceError()}
									</p>
								{/if}
							</div>
							<div class="flex items-center justify-between">
								<Button variant="link" type="button" onclick={() => (guideStep = 'income')}>
									Skip
								</Button>
								<Button type="submit">Save balance</Button>
							</div>
						</form>
					{/if}
				</Card.Content>
			</Card.Root>
		{:else if guideStep === 'income'}
			<Card.Root class="mt-6">
				<Card.Header>
					<Card.Title class="text-lg">Add one income</Card.Title>
					<Card.Description>
						Step 2 of 3. Your pay, shifts, or anything that comes in on a rhythm.
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-4">
					{#if incomeAdded}
						<p class="flex items-center gap-1.5 text-sm text-brand-strong">
							<Check class="size-4" /> Added. One more, or move on?
						</p>
					{/if}
					{#key incomeAdded}
						<StreamForm
							kind="income"
							tags={data.tags}
							hidden={{ kind: 'income' }}
							details={detailsFor('income')}
							onsaved={() => (incomeAdded = true)}
						/>
					{/key}
					<div class="flex items-center justify-between">
						<Button variant="link" onclick={() => (guideStep = 'expenses')}>Skip</Button>
						<Button variant="outline" onclick={() => (guideStep = 'expenses')}>
							Next: expenses<ArrowRight />
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root class="mt-6">
				<Card.Header>
					<Card.Title class="text-lg">Add one expense</Card.Title>
					<Card.Description>
						Step 3 of 3. Rent, groceries, a subscription — whatever goes out on a rhythm.
					</Card.Description>
				</Card.Header>
				<Card.Content class="grid gap-4">
					{#if expenseAdded}
						<p class="flex items-center gap-1.5 text-sm text-brand-strong">
							<Check class="size-4" /> Added. One more, or finish up?
						</p>
					{/if}
					{#key expenseAdded}
						<StreamForm
							kind="expense"
							tags={data.tags}
							hidden={{ kind: 'expense' }}
							details={detailsFor('expense')}
							onsaved={() => (expenseAdded = true)}
						/>
					{/key}
					<div class="flex items-center justify-between">
						<Button variant="link" onclick={() => (step = 'done')}>Skip</Button>
						<Button variant="outline" onclick={() => (step = 'done')}>
							Finish<ArrowRight />
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}
	{:else}
		<Card.Root class="mt-6">
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-lg"
					><Check class="size-5" /> You're set up</Card.Title
				>
				<Card.Description>
					{#if balanceSaved || incomeAdded || expenseAdded}
						Nice — kriket is already forecasting from what you added. You can add, edit, or import
						more anytime.
					{:else}
						Nothing added yet — no problem. The overview will walk you through it whenever you're
						ready.
					{/if}
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex justify-end">
				<form method="POST" action="?/complete">
					<Button type="submit" size="lg">Start using kriket<ArrowRight /></Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
