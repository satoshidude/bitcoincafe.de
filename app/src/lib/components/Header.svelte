<script lang="ts">
	import { userPubkey, userProfile } from '$lib/stores/user.svelte';
	import { loginWithExtension, logout } from '$lib/nostr/login';

	let loggingIn = $state(false);

	async function handleLogin() {
		loggingIn = true;
		try {
			await loginWithExtension();
		} finally {
			loggingIn = false;
		}
	}
</script>

<header class="sticky top-0 z-40 border-b border-border bg-bg-primary/80 backdrop-blur-sm md:hidden">
	<div class="flex items-center justify-between px-4 py-3">
		<a href="/" class="flex items-center gap-2">
			<img src="/images/bitcoincafe-logo-horizontal-transparent.png" alt="BitcoinCafé" class="h-auto w-40" />
		</a>
		{#if userPubkey.value}
			<button onclick={logout} class="flex items-center gap-2">
				{#if userProfile.value?.picture}
					<img src={userProfile.value.picture} alt="" class="h-8 w-8 rounded-full object-cover" />
				{:else}
					<div class="h-8 w-8 rounded-full bg-accent/20"></div>
				{/if}
			</button>
		{:else}
			<button
				onclick={handleLogin}
				disabled={loggingIn}
				class="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg-primary transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				{loggingIn ? '...' : 'Anmelden'}
			</button>
		{/if}
	</div>
</header>
