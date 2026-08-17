import { getNdk, getProfileNdk, BARISTA_PUBKEY } from './ndk';
import type { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { getZapReceiptAmount } from './zaps';

export interface Article {
	id: string;
	title: string;
	summary: string;
	content: string;
	category: string;
	publishedAt: string;
	image: string;
	naddr: string;
	author: string;
	likeCount: number;
	commentCount: number;
	zapCount: number;
	zapTotal: number;
}

export interface ShortNote {
	id: string;
	content: string;
	pubkey: string;
	authorName: string;
	authorPicture: string;
	createdAt: string;
}

function eventToArticle(event: NDKEvent): Article {
	const title = event.tagValue('title') ?? 'Ohne Titel';
	const summary = event.tagValue('summary') ?? event.content.slice(0, 200);
	const image = event.tagValue('image') ?? '';
	const dTag = event.tagValue('d') ?? '';
	const publishedAt = event.tagValue('published_at')
		? new Date(Number(event.tagValue('published_at')) * 1000).toISOString()
		: new Date((event.created_at ?? 0) * 1000).toISOString();

	// Category from 't' tag (skip internal tags like 'bitcoincafe-draft')
	const tTags = event.tags.filter((t) => t[0] === 't' && !t[1].startsWith('bitcoincafe-'));
	const category = tTags.length > 0 ? tTags[0][1] : '';

	// Build naddr-like identifier
	const naddr = `${event.kind}:${event.pubkey}:${dTag}`;

	return {
		id: event.id,
		title,
		summary,
		content: event.content,
		category,
		publishedAt,
		image,
		naddr,
		author: event.pubkey,
		likeCount: 0,
		commentCount: 0,
		zapCount: 0,
		zapTotal: 0
	};
}

export const PINNED_ARTICLE_DTAGS = ['willkommen-im-bitcoincafe'];

function isDraft(event: NDKEvent): boolean {
	return event.tags.some((t) => t[0] === 't' && t[1] === 'bitcoincafe-draft');
}

/** Fetch NIP-23 long-form articles (kind 30023) from the relay — excludes drafts */
export async function fetchArticles(limit = 50): Promise<Article[]> {
	const ndk = getNdk();
	const filter: NDKFilter = {
		kinds: [30023 as number],
		limit
	};

	const events = await ndk.fetchEvents(filter);
	const articles = Array.from(events).filter((e) => !isDraft(e)).map(eventToArticle);

	// Batch-Load: Likes, Kommentare, Zaps für alle Artikel
	if (articles.length > 0) {
		const eventIds = articles.map((a) => a.id);
		try {
			const [reactions, comments, zaps] = await Promise.all([
				ndk.fetchEvents({ kinds: [7 as number], '#e': eventIds, limit: 1000 }),
				ndk.fetchEvents({ kinds: [1], '#e': eventIds, limit: 1000 }),
				ndk.fetchEvents({ kinds: [9735 as number], '#e': eventIds, limit: 500 })
			]);

			// Counts pro Artikel aggregieren
			for (const r of reactions) {
				if (r.content === '+' || r.content === '') {
					const eTag = r.tags.find((t) => t[0] === 'e')?.[1];
					const art = eTag ? articles.find((a) => a.id === eTag) : null;
					if (art) art.likeCount++;
				}
			}
			for (const c of comments) {
				const eTag = c.tags.find((t) => t[0] === 'e')?.[1];
				const art = eTag ? articles.find((a) => a.id === eTag) : null;
				if (art) art.commentCount++;
			}
			for (const z of zaps) {
				const eTag = z.tags.find((t) => t[0] === 'e')?.[1];
				const art = eTag ? articles.find((a) => a.id === eTag) : null;
				if (art) {
					art.zapCount++;
					art.zapTotal += getZapReceiptAmount(z.tags);
				}
			}
		} catch { /* counts bleiben 0 */ }
	}

	// Pinned articles first, then by publishedAt descending
	const PINNED_DTAGS = PINNED_ARTICLE_DTAGS;
	articles.sort((a, b) => {
		const aPinned = PINNED_DTAGS.some((d) => a.naddr.endsWith(':' + d));
		const bPinned = PINNED_DTAGS.some((d) => b.naddr.endsWith(':' + d));
		if (aPinned && !bPinned) return -1;
		if (!aPinned && bPinned) return 1;
		return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
	});
	return articles;
}

/** Fetch today's articles */
export async function fetchTodayArticles(): Promise<Article[]> {
	const ndk = getNdk();
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);

	const filter: NDKFilter = {
		kinds: [30023 as number],
		since: Math.floor(todayStart.getTime() / 1000),
		limit: 50
	};

	const events = await ndk.fetchEvents(filter);
	const articles = Array.from(events).filter((e) => !isDraft(e)).map(eventToArticle);
	articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
	return articles;
}

/** Fetch a single article by kind:pubkey:d-tag identifier */
export async function fetchArticleByNaddr(naddr: string): Promise<Article | null> {
	const parts = naddr.split(':');
	if (parts.length < 3) return null;

	const [kindStr, pubkey, ...dParts] = parts;
	const dTag = dParts.join(':');
	const kind = Number(kindStr);

	const ndk = getNdk();
	const filter: NDKFilter = {
		kinds: [kind as number],
		authors: [pubkey],
		'#d': [dTag],
		limit: 1
	};

	const events = await ndk.fetchEvents(filter);
	const event = Array.from(events)[0];
	if (!event) return null;
	return eventToArticle(event);
}

/** Fetch short text notes (kind 1) for the discussion feed */
export async function fetchNotes(limit = 50): Promise<ShortNote[]> {
	const ndk = getNdk();
	const filter: NDKFilter = {
		kinds: [1],
		limit
	};

	const events = await ndk.fetchEvents(filter);
	const notes: ShortNote[] = [];

	for (const event of events) {
		// Try to get author profile
		let authorName = event.pubkey.slice(0, 12) + '...';
		let authorPicture = '';

		try {
			const profileNdk = getProfileNdk();
			const user = profileNdk.getUser({ pubkey: event.pubkey });
			await user.fetchProfile();
			if (user.profile) {
				authorName = user.profile.name ?? user.profile.displayName ?? authorName;
				authorPicture = user.profile.image ?? '';
			}
		} catch {
			// Profile fetch failed, use defaults
		}

		notes.push({
			id: event.id,
			content: event.content,
			pubkey: event.pubkey,
			authorName,
			authorPicture,
			createdAt: new Date((event.created_at ?? 0) * 1000).toISOString()
		});
	}

	notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	return notes;
}

/** Fetch relay stats — count events by kind */
export async function fetchRelayStats(): Promise<{
	articles: number;
	notes: number;
	profiles: number;
	totalEvents: number;
}> {
	const ndk = getNdk();

	const [articles, notes, profiles] = await Promise.all([
		ndk.fetchEvents({ kinds: [30023 as number], limit: 500 }),
		ndk.fetchEvents({ kinds: [1], limit: 500 }),
		ndk.fetchEvents({ kinds: [0], limit: 500 })
	]);

	return {
		articles: articles.size,
		notes: notes.size,
		profiles: profiles.size,
		totalEvents: articles.size + notes.size + profiles.size
	};
}
