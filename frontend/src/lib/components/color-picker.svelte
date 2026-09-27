<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import { Slider } from '$lib/components/ui/slider';

	/**
	 * 20 swatches: greens and emeralds first, then oranges and ambers, then sky, violet, pink,
	 * slate (Tailwind's 500-700 shades). Includes the four preset colours the backend seeds
	 * (green-600, emerald-600, orange-600, amber-600) so a user can pick a preset's own colour.
	 */
	const SWATCHES = [
		{ color: '#22c55e', label: 'Green 500' },
		{ color: '#16a34a', label: 'Green 600' },
		{ color: '#15803d', label: 'Green 700' },
		{ color: '#10b981', label: 'Emerald 500' },
		{ color: '#059669', label: 'Emerald 600' },
		{ color: '#047857', label: 'Emerald 700' },
		{ color: '#f97316', label: 'Orange 500' },
		{ color: '#ea580c', label: 'Orange 600' },
		{ color: '#c2410c', label: 'Orange 700' },
		{ color: '#f59e0b', label: 'Amber 500' },
		{ color: '#d97706', label: 'Amber 600' },
		{ color: '#b45309', label: 'Amber 700' },
		{ color: '#0ea5e9', label: 'Sky 500' },
		{ color: '#0284c7', label: 'Sky 600' },
		{ color: '#8b5cf6', label: 'Violet 500' },
		{ color: '#7c3aed', label: 'Violet 600' },
		{ color: '#ec4899', label: 'Pink 500' },
		{ color: '#db2777', label: 'Pink 600' },
		{ color: '#64748b', label: 'Slate 500' },
		{ color: '#475569', label: 'Slate 600' }
	];
	const HEX_RE = /^#[0-9a-fA-F]{6}$/;

	let {
		name = 'color',
		value = $bindable(''),
		/** Runs whenever the user commits a colour (a swatch click, a slider release, a valid hex). */
		onchange
	}: { name?: string; value?: string; onchange?: (color: string) => void } = $props();

	const id = $props.id();
	let open = $state(false);
	let hue = $state(142);
	let hexDraft = $state(value);

	/** `hsl(h 80% 45%)` converted to `#rrggbb`, the brief's exact formula for the hue slider. */
	function hueToHex(h: number) {
		const s = 0.8;
		const l = 0.45;
		const k = (n: number) => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		const toHex = (n: number) =>
			Math.round(f(n) * 255)
				.toString(16)
				.padStart(2, '0');
		return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
	}

	const sliderColor = $derived(hueToHex(hue));

	function pick(color: string) {
		value = color;
		hexDraft = color;
		onchange?.(color);
		open = false;
	}

	/** Applies the hex field on blur or Enter; an invalid draft reverts rather than committing. */
	function commitHex() {
		if (HEX_RE.test(hexDraft)) pick(hexDraft);
		else hexDraft = value;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		type="button"
		class="size-8 shrink-0 cursor-pointer rounded-full ring-1 ring-border ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		style={value ? `background-color: ${value}` : undefined}
		aria-label="Choose a colour"
	>
		{#if !value}<span class="sr-only">No colour chosen</span>{/if}
	</Popover.Trigger>
	<Popover.Content class="w-64">
		<div class="grid grid-cols-4 gap-2">
			{#each SWATCHES as swatch (swatch.color)}
				<button
					type="button"
					class="flex size-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					style:background-color={swatch.color}
					aria-label={swatch.label}
					onclick={() => pick(swatch.color)}
				>
					{#if value.toLowerCase() === swatch.color}<Check class="size-4 text-white" />{/if}
				</button>
			{/each}
		</div>
		<div class="mt-4 grid gap-2">
			<Label for="{id}-hue">Hue</Label>
			<div class="flex items-center gap-2">
				<Slider
					id="{id}-hue"
					type="single"
					min={0}
					max={360}
					step={1}
					value={hue}
					onValueChange={(next) => (hue = next)}
					onValueCommit={() => pick(sliderColor)}
				/>
				<span
					class="size-6 shrink-0 rounded-full ring-1 ring-border"
					style:background-color={sliderColor}
				></span>
			</div>
		</div>
		<div class="mt-4 grid gap-2">
			<Label for="{id}-hex">Hex</Label>
			<Input
				id="{id}-hex"
				bind:value={hexDraft}
				placeholder="#16a34a"
				maxlength={7}
				autocomplete="off"
				onblur={commitHex}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						commitHex();
					}
				}}
			/>
		</div>
	</Popover.Content>
</Popover.Root>
<input type="hidden" {name} {value} />
