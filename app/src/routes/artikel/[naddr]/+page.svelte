<script lang="ts">
	import { page } from '$app/state';
	import { fetchArticleByNaddr, type Article } from '$lib/nostr/articles';
	import { BARISTA_PUBKEY } from '$lib/nostr/ndk';
	import { fetchZapTotal } from '$lib/nostr/zaps';
	import { fetchComments, postComment, type Comment } from '$lib/nostr/comments';
	import { fetchLikeCount, hasLiked, postLike } from '$lib/nostr/reactions';
	import { userPubkey } from '$lib/stores/user.svelte';
	import ZapButton from '$lib/components/ZapButton.svelte';
	import { onMount } from 'svelte';

	let article = $state<Article | null>(null);
	let loading = $state(true);
	let notFound = $state(false);
	let zapTotal = $state(0);
	let likeCount = $state(0);
	let liked = $state(false);
	let liking = $state(false);
	let comments = $state<Comment[]>([]);
	let commentCount = $state(0);
	let newComment = $state('');
	let posting = $state(false);
	let commentError = $state('');
	let shared = $state(false);

	onMount(async () => {
		const naddr = page.params.naddr;
		if (!naddr) {
			notFound = true;
			loading = false;
			return;
		}
		try {
			article = await fetchArticleByNaddr(decodeURIComponent(naddr));
			if (!article) notFound = true;
			else {
				const [zaps, cmts, likes] = await Promise.all([
					fetchZapTotal(article.id, article.naddr),
					fetchComments(article.id),
					fetchLikeCount(article.id)
				]);
				zapTotal = zaps;
				comments = cmts;
				commentCount = cmts.length;
				likeCount = likes;
				if (userPubkey.value) {
					liked = await hasLiked(article.id, userPubkey.value);
				}
			}
		} catch (e) {
			console.error('Fetch article error:', e);
			notFound = true;
		} finally {
			loading = false;
		}
	});

	async function handleLike() {
		if (!article || !userPubkey.value || liked || liking) return;
		liking = true;
		try {
			await postLike(article.id, article.author);
			liked = true;
			likeCount++;
		} catch { /* silent */ }
		liking = false;
	}

	async function handleShare() {
		if (!article) return;
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ title: article.title, url });
				shared = true;
			} catch { /* cancelled */ }
		} else {
			await navigator.clipboard.writeText(url);
			shared = true;
			setTimeout(() => (shared = false), 2000);
		}
	}

	async function handlePostComment() {
		if (!newComment.trim() || !article) return;
		posting = true;
		commentError = '';
		try {
			await postComment(article.id, article.author, newComment.trim());
			newComment = '';
			comments = await fetchComments(article.id);
			commentCount = comments.length;
		} catch (e) {
			commentError = 'Kommentar konnte nicht gepostet werden.';
		}
		posting = false;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
	}

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

	function isBarista(pubkey: string): boolean {
		return pubkey === BARISTA_PUBKEY;
	}

	function renderMarkdown(md: string): string {
		return md
			.split('\n\n')
			.map((block) => {
				block = block.trim();
				if (!block) return '';
				if (block.startsWith('### ')) return `<h3 class="mt-6 mb-2 text-lg font-semibold">${esc(block.slice(4))}</h3>`;
				if (block.startsWith('## ')) return `<h2 class="mt-6 mb-2 text-xl font-semibold">${esc(block.slice(3))}</h2>`;
				if (block.startsWith('# ')) return `<h1 class="mt-6 mb-2 text-2xl font-bold">${esc(block.slice(2))}</h1>`;
				if (block.match(/^[-*] /m)) {
					const items = block.split('\n').map((line) => `<li>${inline(line.replace(/^[-*] /, ''))}</li>`);
					return `<ul class="my-3 ml-4 list-disc space-y-1">${items.join('')}</ul>`;
				}
				return `<p class="my-3 leading-relaxed">${inline(block)}</p>`;
			})
			.join('');
	}

	function esc(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function inline(s: string): string {
		return esc(s)
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.+?)\*/g, '<em>$1</em>')
			.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-accent underline" target="_blank" rel="noopener">$1</a>')
			.replace(/\n/g, '<br>');
	}
</script>

<svelte:head>
	<title>{article?.title ?? 'Artikel'} — BitcoinCafé.de</title>
</svelte:head>

{#if loading}
	<div class="flex flex-col items-center gap-3 py-12">
		<div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
		<p class="text-sm text-text-secondary">Lade Artikel...</p>
	</div>
{:else if notFound}
	<div class="py-12 text-center">
		<p class="mb-2 text-lg font-semibold">Artikel nicht gefunden</p>
		<p class="mb-4 text-sm text-text-secondary">Dieser Artikel existiert nicht oder ist nicht mehr verfügbar.</p>
		<a href="/" class="text-accent underline">Zurück zur Startseite</a>
	</div>
{:else if article}
	<article class="pb-4">
		<a href="/" class="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent">
			&larr; Zurück
		</a>

		{#if article.image}
			<img src={article.image} alt="" class="mb-4 w-full rounded-xl object-cover" />
		{/if}

		<div class="mb-3 flex items-center gap-2 text-xs text-text-secondary">
			{#if article.category}
				<span class="rounded-full bg-accent/20 px-2 py-0.5 text-accent">{article.category}</span>
			{/if}
			<span>{formatDate(article.publishedAt)}</span>
			{#if isBarista(article.author)}
				<span class="rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-400">Barista</span>
			{/if}
		</div>

		<h1 class="mb-4 text-2xl font-bold leading-tight">{article.title}</h1>

		{#if article.summary}
			<p class="mb-6 text-base text-text-secondary">{article.summary}</p>
		{/if}

		<div class="prose-dark text-sm leading-relaxed text-text-primary">
			{@html renderMarkdown(article.content)}
		</div>
	</article>

	<!-- Statusleiste -->
	<div class="flex items-center gap-1 border-t border-b border-border py-2 text-xs">
		<!-- Like -->
		<button
			onclick={handleLike}
			disabled={liking || !userPubkey.value}
			class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition-colors {liked ? 'text-red-400' : 'text-text-secondary hover:bg-bg-card hover:text-red-400'} disabled:opacity-50"
			title={userPubkey.value ? (liked ? 'Gefällt dir' : 'Gefällt mir') : 'Anmelden um zu liken'}
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="{liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
			{#if likeCount > 0}<span>{likeCount}</span>{/if}
		</button>

		<!-- Kommentare -->
		<a href="#kommentare" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
			{#if commentCount > 0}<span>{commentCount}</span>{/if}
		</a>

		<!-- Share -->
		<button
			onclick={handleShare}
			class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary"
			title="Teilen"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
			{shared ? 'Kopiert!' : 'Teilen'}
		</button>

		<!-- Zap -->
		<div class="ml-auto flex items-center gap-1">
			<ZapButton
				eventId={article.id}
				authorPubkey={article.author}
				lightningAddress="bitcoincafe@nsnip.io"
				onZapped={async () => { zapTotal = await fetchZapTotal(article!.id, article!.naddr); }}
			/>
			{#if zapTotal > 0}
				<span class="text-accent">{zapTotal.toLocaleString('de-DE')}</span>
			{/if}
		</div>
	</div>

	<!-- Kommentare -->
	<section id="kommentare" class="mt-6">
		<h2 class="mb-4 text-lg font-semibold">Kommentare</h2>

		{#if userPubkey.value}
			<div class="mb-6">
				<textarea
					bind:value={newComment}
					placeholder="Schreib einen Kommentar..."
					rows="3"
					class="w-full rounded-lg border border-border bg-bg-card px-3 py-2 text-sm focus:border-accent focus:outline-none"
				></textarea>
				{#if commentError}
					<p class="mt-1 text-xs text-red-400">{commentError}</p>
				{/if}
				<button
					onclick={handlePostComment}
					disabled={posting || !newComment.trim()}
					class="mt-2 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-accent/80 disabled:opacity-50"
				>
					{posting ? 'Posten...' : 'Kommentar posten'}
				</button>
			</div>
		{:else}
			<div class="mb-6 rounded-lg border border-border bg-bg-card p-4 text-center text-sm text-text-secondary">
				<a href="/profil" class="text-accent hover:underline">Anmelden</a> um zu kommentieren.
			</div>
		{/if}

		{#if comments.length === 0}
			<p class="text-sm text-text-secondary">Noch keine Kommentare. Sei der Erste!</p>
		{:else}
			<div class="flex flex-col gap-4">
				{#each comments as comment (comment.id)}
					<div class="rounded-lg border border-border bg-bg-card p-3">
						<div class="mb-2 flex items-center gap-2">
							{#if comment.authorPicture}
								<img src={comment.authorPicture} alt="" class="h-6 w-6 rounded-full object-cover" />
							{:else}
								<div class="h-6 w-6 rounded-full bg-accent/20"></div>
							{/if}
							<span class="text-sm font-medium">{comment.authorName}</span>
							{#if comment.pubkey === BARISTA_PUBKEY}
								<span class="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400">Barista</span>
							{/if}
							<span class="ml-auto text-xs text-text-secondary">{timeAgo(comment.createdAt)}</span>
						</div>
						<p class="text-sm leading-relaxed">{comment.content}</p>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}
