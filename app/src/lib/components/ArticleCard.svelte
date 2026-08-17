<script lang="ts">
	import ZapButton from './ZapButton.svelte';
	import { checkEventOnRelays, type RelayStatus } from '$lib/nostr/relay-check';

	interface Props {
		title: string;
		summary: string;
		category?: string;
		publishedAt: string;
		naddr?: string;
		image?: string;
		pinned?: boolean;
		likeCount?: number;
		commentCount?: number;
		zapCount?: number;
		zapTotal?: number;
		eventId?: string;
		authorPubkey?: string;
		relayCount?: number;
	}

	let { title, summary, category, publishedAt, naddr, image, pinned = false, likeCount = 0, commentCount = 0, zapCount = 0, zapTotal = 0, eventId, authorPubkey, relayCount = 0 }: Props = $props();

	let shared = $state(false);
	let showRelayModal = $state(false);
	let relayStatuses = $state<RelayStatus[]>([]);
	let relayLoading = $state(false);

	async function handleShare() {
		const url = naddr ? `${window.location.origin}/artikel/${encodeURIComponent(naddr)}` : window.location.href;
		if (navigator.share) {
			try { await navigator.share({ title, url }); } catch {}
		} else {
			await navigator.clipboard.writeText(url);
			shared = true;
			setTimeout(() => (shared = false), 2000);
		}
	}

	async function openRelayModal() {
		if (!eventId) return;
		showRelayModal = true;
		relayLoading = true;
		relayStatuses = await checkEventOnRelays(eventId);
		relayLoading = false;
	}

	const categoryColors: Record<string, string> = {
		'markt': 'bg-blue-500/20 text-blue-400',
		'technik': 'bg-purple-500/20 text-purple-400',
		'regulierung': 'bg-red-500/20 text-red-400',
		'mining': 'bg-green-500/20 text-green-400',
		'kultur': 'bg-yellow-500/20 text-yellow-400'
	};

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('de-DE', {
			day: 'numeric',
			month: 'short'
		});
	}
</script>

<article class="group border-b border-dashed border-border/80 py-6 first:border-t">
	<a href={naddr ? `/artikel/${encodeURIComponent(naddr)}` : '#'} class="block">
		{#if image}
			<img src={image} alt="" class="mb-4 h-52 w-full rounded-sm object-cover opacity-90 transition-opacity group-hover:opacity-100" />
		{/if}
		{#if !pinned}
			<div class="mb-3 flex items-center gap-3 font-sans text-[10px] uppercase tracking-[.14em] text-text-secondary">
				{#if category}
					<span class="border-l border-accent pl-2 text-accent">
						{category}
					</span>
				{/if}
				<span>{formatDate(publishedAt)}</span>
			</div>
		{/if}
		<h3 class="mb-2 text-xl font-semibold leading-tight transition-colors group-hover:text-accent sm:text-2xl">{title}</h3>
		<p class="line-clamp-3 max-w-3xl text-[15px] leading-relaxed text-text-secondary">{summary}</p>
	</a>

	<!-- Statusbar -->
	<div class="mt-4 flex items-center gap-4 font-sans text-[10px] uppercase tracking-wider text-text-secondary">
		<span class="flex items-center gap-1 {likeCount > 0 ? 'text-red-400' : ''}">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="{likeCount > 0 ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
			{#if likeCount > 0}<span>{likeCount}</span>{/if}
		</span>
		<span class="flex items-center gap-1">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
			{#if commentCount > 0}<span>{commentCount}</span>{/if}
		</span>
		<button onclick={handleShare} class="flex items-center gap-1 hover:text-text-primary transition-colors" title="Teilen">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
			{#if shared}<span>Kopiert!</span>{/if}
		</button>
		{#if eventId}
			<button onclick={openRelayModal} class="flex items-center gap-1 hover:text-text-primary transition-colors" title="Relay-Status">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
				{#if relayCount > 0}<span>{relayCount}</span>{/if}
			</button>
		{/if}
		{#if eventId && authorPubkey}
			<span class="ml-auto">
				<ZapButton {eventId} {authorPubkey} lightningAddress="bitcoincafe@nsnip.io" {zapCount} {zapTotal} />
			</span>
		{/if}
	</div>
</article>

<!-- Relay Modal -->
{#if showRelayModal}
	<button class="fixed inset-0 z-50 bg-black/50" onclick={() => (showRelayModal = false)} aria-label="Schließen"></button>
	<div class="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-border bg-bg-card p-6 shadow-xl">
		<h3 class="mb-4 text-lg font-semibold">Relay-Verfügbarkeit</h3>
		{#if relayLoading}
			<div class="flex items-center gap-2 py-4">
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
				<span class="text-sm text-text-secondary">Prüfe Relays...</span>
			</div>
		{:else}
			<div class="flex flex-col gap-2">
				{#each relayStatuses as rs}
					<div class="flex items-center gap-2 text-sm">
						<span class="h-2 w-2 shrink-0 rounded-full {rs.found ? 'bg-green-500' : 'bg-red-500'}"></span>
						<span class="truncate {rs.found ? 'text-text-primary' : 'text-text-secondary'}">{rs.url.replace('wss://', '')}</span>
					</div>
				{/each}
			</div>
			<p class="mt-3 text-xs text-text-secondary">
				{relayStatuses.filter(r => r.found).length} von {relayStatuses.length} Relays
			</p>
		{/if}
		<button onclick={() => (showRelayModal = false)} class="mt-4 w-full rounded-lg border border-border py-2 text-sm text-text-secondary hover:bg-bg-secondary">
			Schließen
		</button>
	</div>
{/if}
