<script lang="ts">
	import type { components } from '$lib/api/schema';
	import { forecastWords, unbreakableParts } from '$lib/forecast-words';
	import { cn } from '$lib/utils';

	type Forecast = components['schemas']['Forecast'];

	/** The answer to "am I going to be OK?" in two lines: orange when it goes under zero. */
	let {
		forecast,
		days,
		class: className
	}: {
		forecast: Pick<Forecast, 'lowest' | 'firstBelowZero' | 'recoversOn'>;
		/** The forecast's length, as the page asked for it. */
		days: number;
		class?: string;
	} = $props();

	const answer = $derived(forecastWords(forecast, days));
</script>

{#snippet words(text: string)}
	{#each unbreakableParts(text) as part, i (i)}
		{#if i % 2}<span class="whitespace-nowrap">{part}</span>{:else}{part}{/if}
	{/each}
{/snippet}

<div
	class={cn(
		'grid content-center gap-1.5 rounded-xl border-l-4 px-6 py-5',
		answer.tone === 'short' ? 'border-expense bg-expense-soft' : 'border-brand bg-brand-soft',
		className
	)}
>
	<h2 class="text-xl leading-snug font-semibold tracking-tight text-balance">
		{@render words(answer.headline)}
	</h2>
	<p class="text-sm text-foreground/75">{@render words(answer.body)}</p>
</div>
