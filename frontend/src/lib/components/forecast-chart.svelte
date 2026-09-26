<script lang="ts">
	import { formatCents } from '$lib/money';

	type Point = { date: string; minCents: number; actualCents: number; maxCents: number };
	let {
		points,
		height = 240,
		showAxes = true
	}: { points: Point[]; height?: number; showAxes?: boolean } = $props();

	const WIDTH = 640;
	// Keeps the thick line's caps and joins inside the viewBox at the edges.
	const PAD = 4;
	const dayLabel = new Intl.DateTimeFormat('en-CA', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
	const formatDay = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));

	/** The smallest 1, 2, 2.5, or 5 times a power of ten that is at least `raw`. */
	function niceStep(raw: number) {
		const power = 10 ** Math.floor(Math.log10(raw));
		return ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
	}

	const low = $derived(points.length ? Math.min(...points.map((p) => p.minCents)) : 0);
	const high = $derived(points.length ? Math.max(...points.map((p) => p.maxCents)) : 0);

	// Three evenly spaced ticks (in cents) that cover every point. They are multiples of a round
	// unit about a tenth of the range, so the labels read as round numbers without wasting height.
	const ticks = $derived.by(() => {
		const unit = niceStep(Math.max((high - low) / 10, 100));
		const base = Math.floor(low / unit) * unit;
		const step = Math.max(Math.ceil((high - base) / 2 / unit), 1) * unit;
		return [base, base + step, base + 2 * step];
	});

	// With axes, leave headroom above the top tick for its label.
	const domainLow = $derived(ticks[0]);
	const domainHigh = $derived(ticks[2] + (showAxes ? 0.3 * (ticks[1] - ticks[0]) : 0));

	const x = $derived((i: number) => PAD + (i / Math.max(points.length - 1, 1)) * (WIDTH - 2 * PAD));
	const y = $derived(
		(cents: number) => PAD + ((domainHigh - cents) / (domainHigh - domainLow)) * (height - 2 * PAD)
	);

	const line = (key: 'minCents' | 'actualCents' | 'maxCents') =>
		points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');

	const minPath = $derived(line('minCents'));
	const maxPath = $derived(line('maxCents'));
	const actualPath = $derived(line('actualCents'));
	// The band runs along the best case left to right, then back along the worst case.
	const bandPath = $derived(
		points.length
			? `${maxPath} ${points
					.map((p, i) => `L${x(i).toFixed(1)} ${y(p.minCents).toFixed(1)}`)
					.reverse()
					.join(' ')} Z`
			: ''
	);
	const crossesZero = $derived(low < 0 && high > 0);

	const first = $derived(points.at(0));
	const middle = $derived(points.at(Math.floor((points.length - 1) / 2)));
	const last = $derived(points.at(-1));
	const summary = $derived(
		first && last
			? `Forecast balance from ${formatDay(first.date)} to ${formatDay(last.date)}: ends between ` +
					`${formatCents(last.minCents)} and ${formatCents(last.maxCents)}, expected ${formatCents(last.actualCents)}.`
			: 'No forecast yet.'
	);
</script>

<div class="w-full">
	<div class="relative">
		<svg
			viewBox="0 0 {WIDTH} {height}"
			class="w-full"
			preserveAspectRatio="xMidYMid meet"
			role="img"
			aria-label={summary}
		>
			{#if showAxes}
				{#each ticks as tick (tick)}
					<line
						x1="0"
						x2={WIDTH}
						y1={y(tick)}
						y2={y(tick)}
						stroke="var(--border)"
						stroke-width="1"
					/>
				{/each}
			{/if}
			<path d={bandPath} fill="var(--brand-soft)" stroke="none" />
			{#if crossesZero}
				<line
					x1="0"
					x2={WIDTH}
					y1={y(0)}
					y2={y(0)}
					stroke="var(--muted-foreground)"
					stroke-width="1"
					stroke-dasharray="4 4"
				/>
			{/if}
			<path d={minPath} fill="none" stroke="var(--chart-3)" stroke-width="1" />
			<path d={maxPath} fill="none" stroke="var(--chart-3)" stroke-width="1" />
			<path
				d={actualPath}
				fill="none"
				stroke="var(--brand)"
				stroke-width="2.5"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		</svg>
		{#if showAxes}
			<!-- Labels are HTML over the SVG so they keep a readable size at any chart width. -->
			{#each ticks as tick (tick)}
				<span
					class="pointer-events-none absolute left-0 -translate-y-full rounded-sm bg-card/80 py-0.5 pr-1 text-[11px] leading-none text-muted-foreground tabular-nums"
					style:top="{(y(tick) / height) * 100}%"
					aria-hidden="true">{formatCents(tick)}</span
				>
			{/each}
		{/if}
	</div>
	{#if showAxes && first && middle && last}
		<div
			class="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums"
			aria-hidden="true"
		>
			<span>{formatDay(first.date)}</span>
			<span>{formatDay(middle.date)}</span>
			<span>{formatDay(last.date)}</span>
		</div>
	{/if}
</div>
