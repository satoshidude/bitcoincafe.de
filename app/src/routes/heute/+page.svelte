<script lang="ts">
	import ArticleCard from '$lib/components/ArticleCard.svelte';
	import { fetchTodayArticles, type Article } from '$lib/nostr/articles';
	import { onMount } from 'svelte';

	let articles = $state<Article[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			articles = await fetchTodayArticles();
		} catch (e) {
			console.error('Fetch today articles error:', e);
		} finally {
			loading = false;
		}
	});

	const today = new Date().toLocaleDateString('de-DE', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
</script>

<svelte:head>
	<title>Tagesbrief — BitcoinCafé.de</title>
</svelte:head>

<section class="menu-page px-6 py-8 sm:px-10">
	<p class="menu-kicker mb-3">Tageskarte</p>
	<h1 class="neon-text mb-2 text-4xl font-semibold">Tagesbrief</h1>
	<p class="mb-8 font-sans text-xs uppercase tracking-wider text-text-secondary">{today}</p>

	{#if loading}
		<div class="flex flex-col items-center gap-3 py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
			<p class="text-sm text-text-secondary">Lade heutige Artikel...</p>
		</div>
	{:else if articles.length === 0}
		<div class="rounded-xl border border-border bg-bg-card p-6 text-center">
			<p class="mb-2 text-lg">Heute noch keine Artikel</p>
			<p class="text-sm text-text-secondary">
				Der Barista brüht noch... Schau später nochmal vorbei.
			</p>
		</div>
	{:else}
		<div>
			{#each articles as article}
				<ArticleCard
					title={article.title}
					summary={article.summary}
					category={article.category}
					publishedAt={article.publishedAt}
					naddr={article.naddr}
					image={article.image}
					likeCount={article.likeCount}
					commentCount={article.commentCount}
					zapCount={article.zapCount}
					zapTotal={article.zapTotal}
					eventId={article.id}
					authorPubkey={article.author}
				/>
			{/each}
		</div>
	{/if}
</section>
