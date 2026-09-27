<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { matchPresets } from '$lib/subscriptions';
	import SubscriptionIcon from './subscription-icon.svelte';
	let {
		id,
		value = $bindable(''),
		invalid,
		describedBy
	}: { id: string; value?: string; invalid?: boolean; describedBy?: string } = $props();
	let open = $state(false);
	let active = $state(-1);
	const matches = $derived(matchPresets(value));
	function choose(name: string) {
		value = name;
		open = false;
		active = -1;
	}
	function keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			open = true;
			active = matches.length
				? (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length
				: -1;
		} else if (event.key === 'Enter' && open && active >= 0 && matches[active]) {
			event.preventDefault();
			choose(matches[active].name);
		} else if (event.key === 'Escape' && open) {
			event.preventDefault();
			event.stopPropagation();
			open = false;
		}
	}
</script>

<div class="relative">
	<Input
		{id}
		name="name"
		required
		maxlength={100}
		autocomplete="off"
		placeholder="Netflix, Spotify, or your own…"
		bind:value
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open && matches.length > 0}
		aria-controls="{id}-suggestions"
		aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
		aria-invalid={invalid}
		aria-describedby={describedBy}
		oninput={() => {
			open = true;
			active = -1;
		}}
		onfocus={() => (open = true)}
		onblur={() => (open = false)}
		onkeydown={keydown}
	/>
	{#if open && matches.length}
		<ul
			id="{id}-suggestions"
			role="listbox"
			aria-label="Common subscriptions"
			class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
		>
			{#each matches as preset, index (preset.name)}
				<li role="presentation">
					<button
						id="{id}-option-{index}"
						type="button"
						role="option"
						aria-selected={active === index}
						tabindex="-1"
						class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
						class:bg-accent={active === index}
						onpointerdown={(event) => event.preventDefault()}
						onclick={() => choose(preset.name)}
					>
						<SubscriptionIcon name={preset.name} />{preset.name}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
