<script lang="ts">
	import { onMount } from 'svelte';
	import { userPubkey } from '$lib/stores/user.svelte';
	import { BARISTA_PUBKEY } from '$lib/nostr/ndk';
	import { fetchSources, addSource, toggleSource, deleteSource, type RssSource } from '$lib/nostr/sources';

	interface Suggestion {
		id: string;
		url: string;
		name: string;
		category: string;
		suggestedBy: string;
		createdAt: string;
	}

	let sources = $state<RssSource[]>([]);
	let suggestions = $state<Suggestion[]>([]);
	let loading = $state(true);
	let error = $state('');

	let showAdd = $state(false);
	let newUrl = $state('');
	let newName = $state('');
	let newCategory = $state('');
	let saving = $state(false);
	let query = $state('');

	const isBarista = $derived(userPubkey.value === BARISTA_PUBKEY);
	const activeCount = $derived(sources.filter((source) => source.active).length);
	const filteredSources = $derived(sources.filter((source) => {
		const needle = query.trim().toLowerCase();
		return !needle || source.name.toLowerCase().includes(needle) || source.url.toLowerCase().includes(needle) || source.category.toLowerCase().includes(needle);
	}));

	async function loadSources() {
		loading = true;
		error = '';
		try {
			sources = await fetchSources();
			if (isBarista) {
				const res = await fetch('/api/source-suggestions', {
					headers: { 'x-pubkey': userPubkey.value ?? '' }
				});
				if (res.ok) suggestions = await res.json();
			}
		} catch (e) {
			error = 'Quellen konnten nicht geladen werden.';
		}
		loading = false;
	}

	async function approveSuggestion(s: Suggestion) {
		try {
			await addSource(s.url, s.name, s.category);
			await fetch('/api/source-suggestions', {
				method: 'DELETE',
				headers: { 'x-pubkey': userPubkey.value ?? '', 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: s.id })
			});
			suggestions = suggestions.filter((x) => x.id !== s.id);
			await loadSources();
		} catch (e) {
			error = 'Freigabe fehlgeschlagen.';
		}
	}

	async function rejectSuggestion(s: Suggestion) {
		try {
			await fetch('/api/source-suggestions', {
				method: 'DELETE',
				headers: { 'x-pubkey': userPubkey.value ?? '', 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: s.id })
			});
			suggestions = suggestions.filter((x) => x.id !== s.id);
		} catch (e) {
			error = 'Ablehnung fehlgeschlagen.';
		}
	}

	let successMsg = $state('');

	async function handleAdd() {
		if (!newUrl.trim() || !newName.trim()) return;

		// Duplikat-Check gegen bestehende Quellen
		const urlNorm = newUrl.trim().toLowerCase().replace(/\/+$/, '');
		const exists = sources.some((s) => s.url.toLowerCase().replace(/\/+$/, '') === urlNorm);
		if (exists) {
			error = 'Diese Quelle existiert bereits.';
			return;
		}

		saving = true;
		error = '';
		successMsg = '';
		try {
			if (isBarista) {
				// Barista kann direkt auf Nostr publishen
				await addSource(newUrl.trim(), newName.trim(), newCategory);
				await loadSources();
			} else {
				// Normale User schlagen vor (lokal gespeichert)
				const res = await fetch('/api/source-suggestions', {
					method: 'POST',
					headers: { 'x-pubkey': userPubkey.value ?? '', 'Content-Type': 'application/json' },
					body: JSON.stringify({ url: newUrl.trim(), name: newName.trim(), category: newCategory })
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Fehler');
				successMsg = 'Quelle vorgeschlagen! Der Barista prüft sie.';
			}
			newUrl = '';
			newName = '';
			newCategory = '';
			showAdd = false;
		} catch (e: any) {
			error = e.message || 'Quelle konnte nicht hinzugefügt werden.';
		}
		saving = false;
	}

	async function handleToggle(source: RssSource) {
		try {
			await toggleSource(source);
			source.active = !source.active;
		} catch (e) {
			error = 'Status konnte nicht geändert werden.';
		}
	}

	async function handleDelete(source: RssSource) {
		try {
			await deleteSource(source);
			sources = sources.filter((s) => s.id !== source.id);
		} catch (e) {
			error = 'Quelle konnte nicht gelöscht werden.';
		}
	}

	const categoryLabels: Record<string, string> = {
		markt: 'Markt & Adoption',
		technik: 'Technik & Development',
		regulierung: 'Regulierung & Politik',
		mining: 'Mining & Netzwerk',
		kultur: 'Kultur & Szene'
	};
	const formatLabels: Record<string, string> = { blog: 'Blog', podcast: 'Podcast', youtube: 'YouTube', nostr: 'Nostr', x: 'X' };
	const curatedCatalog = [
		['Blocktrainer', 'Blog', 'DE'], ['Nodesignal', 'Blog', 'DE'], ['Bitcoin verstehen', 'Podcast + YouTube', 'DE'],
		['Einundzwanzig', 'Podcast + YouTube', 'DE'], ['Bitcoin Optech', 'Blog', 'EN'], ['Bitcoin Magazine', 'Blog', 'EN'],
		['Jameson Lopp', 'Blog', 'EN'], ['BTC Sessions', 'YouTube', 'EN']
	];

	onMount(loadSources);
</script>

<svelte:head>
	<title>Quellen — BitcoinCafé</title>
</svelte:head>

{#if !userPubkey.value}
	<div class="py-20 text-center">
		<p class="text-lg text-text-secondary">Bitte einloggen um Quellen zu sehen.</p>
	</div>
{:else}
	<div class="menu-page mb-8 flex flex-col gap-6 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-8">
		<div>
			<p class="menu-kicker mb-3">Zutaten & Lieferanten</p>
			<h1 class="neon-text text-4xl font-semibold">Quellen</h1>
			<p class="mt-2 text-sm text-text-secondary">{activeCount} von {sources.length} Feeds aktiv · {suggestions.length} Vorschläge</p>
		</div>
		<button
			onclick={() => (showAdd = !showAdd)}
			class="border border-accent bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-black"
		>
			+ Quelle vorschlagen
		</button>
	</div>

	{#if error}
		<div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
			{error}
		</div>
	{/if}

	{#if !loading && sources.length > 0}
		<label class="mb-5 block">
			<span class="menu-kicker mb-2 block">Karte durchsuchen</span>
			<input bind:value={query} type="search" placeholder="Name, URL oder Kategorie" class="w-full border-0 border-b border-border bg-transparent px-0 py-3 text-sm outline-none transition-colors focus:border-accent" />
		</label>
	{/if}
	{#if successMsg}
		<div class="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
			{successMsg}
		</div>
	{/if}

	{#if showAdd}
		<div class="mb-6 rounded-xl border border-border bg-bg-card p-4">
			<h2 class="mb-4 text-lg font-semibold">Neue Quelle</h2>
			<div class="flex flex-col gap-3">
				<input
					bind:value={newName}
					placeholder="Name (z.B. BTC-ECHO)"
					class="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
				/>
				<input
					bind:value={newUrl}
					placeholder="RSS-Feed URL"
					class="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
				/>
				<select
					bind:value={newCategory}
					class="rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
				>
					<option value="">Kategorie (optional)</option>
					<option value="markt">Markt & Adoption</option>
					<option value="technik">Technik & Development</option>
					<option value="regulierung">Regulierung & Politik</option>
					<option value="mining">Mining & Netzwerk</option>
					<option value="kultur">Kultur & Szene</option>
				</select>
				<div class="flex gap-2">
					<button
						onclick={handleAdd}
						disabled={saving || !newUrl.trim() || !newName.trim()}
						class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent/80 disabled:opacity-50"
					>
						{saving ? 'Speichern...' : 'Hinzufügen'}
					</button>
					<button
						onclick={() => (showAdd = false)}
						class="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary"
					>
						Abbrechen
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Vorschläge (nur Barista) -->
	{#if isBarista && suggestions.length > 0}
		<div class="mb-6">
			<h2 class="mb-3 text-lg font-semibold">Vorschläge ({suggestions.length})</h2>
			<div class="flex flex-col gap-3">
				{#each suggestions as s (s.id)}
					<div class="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium">{s.name}</span>
								{#if s.category}
									<span class="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">{s.category}</span>
								{/if}
							</div>
							<p class="truncate text-xs text-text-secondary">{s.url}</p>
							<p class="mt-1 text-xs text-text-secondary/60">von {s.suggestedBy.slice(0, 12)}...</p>
						</div>
						<button
							onclick={() => approveSuggestion(s)}
							class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
						>
							Freigeben
						</button>
						<button
							onclick={() => rejectSuggestion(s)}
							class="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
						>
							Ablehnen
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="py-12 text-center">
			<div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
			<p class="mt-3 text-sm text-text-secondary">Quellen laden...</p>
		</div>
	{:else if sources.length === 0}
		<div class="rounded-xl border border-border bg-bg-card py-12 text-center">
			<p class="text-4xl">📡</p>
			<p class="mt-3 text-text-secondary">Noch keine Quellen konfiguriert.</p>
			<p class="mt-1 text-sm text-text-secondary/60">Füge RSS-Feeds hinzu, um die Content-Pipeline zu füttern.</p>
		</div>
	{:else}
		<div class="menu-page px-5 sm:px-8">
			{#each filteredSources as source (source.id)}
				<div class="flex items-center gap-4 border-b border-dashed border-border py-5 last:border-0 {!source.active ? 'opacity-45' : ''}">
					{#if isBarista}
						<button
							onclick={() => handleToggle(source)}
							class="flex h-6 w-10 shrink-0 items-center rounded-full transition-colors {source.active ? 'bg-green-600' : 'bg-bg-primary'}"
							title={source.active ? 'Deaktivieren' : 'Aktivieren'}
						>
							<span class="h-4 w-4 transform rounded-full bg-white shadow transition-transform {source.active ? 'translate-x-5' : 'translate-x-1'}"></span>
						</button>
					{/if}

					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="font-medium">{source.name}</span>
							<span class="font-sans text-[9px] uppercase tracking-wider text-text-secondary">{formatLabels[source.format] ?? source.format}</span>
							{#if source.category}
								<span class="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
									{categoryLabels[source.category] ?? source.category}
								</span>
							{/if}
						</div>
						<p class="truncate text-xs text-text-secondary">{source.url}</p>
					</div>

					{#if isBarista}
						<button
							onclick={() => handleDelete(source)}
							class="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-red-500/10 hover:text-red-400"
							title="Löschen"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<section class="mt-8">
		<div class="mb-3 flex items-end justify-between border-b border-border pb-3">
			<div><p class="menu-kicker mb-2">Fest im Abo</p><h2 class="text-xl">Kuratierter Grundbestand</h2></div>
			<span class="font-sans text-[10px] uppercase tracking-wider text-text-secondary">Pipeline</span>
		</div>
		<div class="grid gap-x-8 sm:grid-cols-2">
			{#each curatedCatalog as source}
				<div class="flex items-baseline gap-3 border-b border-dashed border-border py-3">
					<span class="flex-1 text-sm">{source[0]}</span>
					<span class="font-sans text-[9px] uppercase tracking-wider text-accent">{source[1]}</span>
					<span class="font-sans text-[9px] text-text-secondary">{source[2]}</span>
				</div>
			{/each}
		</div>
		<p class="mt-4 text-xs leading-relaxed text-text-secondary">X-Accounts werden als redaktionelle Watchlist geführt. Automatischer Import erfordert einen X-API-Zugang oder eine eigene RSS-Bridge.</p>
	</section>
{/if}
