<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubscriptionDigest } from '$lib/api/types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { formatCents } from '$lib/money';
	let { digest }: { digest: SubscriptionDigest } = $props();
</script>

{#if digest.due}
	<Card.Root class="mt-4 border-brand/30 bg-brand-soft">
		<Card.Header>
			<Card.Title>krr krr krr… still using all of those?</Card.Title>
			<Card.Description
				>You have {digest.count}
				{digest.count === 1 ? 'subscription' : 'subscriptions'}, about {formatCents(
					digest.monthlyCents
				)}/month. Give them a two-minute cleanup.</Card.Description
			>
		</Card.Header>
		<Card.Content class="flex flex-wrap items-center gap-3">
			<Button href="/app/expenses?filter=subscriptions">Review subscriptions</Button>
			<form method="POST" action="?/dismissSubscriptions" use:enhance>
				<Button type="submit" variant="outline">All good — remind me in 90 days</Button>
			</form>
		</Card.Content>
	</Card.Root>
{/if}
