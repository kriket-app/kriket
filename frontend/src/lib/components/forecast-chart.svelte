<script lang="ts">
	import { formatDate } from '$lib/dates';
	import { amount, dollars, money } from '$lib/forecast-words';

	type Point = { date: string; minCents: number; actualCents: number; maxCents: number };
	/** A payment to mark on the expected line: a forecast event (only these fields are read). */
	type ChartEvent = { date: string; kind: 'income' | 'expense'; name: string; actualCents: number };
	type Dot = { key: string; cx: number; cy: number; kind: ChartEvent['kind']; label: string };

	let {
		points,
		events = [],
		height = 240,
		showAxes = true
	}: {
		points: Point[];
		/** Marked as dots on the expected line; events on dates outside `points` are skipped. */
		events?: ChartEvent[];
		/** The chart's height from `md` up; below `md` it is 200 (or `height`, if smaller). */
		height?: number;
		showAxes?: boolean;
	} = $props();

	// Keeps the thick line's caps and the dots inside the drawing at the edges.
	const PAD = 6;
	// Dots for payments on the same day sit side by side, this many pixels apart.
	const FAN = 6;
	const clipId = $props.id();

	// The drawing is in real pixels: once the page is live the box is measured, so the dots stay
	// round and the lines keep their width at any screen size. Until then (the server render) a
	// 640-wide drawing is stretched to fill the box.
	let boxWidth = $state(0);
	let boxHeight = $state(0);
	const width = $derived(boxWidth || 640);
	const drawHeight = $derived(boxHeight || height);

	/** The smallest 1, 2, 2.5, or 5 times a power of ten that is at least `raw`. */
	function niceStep(raw: number) {
		const power = 10 ** Math.floor(Math.log10(raw));
		return ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
	}

	const low = $derived(points.length ? Math.min(...points.map((p) => p.minCents)) : 0);
	// Zero stays in view whenever anything goes under it, so the zero line and the orange show
	// even when the whole band is under zero.
	const high = $derived(
		points.length ? Math.max(...points.map((p) => p.maxCents), low < 0 ? 0 : -Infinity) : 0
	);

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

	const x = $derived((i: number) => PAD + (i / Math.max(points.length - 1, 1)) * (width - 2 * PAD));
	const y = $derived(
		(cents: number) =>
			PAD + ((domainHigh - cents) / (domainHigh - domainLow)) * (drawHeight - 2 * PAD)
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
	// The area between the worst-case line and the zero line; a clip path at zero keeps
	// only the part under zero, which is filled expense-orange.
	const goesUnder = $derived(points.some((p) => p.minCents < 0));
	const underPath = $derived(
		goesUnder
			? `${minPath} L${x(points.length - 1).toFixed(1)} ${y(0).toFixed(1)} ` +
					`L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`
			: ''
	);

	/** The expected line's height at a fractional day, so a dot fanned off its day stays on it. */
	function yAlong(day: number) {
		const t = Math.min(Math.max(day, 0), points.length - 1);
		const i = Math.floor(t);
		const j = Math.min(i + 1, points.length - 1);
		return y(points[i].actualCents + (points[j].actualCents - points[i].actualCents) * (t - i));
	}

	const dots = $derived.by(() => {
		const dayOf = new Map(points.map((p, i) => [p.date, i]));
		const byDay = new Map<number, ChartEvent[]>();
		for (const event of events) {
			const day = dayOf.get(event.date);
			if (day === undefined) continue;
			const same = byDay.get(day);
			if (same) same.push(event);
			else byDay.set(day, [event]);
		}
		const dayWidth = (width - 2 * PAD) / Math.max(points.length - 1, 1);
		return [...byDay].flatMap(([day, same]) =>
			same.map((event, k): Dot => {
				const offset = (k - (same.length - 1) / 2) * FAN;
				return {
					key: `${event.date}-${k}`,
					cx: x(day) + offset,
					cy: yAlong(day + offset / dayWidth),
					kind: event.kind,
					label: `${formatDate(event.date)} · ${event.name} · ${amount(event.kind, event.actualCents)}`
				};
			})
		);
	});

	// A tap (or click) near a dot shows its label; the dots' <title>s only show on hover.
	let picked = $state<string | null>(null);
	const pickedDot = $derived(dots.find((dot) => dot.key === picked));

	/** Picks the dot nearest the tap across, within 16px, or clears the pick. */
	function pick(event: PointerEvent) {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const at = ((event.clientX - box.left) / box.width) * width;
		let nearest: Dot | undefined;
		for (const dot of dots) {
			if (!nearest || Math.abs(dot.cx - at) < Math.abs(nearest.cx - at)) nearest = dot;
		}
		picked = nearest && Math.abs(nearest.cx - at) <= 16 ? nearest.key : null;
	}

	// Pointer only, on purpose: what a label shows is also in the dots' <title>s (on hover) and in
	// the overview's Coming up list, which keyboards and screen readers reach.
	function listenForTaps(node: HTMLElement) {
		node.addEventListener('pointerup', pick);
		return () => node.removeEventListener('pointerup', pick);
	}

	const first = $derived(points.at(0));
	const middle = $derived(points.at(Math.floor((points.length - 1) / 2)));
	const last = $derived(points.at(-1));
	// The lowest expected point, the earliest on ties (as the API's `lowest`).
	const lowest = $derived(
		points.reduce<Point | undefined>(
			(lowestSoFar, p) =>
				!lowestSoFar || p.actualCents < lowestSoFar.actualCents ? p : lowestSoFar,
			undefined
		)
	);
	const summary = $derived(
		first && last && lowest
			? `Forecast balance from ${formatDate(first.date)} to ${formatDate(last.date)}: ends between ` +
					`${money(last.minCents)} and ${money(last.maxCents)}, expected ${money(last.actualCents)}. ` +
					`Lowest point ${money(lowest.actualCents)} on ${formatDate(lowest.date)}.`
			: 'No forecast yet.'
	);
</script>

<div class="w-full">
	<div
		class="relative h-(--chart-height) md:h-(--chart-height-md)"
		style:--chart-height="{Math.min(height, 200)}px"
		style:--chart-height-md="{height}px"
		bind:clientWidth={boxWidth}
		bind:clientHeight={boxHeight}
		{@attach listenForTaps}
	>
		<svg
			viewBox="0 0 {width} {drawHeight}"
			class="absolute inset-0 size-full overflow-visible"
			preserveAspectRatio="none"
			role="img"
			aria-label={summary}
		>
			<defs>
				<clipPath id={clipId}>
					<rect x="0" y={y(0)} {width} height={drawHeight} />
				</clipPath>
			</defs>
			{#if showAxes}
				{#each ticks as tick (tick)}
					<line
						x1="0"
						x2={width}
						y1={y(tick)}
						y2={y(tick)}
						stroke="var(--border)"
						stroke-width="1"
					/>
				{/each}
			{/if}
			<path d={bandPath} fill="var(--brand-soft)" stroke="none" />
			{#if goesUnder}
				<path
					d={underPath}
					fill="var(--expense)"
					fill-opacity="0.25"
					stroke="none"
					clip-path="url(#{clipId})"
				/>
			{/if}
			{#if low < 0}
				<line
					x1="0"
					x2={width}
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
			{#each dots as dot (dot.key)}
				<circle
					cx={dot.cx}
					cy={dot.cy}
					r={dot.key === picked ? 5 : 3.5}
					fill={dot.kind === 'income' ? 'var(--brand)' : 'var(--expense)'}
					stroke="var(--card)"
					stroke-width="1.5"><title>{dot.label}</title></circle
				>
			{/each}
		</svg>
		{#if showAxes}
			<!-- Labels are HTML over the SVG so they keep a readable size at any chart width. -->
			{#each ticks as tick (tick)}
				<span
					class="pointer-events-none absolute left-0 -translate-y-full rounded-sm bg-card/80 py-0.5 pr-1 text-[11px] leading-none text-muted-foreground tabular-nums"
					style:top="{(y(tick) / drawHeight) * 100}%"
					aria-hidden="true">{dollars(tick)}</span
				>
			{/each}
		{/if}
		{#if pickedDot}
			<!-- Beside the dot: above it unless it is near the top, and kept inside the chart. -->
			<span
				class="pointer-events-none absolute z-10 max-w-60 truncate rounded-md bg-foreground px-2 py-1 text-xs text-background tabular-nums shadow-md"
				style:left="{pickedDot.cx}px"
				style:top="{pickedDot.cy}px"
				style:translate="{pickedDot.cx < width / 3
					? '-12px'
					: pickedDot.cx > (2 * width) / 3
						? 'calc(12px - 100%)'
						: '-50%'}
				{pickedDot.cy < 40 ? '12px' : 'calc(-100% - 12px)'}"
				aria-hidden="true">{pickedDot.label}</span
			>
		{/if}
	</div>
	{#if showAxes && first && middle && last}
		<div
			class="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums"
			aria-hidden="true"
		>
			<span>{formatDate(first.date)}</span>
			<span>{formatDate(middle.date)}</span>
			<span>{formatDate(last.date)}</span>
		</div>
	{/if}
</div>
