<script lang="ts">
	import { fetchRelayStats } from '$lib/nostr/articles';
	import { RELAYS } from '$lib/nostr/ndk';
	import { onMount } from 'svelte';

	let stats = $state<{ articles: number; notes: number; profiles: number; totalEvents: number } | null>(null);
	let loading = $state(true);
	let shareLabel = $state('Profil teilen');

	onMount(async () => {
		try {
			stats = await fetchRelayStats();
		} catch (e) {
			console.error('Fetch relay stats error:', e);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Netzwerk — BitcoinCafé.de</title>
</svelte:head>

<section>
	<header class="menu-page mb-8 px-6 py-8 sm:px-8">
		<p class="menu-kicker mb-3">Leitungen & Pegel</p>
		<h1 class="neon-text text-4xl font-semibold">Netzwerk</h1>
		<p class="mt-2 font-sans text-xs text-text-secondary">{RELAYS[0]}</p>
	</header>

	{#if loading}
		<div class="flex flex-col items-center gap-3 py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
			<p class="text-sm text-text-secondary">Lade Relay-Stats...</p>
		</div>
	{:else if stats}
		<div class="menu-page grid grid-cols-2 px-6 sm:grid-cols-4 sm:px-8">
			{#each [[stats.articles, 'Artikel'], [stats.notes, 'Beiträge'], [stats.profiles, 'Profile'], [stats.totalEvents, 'Events']] as item}
				<div class="border-b border-dashed border-border py-6 text-center sm:border-b-0 sm:border-r sm:last:border-0">
					<p class="neon-text text-3xl font-bold">{item[0]}</p><p class="mt-2 font-sans text-[10px] uppercase tracking-wider text-text-secondary">{item[1]}</p>
				</div>
			{/each}
		</div>

		<div class="mt-6 rounded-xl border border-border bg-bg-card p-4">
			<h2 class="mb-2 text-sm font-semibold">Relay-Info</h2>
			<div class="space-y-2 text-sm text-text-secondary">
				<div class="flex justify-between">
					<span>URL</span>
					<span class="font-mono text-text-primary">{RELAYS[0]}</span>
				</div>
				<div class="flex justify-between">
					<span>Status</span>
					<span class="text-success">Verbunden</span>
				</div>
			</div>
		</div>
	{:else}
		<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-400">
			Verbindung zum Relay fehlgeschlagen
		</div>
	{/if}

	<!-- Nostr Social -->
	<div class="mt-8">
		<h2 class="mb-1 text-xl font-bold">BitcoinCafé auf Nostr</h2>
		<p class="mb-4 text-sm text-text-secondary">Folge uns auf deiner Lieblings-Plattform</p>

		<div class="grid grid-cols-2 gap-3">
			<a href="https://primal.net/p/npub19f4m5axjtm50pdpxs8gwq4vusnx7dd8hkkhc3j02hxz4y55aszhqdaf86u" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-accent/50">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#FA3C74]/15 text-[#FA3C74]">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.8 14.2c-.5 1-1.4 1.6-2.5 1.8-.7.1-1.3.1-2 0-1.2-.2-2.3-.7-3.1-1.6-.6-.6-1-1.4-1.1-2.3-.1-.8-.1-1.7.2-2.5.4-1.1 1.1-1.9 2.2-2.4.7-.4 1.5-.5 2.4-.5 1 0 1.9.3 2.6.9.9.6 1.3 1.5 1.4 2.6 0 .5 0 1-.2 1.4-.3.7-.8 1.1-1.4 1.2-.4.1-.8.1-1.2 0-.5-.2-.8-.5-.9-1 0-.1 0-.1-.1-.2-.2.3-.5.5-.8.6-.6.1-1.1-.1-1.4-.6-.2-.4-.3-.8-.2-1.2.1-.8.5-1.3 1.1-1.7.5-.2 1-.3 1.5-.1.2.1.4.2.5.3l.1-.2h.9c-.2.8-.4 1.5-.6 2.2-.1.4-.2.8-.3 1.1 0 .2 0 .4.2.4.3.1.6 0 .8-.2.3-.3.4-.6.5-1 .1-.6 0-1.3-.4-1.8-.4-.8-1.1-1.2-2-1.4-.7-.2-1.3-.1-2 .1-1 .3-1.6.9-2 1.8-.3.7-.3 1.5-.1 2.2.2.9.8 1.5 1.6 1.8.6.3 1.3.3 1.9.2.5-.1.9-.2 1.3-.4.1-.1.2-.1.3 0 .1.2 0 .3-.1.4-.4.3-.8.5-1.3.6z"/></svg>
				</div>
				<div>
					<p class="text-sm font-semibold">Primal</p>
					<p class="text-xs text-text-secondary">Web & Mobile</p>
				</div>
			</a>

			<a href="https://snort.social/p/npub19f4m5axjtm50pdpxs8gwq4vusnx7dd8hkkhc3j02hxz4y55aszhqdaf86u" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-accent/50">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#4B9EFF]/15 text-[#4B9EFF]">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
				</div>
				<div>
					<p class="text-sm font-semibold">Snort</p>
					<p class="text-xs text-text-secondary">Web Client</p>
				</div>
			</a>

			<a href="https://nostrudel.ninja/#/u/npub19f4m5axjtm50pdpxs8gwq4vusnx7dd8hkkhc3j02hxz4y55aszhqdaf86u" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-accent/50">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
				</div>
				<div>
					<p class="text-sm font-semibold">noStrudel</p>
					<p class="text-xs text-text-secondary">Power-User Client</p>
				</div>
			</a>

			<a href="https://nostr.nsnip.io/npub19f4m5axjtm50pdpxs8gwq4vusnx7dd8hkkhc3j02hxz4y55aszhqdaf86u" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-accent/50">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#10B981]/15 text-[#10B981]">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
				</div>
				<div>
					<p class="text-sm font-semibold">Nosta</p>
					<p class="text-xs text-text-secondary">Profil-Explorer</p>
				</div>
			</a>

			<a href="https://njump.me/npub19f4m5axjtm50pdpxs8gwq4vusnx7dd8hkkhc3j02hxz4y55aszhqdaf86u" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-4 transition-colors hover:border-accent/50">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
				</div>
				<div>
					<p class="text-sm font-semibold">njump</p>
					<p class="text-xs text-text-secondary">Nostr Gateway</p>
				</div>
			</a>
		</div>

		<!-- Share Button -->
		<div class="mt-4">
			<button
				onclick={() => {
					const url = 'https://njump.me/npub19f4m5axjtm50pdpxs8gwq4vusnx7dd8hkkhc3j02hxz4y55aszhqdaf86u';
					if (navigator.share) {
						navigator.share({ title: 'BitcoinCafé auf Nostr', url });
					} else {
						navigator.clipboard.writeText(url);
						shareLabel = 'Kopiert!';
						setTimeout(() => shareLabel = 'Profil teilen', 2000);
					}
				}}
				class="flex w-full items-center justify-center gap-2 rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 py-3 text-sm font-medium text-[#8B5CF6] transition-colors hover:bg-[#8B5CF6]/20"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
				{shareLabel}
			</button>
		</div>
	</div>
</section>
