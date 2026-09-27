<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import PrivacyContent from './privacy-content.svelte';
	import TermsContent from './terms-content.svelte';

	// Which document the dialog shows; set back to null to close. The dialog
	// stays inside the app, so installed-PWA users (no browser chrome, no back
	// button) never leave kriket to read the policies.
	let {
		which = $bindable<'privacy' | 'terms' | null>(null)
	}: { which?: 'privacy' | 'terms' | null } = $props();
</script>

<Dialog.Root
	open={which !== null}
	onOpenChange={(open) => {
		if (!open) which = null;
	}}
>
	<Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{which === 'terms' ? 'Terms of use' : 'Privacy statement'}</Dialog.Title>
		</Dialog.Header>
		{#if which === 'terms'}
			<TermsContent />
		{:else}
			<PrivacyContent />
		{/if}
		<div class="flex justify-end">
			<Button onclick={() => (which = null)}>Close</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
