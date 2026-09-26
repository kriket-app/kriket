<script lang="ts">
	import { cn } from '$lib/utils';

	/** A tag's colour as a small dot; a tag without a colour gets an empty ring. */
	let { color, class: className }: { color: string | null; class?: string } = $props();
</script>

<span
	class={cn(
		'inline-block size-2.5 shrink-0 rounded-full',
		!color && 'border border-muted-foreground',
		className
	)}
	style:background-color={color}
	aria-hidden="true"
></span>
