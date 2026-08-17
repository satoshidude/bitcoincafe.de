<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import { fetchArticles, PINNED_ARTICLE_DTAGS, type Article } from '$lib/nostr/articles';
	import { onMount } from 'svelte';

	let articles = $state<Article[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			articles = await fetchArticles(20);
		} catch (e) {
			error = 'Verbindung zum Relay fehlgeschlagen';
			console.error('Fetch articles error:', e);
		} finally {
			loading = false;
		}
	});

	function getGreeting(): string {
		const hour = new Date().getHours();
		if (hour < 12) return 'Guten Morgen';
		if (hour < 18) return 'Guten Tag';
		return 'Guten Abend';
	}
</script>

<svelte:head>
	<title>BitcoinCafé.de — Bitcoin-News für den DACH-Raum</title>
</svelte:head>

<section class="menu-page mb-8 overflow-hidden px-6 py-8 sm:px-10 sm:py-12">
	<p class="menu-kicker mb-4">Hauskarte · täglich frisch</p>
	<h1 class="neon-text mb-3 text-4xl font-semibold sm:text-6xl">{getGreeting()}.</h1>
	<p class="max-w-xl text-base leading-relaxed text-text-secondary">Bitcoin-News, handverlesen im Café und offen serviert über Nostr.</p>
</section>

{#if loading}
	<div class="flex flex-col items-center gap-3 py-12">
		<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
		<p class="text-sm text-text-secondary">Lade Artikel vom Relay...</p>
	</div>
{:else if error}
	<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-400">
		{error}
	</div>
{:else if articles.length === 0}
	<div class="rounded-xl border border-border bg-bg-card p-6 text-center">
		<p class="mb-2 text-lg">Noch keine Artikel</p>
		<p class="text-sm text-text-secondary">
			Der Barista brüht noch... Bald gibt es hier frische Bitcoin-News vom Relay.
		</p>
	</div>
{:else}
	<section>
		<div class="mb-2 flex items-end justify-between border-b border-border pb-3">
			<div><p class="menu-kicker mb-2">Auf der Karte</p><h2 class="text-2xl">Heute empfohlen</h2></div>
			<span class="font-sans text-xs text-text-secondary">{articles.length} Artikel</span>
		</div>
		{#each articles as article}
			<ArticleCard
				title={article.title}
				summary={article.summary}
				category={article.category}
				publishedAt={article.publishedAt}
				naddr={article.naddr}
				image={article.image}
				pinned={PINNED_ARTICLE_DTAGS.some((d) => article.naddr.endsWith(':' + d))}
				likeCount={article.likeCount}
				commentCount={article.commentCount}
				zapCount={article.zapCount}
				zapTotal={article.zapTotal}
				eventId={article.id}
				authorPubkey={article.author}
			/>
		{/each}
	</section>
{/if}
