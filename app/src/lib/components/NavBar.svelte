<script lang="ts">
	import { page } from '$app/state';
	import { userPubkey } from '$lib/stores/user.svelte';
	import { BARISTA_PUBKEY } from '$lib/nostr/ndk';

	const isBarista = $derived(userPubkey.value === BARISTA_PUBKEY);
	const isLoggedIn = $derived(!!userPubkey.value);

	const baseItems = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/heute', label: 'Heute', icon: 'news' },
		{ href: '/netzwerk', label: 'Netzwerk', icon: 'network' },
		{ href: '/profil', label: 'Profil', icon: 'user' }
	];

	const navItems = $derived([
		...baseItems,
		...(isLoggedIn ? [{ href: '/quellen', label: 'Quellen', icon: 'rss' }] : []),
		...(isBarista ? [{ href: '/redaktion', label: 'Redaktion', icon: 'edit' }] : [])
	]);

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<!-- Top Bar: Logo + Nav -->
<nav class="sticky top-0 z-50 border-b border-border/50 bg-[#120d0a]/95 shadow-[0_12px_35px_rgba(0,0,0,.35)] backdrop-blur-xl">
	<!-- Logo + Dark Mode Toggle -->
	<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
		<p class="hidden text-[10px] uppercase tracking-[.28em] text-text-secondary sm:block">News · Nostr · Sats</p>
		<a href="/" class="neon-sign rounded px-3 py-1">
			<img src="/images/bitcoincafe-logo-horizontal-transparent.png" alt="BitcoinCafé" class="h-auto w-52 sm:w-64" />
		</a>
		<p class="text-[10px] uppercase tracking-[.2em] text-accent">Open 24/7</p>
	</div>

	<!-- Horizontale Navigation -->
	<div class="mx-auto flex max-w-5xl items-center justify-start gap-1 overflow-x-auto px-3 pb-3 sm:justify-center">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex shrink-0 items-center gap-1.5 border-b px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors {isActive(item.href) ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}"
			>
				<span class="text-sm">{@html getIcon(item.icon)}</span>
				<span>{item.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.neon-sign { filter: drop-shadow(0 0 4px #ff8b22) drop-shadow(0 0 14px rgba(255,83,13,.6)); }
</style>

<script lang="ts" module>
	function getIcon(name: string): string {
		const icons: Record<string, string> = {
			home: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
			news: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="18" y1="14" x2="10" y2="14"/><line x1="15" y1="18" x2="10" y2="18"/><rect x="10" y="6" width="8" height="5" rx="1"/></svg>`,
			network: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="12" width="4" height="10" rx="1"/><rect x="10" y="6" width="4" height="16" rx="1"/><rect x="18" y="2" width="4" height="20" rx="1"/></svg>`,
			chat: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
			user: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
			rss: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>`,
			edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
		};
		return icons[name] ?? '';
	}
</script>
