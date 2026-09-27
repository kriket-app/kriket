<script lang="ts">
	import { ChartLine, Repeat, Target } from '@lucide/svelte';
	import BrandMark from '$lib/components/brand-mark.svelte';
	import InstallPrompt from '$lib/components/install-prompt.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { formatCents } from '$lib/money';

	const REPO_URL = 'https://github.com/kriket-app/kriket';

	// A made-up 91-day forecast for the hero: paid every two weeks, rent twice, weekly groceries.
	// The worst case (lowest pay, biggest grocery bill) dips below zero before the second pay day.
	function samplePoints() {
		let min = 40_000;
		let actual = 40_000;
		let max = 40_000;
		return Array.from({ length: 91 }, (_, day) => {
			if (day >= 2 && (day - 2) % 14 === 0) {
				min += 80_000;
				actual += 100_000;
				max += 120_000;
			}
			if (day === 5 || day === 35) {
				min -= 95_000;
				actual -= 95_000;
				max -= 95_000;
			}
			if (day % 7 === 0) {
				min -= 16_000;
				actual -= 12_000;
				max -= 8_000;
			}
			const date = new Date(Date.UTC(2026, 9, 1 + day)).toISOString().slice(0, 10);
			return { date, minCents: min, actualCents: actual, maxCents: max };
		});
	}
	const points = samplePoints();
	const end = points[points.length - 1];

	// A static illustration, not the real forecast chart: the worst-case line dips below zero
	// around the rent day, drawn in the expense colour; a green dot marks a pay day and an orange
	// dot marks the rent day that causes the dip.
	const ILLO_WIDTH = 640;
	const ILLO_HEIGHT = 200;
	const ILLO_PAD = 4;
	const illoLow = Math.min(...points.map((p) => p.minCents));
	const illoHigh = Math.max(...points.map((p) => p.maxCents));
	const illoX = (i: number) => ILLO_PAD + (i / (points.length - 1)) * (ILLO_WIDTH - 2 * ILLO_PAD);
	const illoY = (cents: number) =>
		ILLO_PAD + ((illoHigh - cents) / (illoHigh - illoLow)) * (ILLO_HEIGHT - 2 * ILLO_PAD);
	const illoPath = (key: 'minCents' | 'actualCents' | 'maxCents') =>
		points
			.map((p, i) => `${i ? 'L' : 'M'}${illoX(i).toFixed(1)} ${illoY(p[key]).toFixed(1)}`)
			.join(' ');
	const illoBandPath = `${illoPath('maxCents')} ${points
		.map((p, i) => `L${illoX(i).toFixed(1)} ${illoY(p.minCents).toFixed(1)}`)
		.reverse()
		.join(' ')} Z`;
	const illoZeroY = illoY(0);
	const payDayIndex = 2;
	const rentDayIndex = 5;

	const features = [
		{
			icon: Repeat,
			title: 'Streams, not receipts',
			body: 'Add each paycheque and bill once: the usual amount, how often, and the next date. Add a range only for the ones that move. Set it up once and stop logging every coffee.'
		},
		{
			icon: ChartLine,
			title: 'A forecast you can act on',
			body: 'See your balance for the next 90 days at the worst, expected, and best case, so a thin week shows up long before it arrives.'
		},
		{
			icon: Target,
			title: 'Goals: a number and a date',
			body: "Tell kriket what you're saving for, how much you want to have, and by when. It reads your forecast on that day and says whether you get there, and by how much."
		}
	];

	const steps = [
		{
			title: 'Tell kriket your balance',
			body: 'One number to start from. Update it whenever you check your bank.'
		},
		{
			title: 'Add what comes in and goes out, just the usual amount',
			body: 'Shifts, paycheques, rent, groceries: the usual amount and how often. A range is optional.'
		},
		{
			title: 'Check in now and then; kriket keeps the forecast honest',
			body: "Type today's balance whenever you look at your bank; the forecast starts again from it."
		}
	];
</script>

<svelte:head>
	<title>kriket · Budgeting for bumpy income</title>
	<meta
		name="description"
		content="Kriket forecasts where your money is heading from the income and expenses you actually have, ranges included."
	/>
</svelte:head>

<div class="min-h-dvh bg-background text-foreground">
	<header
		class="pt-safe mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
	>
		<a href="/" class="flex items-center gap-2 text-lg font-semibold">
			<BrandMark class="size-7" /> kriket
		</a>
		<nav class="flex items-center gap-1 sm:gap-2" aria-label="Account">
			<Button href="/signin" variant="ghost">Sign in</Button>
			<Button href="/signup">Get started</Button>
		</nav>
	</header>

	<main>
		<section class="bg-brand-soft">
			<div
				class="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-16"
			>
				<div>
					<p class="text-sm font-semibold tracking-wide text-brand-strong uppercase">
						Budgeting for bumpy income
					</p>
					<h1
						class="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl lg:leading-[1.05]"
					>
						Is your bank account sounding like crickets?
					</h1>
					<p class="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
						Kriket forecasts where your money is heading from the income and expenses you actually
						have, ranges included, so you know weeks ahead whether you'll make it, and what to
						change if you won't.
					</p>
					<p class="mt-4 max-w-xl text-lg font-semibold text-balance">
						kriket tells you the day your money runs short, before it does.
					</p>
					<div class="mt-8 flex flex-wrap gap-3">
						<Button href="/signup" size="lg" class="px-5">Get started</Button>
						<Button href="#how" size="lg" variant="outline" class="px-5">See how it works</Button>
						<InstallPrompt />
					</div>
					<p class="mt-4 max-w-xl text-sm text-muted-foreground">
						Email and password only. No bank access, nothing sold, your data is yours alone.
					</p>
				</div>

				<Card.Root class="shadow-lg">
					<Card.Header>
						<Card.Description>Expected balance in 90 days</Card.Description>
						<Card.Title class="text-3xl font-semibold tracking-tight tabular-nums">
							{formatCents(end.actualCents)}
						</Card.Title>
						<p class="text-sm text-muted-foreground tabular-nums">
							Somewhere between {formatCents(end.minCents)} and {formatCents(end.maxCents)}
						</p>
					</Card.Header>
					<Card.Content>
						<figure>
							<svg
								viewBox="0 0 {ILLO_WIDTH} {ILLO_HEIGHT}"
								class="w-full"
								preserveAspectRatio="xMidYMid meet"
								role="img"
								aria-label="Sample forecast: pay day lifts the balance, then the rent day dips the worst case below zero before recovering."
							>
								<clipPath id="hero-below-zero">
									<rect x="0" y={illoZeroY} width={ILLO_WIDTH} height={ILLO_HEIGHT - illoZeroY} />
								</clipPath>
								<path d={illoBandPath} fill="var(--brand-soft)" stroke="none" />
								<line
									x1="0"
									x2={ILLO_WIDTH}
									y1={illoZeroY}
									y2={illoZeroY}
									stroke="var(--muted-foreground)"
									stroke-width="1"
									stroke-dasharray="4 4"
								/>
								<path
									d={illoPath('minCents')}
									fill="none"
									stroke="var(--chart-3)"
									stroke-width="1.5"
								/>
								<path
									d={illoPath('minCents')}
									fill="none"
									stroke="var(--expense)"
									stroke-width="1.5"
									clip-path="url(#hero-below-zero)"
								/>
								<path
									d={illoPath('maxCents')}
									fill="none"
									stroke="var(--chart-3)"
									stroke-width="1.5"
								/>
								<path
									d={illoPath('actualCents')}
									fill="none"
									stroke="var(--brand)"
									stroke-width="2.5"
									stroke-linejoin="round"
									stroke-linecap="round"
								/>
								<circle
									cx={illoX(payDayIndex)}
									cy={illoY(points[payDayIndex].actualCents)}
									r="5"
									fill="var(--brand)"
								/>
								<circle
									cx={illoX(rentDayIndex)}
									cy={illoY(points[rentDayIndex].minCents)}
									r="5"
									fill="var(--expense)"
								/>
							</svg>
							<figcaption
								class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
							>
								<span class="flex items-center gap-2">
									<span
										class="relative h-3 w-6 rounded-sm border border-chart-3 bg-brand-soft"
										aria-hidden="true"
									>
										<span class="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-brand"></span>
									</span>
									Worst case, expected, best case
								</span>
								<span class="flex items-center gap-1.5">
									<span class="size-2.5 rounded-full bg-brand" aria-hidden="true"></span>
									Pay day
								</span>
								<span class="flex items-center gap-1.5">
									<span class="size-2.5 rounded-full bg-expense" aria-hidden="true"></span>
									Rent day
								</span>
							</figcaption>
						</figure>
					</Card.Content>
				</Card.Root>
			</div>
		</section>

		<section id="features" class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
			<div class="max-w-2xl">
				<h2 class="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
					Set it up once. Mostly leave it alone.
				</h2>
				<p class="mt-4 text-lg text-pretty text-muted-foreground">
					Your pay and your grocery bill are ranges, not numbers. Kriket plans with the range
					instead of pretending.
				</p>
			</div>
			<div class="mt-12 grid gap-6 md:grid-cols-3">
				{#each features as feature (feature.title)}
					{@const Icon = feature.icon}
					<Card.Root>
						<Card.Header>
							<span
								class="mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"
							>
								<Icon class="size-5" />
							</span>
							<Card.Title class="flex items-center gap-2 text-lg font-semibold">
								{feature.title}
							</Card.Title>
						</Card.Header>
						<Card.Content>
							<p class="text-base text-muted-foreground">{feature.body}</p>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</section>

		<section id="how" class="border-t">
			<div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
				<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
				<ol class="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
					{#each steps as step, i (step.title)}
						<li class="flex gap-4 md:flex-col">
							<span
								class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground"
							>
								{i + 1}
							</span>
							<div>
								<h3 class="text-lg font-semibold">{step.title}</h3>
								<p class="mt-1 text-muted-foreground">{step.body}</p>
							</div>
						</li>
					{/each}
				</ol>
			</div>
		</section>

		<section class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
			<div
				class="rounded-3xl bg-brand-strong px-6 py-12 text-center text-brand-foreground sm:px-12 md:py-16"
			>
				<h2 class="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
					Hear the crickets coming, weeks early.
				</h2>
				<p class="mx-auto mt-4 max-w-xl text-lg text-pretty">
					Add your streams once and kriket keeps an eye on the next 90 days for you.
				</p>
				<Button
					href="/signup"
					size="lg"
					class="mt-8 bg-background px-5 text-brand-strong hover:bg-brand-soft"
				>
					Get started
				</Button>
			</div>
		</section>
	</main>

	<footer class="border-t">
		<div
			class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6"
		>
			<a href="/" class="flex items-center gap-2 font-semibold text-foreground">
				<BrandMark class="size-5" /> kriket
			</a>
			<a href={REPO_URL} class="underline-offset-4 hover:text-foreground hover:underline">
				Open source, built at Co.Hack 2026 in Saskatoon
			</a>
		</div>
	</footer>
</div>
