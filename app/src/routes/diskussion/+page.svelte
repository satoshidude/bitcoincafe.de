<script lang="ts">
	import { fetchNotes, type ShortNote } from '$lib/nostr/articles';
	import { onMount } from 'svelte';

	let notes = $state<ShortNote[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			notes = await fetchNotes(30);
		} catch (e) {
			console.error('Fetch notes error:', e);
		} finally {
			loading = false;
		}
	});

	function timeAgo(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'gerade eben';
		if (mins < 60) return `vor ${mins} Min.`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `vor ${hours} Std.`;
		const days = Math.floor(hours / 24);
		return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
	}
</script>

<svelte:head>
	<title>Community — BitcoinCafé.de</title>
</svelte:head>

<section>
	<header class="menu-page mb-8 px-6 py-8 sm:px-8">
		<p class="menu-kicker mb-3">Gespräche am Tresen</p>
		<h1 class="neon-text text-4xl font-semibold">Community</h1>
		<p class="mt-2 text-sm text-text-secondary">Diskutiere mit der Bitcoin-Community</p>
	</header>

	{#if loading}
		<div class="flex flex-col items-center gap-3 py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
			<p class="text-sm text-text-secondary">Lade Beitraege...</p>
		</div>
	{:else if notes.length === 0}
		<div class="rounded-xl border border-border bg-bg-card p-6 text-center">
			<p class="mb-2 text-lg">Noch keine Beitraege</p>
			<p class="text-sm text-text-secondary">
				Melde dich mit deinem Nostr-Key an um den ersten Beitrag zu schreiben.
			</p>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each notes as note}
				<div class="rounded-xl border border-border bg-bg-card p-4">
					<div class="mb-2 flex items-center gap-3">
						{#if note.authorPicture}
							<img src={note.authorPicture} alt="" class="h-9 w-9 rounded-full" />
						{:else}
							<div class="h-9 w-9 rounded-full bg-accent/20"></div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{note.authorName}</p>
							<p class="text-xs text-text-secondary">{timeAgo(note.createdAt)}</p>
						</div>
					</div>
					<p class="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{note.content}</p>
				</div>
			{/each}
		</div>
	{/if}
</section>
