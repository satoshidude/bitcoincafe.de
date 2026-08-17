<script lang="ts">
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { onMount } from 'svelte';
	import { connectNdk } from '$lib/nostr/ndk';
	import { getSavedPubkey, loginWithExtension } from '$lib/nostr/login';

	let { children } = $props();

	onMount(async () => {
		settings.init();
		await connectNdk();

		// Auto-reconnect wenn User zuvor eingeloggt war
		const savedPubkey = getSavedPubkey();
		if (savedPubkey && window.nostr) {
			await loginWithExtension();
		}
	});
</script>

<div class="min-h-screen">
	<NavBar />

	<main>
		<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
			{@render children()}
		</div>
	</main>
</div>
