<script lang="ts">
	import { onMount } from 'svelte';
	import { userPubkey } from '$lib/stores/user.svelte';
	import { BARISTA_PUBKEY, getNdk } from '$lib/nostr/ndk';
	import { NDKEvent } from '@nostr-dev-kit/ndk';

	interface Draft {
		id: string;
		title: string;
		summary: string;
		content: string;
		category: string;
		sourceUrl: string;
		createdAt: string;
	}

	let drafts = $state<Draft[]>([]);
	let loading = $state(true);
	let error = $state('');
	let publishing = $state<string | null>(null);
	let pipelineRunning = $state(false);
	let pipelineResult = $state('');

	const isBarista = $derived(userPubkey.value === BARISTA_PUBKEY);

	async function runPipeline() {
		pipelineRunning = true;
		pipelineResult = '';
		error = '';
		try {
			const res = await fetch('/api/pipeline', {
				method: 'POST',
				headers: { 'x-pubkey': userPubkey.value ?? '' }
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Fehler');
			pipelineResult = `${data.created} neue Entwürfe erstellt`;
			await loadDrafts();
		} catch (e: any) {
			error = e.message || 'Pipeline fehlgeschlagen.';
		}
		pipelineRunning = false;
	}

	async function loadDrafts() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/drafts', {
				headers: { 'x-pubkey': userPubkey.value ?? '' }
			});
			if (!res.ok) throw new Error('Nicht autorisiert');
			drafts = await res.json();
		} catch (e) {
			error = 'Entwürfe konnten nicht geladen werden.';
		}
		loading = false;
	}

	async function handlePublish(draft: Draft) {
		publishing = draft.id;
		try {
			const ndk = getNdk();
			if (!ndk.signer) throw new Error('Nicht eingeloggt');

			const slug = draft.title
				.toLowerCase()
				.replace(/[äöüß]/g, (c: string) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')
				.slice(0, 60);
			const dTag = `${slug}-${Date.now().toString(36)}`;

			const event = new NDKEvent(ndk);
			event.kind = 30023;
			event.content = draft.content;
			event.tags = [
				['d', dTag],
				['title', draft.title],
				['summary', draft.summary],
				['published_at', String(Math.floor(Date.now() / 1000))]
			];
			if (draft.category) event.tags.push(['t', draft.category]);
			if (draft.sourceUrl) event.tags.push(['r', draft.sourceUrl]);

			await event.publish();

			// Draft aus der lokalen Liste löschen
			await fetch('/api/drafts', {
				method: 'DELETE',
				headers: { 'x-pubkey': userPubkey.value ?? '', 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: draft.id })
			});

			drafts = drafts.filter((d) => d.id !== draft.id);
		} catch (e) {
			error = 'Veröffentlichung fehlgeschlagen.';
		}
		publishing = null;
	}

	async function handleDelete(draft: Draft) {
		try {
			await fetch('/api/drafts', {
				method: 'DELETE',
				headers: { 'x-pubkey': userPubkey.value ?? '', 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: draft.id })
			});
			drafts = drafts.filter((d) => d.id !== draft.id);
		} catch (e) {
			error = 'Löschen fehlgeschlagen.';
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('de-DE', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(loadDrafts);
</script>

<svelte:head>
	<title>Redaktion — BitcoinCafé</title>
</svelte:head>

{#if !userPubkey.value}
	<div class="py-20 text-center">
		<p class="text-lg text-text-secondary">Bitte einloggen um die Redaktion zu nutzen.</p>
	</div>
{:else if !isBarista}
	<div class="py-20 text-center">
		<p class="text-lg text-text-secondary">Zugriff nur für den Barista.</p>
		<p class="mt-2 text-sm text-text-secondary/60">Logge dich mit dem Barista-Key ein.</p>
	</div>
{:else}
	<div class="menu-page mb-8 flex flex-col gap-6 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-8">
		<div>
			<p class="menu-kicker mb-3">Barista-Konsole</p>
			<h1 class="neon-text text-4xl font-semibold">Redaktion</h1>
			<p class="mt-2 text-sm text-text-secondary">Prüfen · abschmecken · servieren</p>
		</div>
		<button
			onclick={runPipeline}
			disabled={pipelineRunning}
			class="border border-accent bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-black disabled:opacity-50"
		>
			{pipelineRunning ? '☕ Brüht...' : '☕ Neue Entwürfe'}
		</button>
	</div>

	{#if pipelineResult}
		<div class="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
			{pipelineResult}
		</div>
	{/if}

	{#if error}
		<div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="py-12 text-center">
			<div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
			<p class="mt-3 text-sm text-text-secondary">Entwürfe laden...</p>
		</div>
	{:else if drafts.length === 0}
		<div class="rounded-xl border border-border bg-bg-card py-12 text-center">
			<p class="text-4xl">☕</p>
			<p class="mt-3 text-text-secondary">Keine Entwürfe in der Queue.</p>
			<p class="mt-1 text-sm text-text-secondary/60">Starte die Content-Pipeline um neue Entwürfe zu generieren.</p>
		</div>
	{:else}
		<div class="menu-page px-5 sm:px-8">
			{#each drafts as draft (draft.id)}
				<article class="border-b border-dashed border-border py-6 last:border-0">
					<div class="mb-2 flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<h3 class="text-base font-semibold leading-snug">{draft.title}</h3>
							<div class="mt-1 flex items-center gap-2 text-xs text-text-secondary">
								{#if draft.category}
									<span class="rounded-full bg-accent/20 px-2 py-0.5 text-accent">{draft.category}</span>
								{/if}
								<span>{formatDate(draft.createdAt)}</span>
								{#if draft.sourceUrl}
									<a href={draft.sourceUrl} target="_blank" rel="noopener" class="text-accent hover:underline">Quelle</a>
								{/if}
							</div>
						</div>
					</div>

					<p class="mb-3 text-sm text-text-secondary">{draft.summary}</p>

					<details class="mb-3">
						<summary class="cursor-pointer text-xs text-text-secondary hover:text-text-primary">Volltext anzeigen</summary>
						<div class="mt-2 max-h-60 overflow-y-auto rounded-lg bg-bg-primary p-3 text-sm whitespace-pre-wrap">
							{draft.content}
						</div>
					</details>

					<div class="flex gap-2">
						<button
							onclick={() => handlePublish(draft)}
							disabled={publishing === draft.id}
							class="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
						>
							{publishing === draft.id ? 'Veröffentlichen...' : 'Freigeben'}
						</button>
						<button
							onclick={() => handleDelete(draft)}
							class="rounded-lg border border-red-500/30 px-4 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
						>
							Löschen
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}
{/if}
