<script lang="ts">
	import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '$lib/site';

	// Every public page's <head> in one place: title, description, canonical,
	// Open Graph, and Twitter card. Pass noindex for utility pages (sign-in,
	// offline, errors) and keep it off for the landing page.
	let {
		title,
		description = SITE_DESCRIPTION,
		path = '/',
		image = OG_IMAGE,
		noindex = false
	}: {
		title: string;
		description?: string;
		path?: string;
		image?: string;
		noindex?: boolean;
	} = $props();

	const url = $derived(`${SITE_URL}${path}`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	{#if noindex}<meta name="robots" content="noindex, nofollow" />{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="kriket — Budgeting for bumpy income" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>
