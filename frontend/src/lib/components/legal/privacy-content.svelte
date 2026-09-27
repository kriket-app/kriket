<script lang="ts">
	import { PRIVACY_VERSION } from '$lib/legal/versions';
</script>

<div class="prose-sm grid gap-4">
	<p class="text-sm text-muted-foreground">
		Effective {PRIVACY_VERSION}. Version {PRIVACY_VERSION}.
	</p>

	<section class="grid gap-1.5">
		<h2 class="text-base font-semibold">What kriket stores about you</h2>
		<p class="text-sm text-muted-foreground">
			Your name and email (for sign-in), and whatever you enter: income and expense streams, balance
			check-ins, goals, tags, and push notification subscriptions if you enable them. That is all.
			There is no advertising profile, no analytics tracker, and no bank connection.
		</p>
	</section>

	<section class="grid gap-1.5">
		<h2 class="text-base font-semibold">Bank statements stay on your device</h2>
		<p class="text-sm text-muted-foreground">
			If you import a bank statement, the PDF is read in your browser and never uploaded anywhere.
			Only the income and expense streams you explicitly add are saved. Reloading the page forgets
			the statement entirely.
		</p>
	</section>

	<section class="grid gap-1.5">
		<h2 class="text-base font-semibold">Where your data lives</h2>
		<p class="text-sm text-muted-foreground">
			Your data is stored in kriket's own database and is only ever accessed over your signed-in
			session. Sessions use secure cookies; passwords are handled by our authentication provider and
			are never stored in plain text. Push notifications, if enabled, go through your browser's push
			service.
		</p>
	</section>

	<section class="grid gap-1.5">
		<h2 class="text-base font-semibold">What we never do</h2>
		<p class="text-sm text-muted-foreground">
			We never sell your data, share it with advertisers or data brokers, or connect to your bank.
			Kriket is open source, so these claims are checkable in the code.
		</p>
	</section>

	<section class="grid gap-1.5">
		<h2 class="text-base font-semibold">Leaving</h2>
		<p class="text-sm text-muted-foreground">
			You can sign out on any device from Settings, which also drops that device's push
			subscription. To delete your account and all of its data, contact the kriket team from the
			email address on your account.
		</p>
	</section>

	<section class="grid gap-1.5">
		<h2 class="text-base font-semibold">Changes</h2>
		<p class="text-sm text-muted-foreground">
			If this statement changes in a way that affects your rights, the version above changes and you
			will be asked to accept it again before continuing to use kriket.
		</p>
	</section>
</div>
