import { getNdk, BARISTA_PUBKEY } from './ndk';
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';
import type { Article } from './articles';

/**
 * Entwürfe sind NIP-23 Events (Kind 30023) mit einem extra Tag ["draft", "true"].
 * Nur der Barista sieht sie in der Redaktion.
 * Freigabe = neues Event ohne draft-Tag publishen (gleiche d-tag → überschreibt).
 */

export interface Draft extends Article {
	sourceUrl: string;
	isDraft: true;
}

function eventToDraft(event: NDKEvent): Draft {
	const title = event.tagValue('title') ?? 'Ohne Titel';
	const summary = event.tagValue('summary') ?? event.content.slice(0, 200);
	const image = event.tagValue('image') ?? '';
	const dTag = event.tagValue('d') ?? '';
	const sourceUrl = event.tagValue('r') ?? '';
	const publishedAt = event.tagValue('published_at')
		? new Date(Number(event.tagValue('published_at')) * 1000).toISOString()
		: new Date((event.created_at ?? 0) * 1000).toISOString();

	const tTags = event.tags.filter((t) => t[0] === 't');
	const category = tTags.find((t) => t[1] !== 'bitcoincafe-draft')?.[1] ?? '';
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
		zapTotal: 0,
		sourceUrl,
		isDraft: true
	};
}

/** Alle Entwürfe vom Relay laden (nur Barista-Events mit draft-Tag) */
export async function fetchDrafts(): Promise<Draft[]> {
	const ndk = getNdk();
	const filter: NDKFilter = {
		kinds: [30023 as number],
		authors: [BARISTA_PUBKEY],
		'#t': ['bitcoincafe-draft'],
		limit: 100
	};

	const events = await ndk.fetchEvents(filter);
	const drafts = Array.from(events).map(eventToDraft);
	drafts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
	return drafts;
}

/** Entwurf freigeben — neues Event ohne draft-Tag publishen */
export async function publishDraft(draft: Draft): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const dTag = draft.naddr.split(':').slice(2).join(':');

	const event = new NDKEvent(ndk);
	event.kind = 30023;
	event.content = draft.content;
	event.tags = [
		['d', dTag],
		['title', draft.title],
		['summary', draft.summary],
		['published_at', String(Math.floor(Date.now() / 1000))]
	];

	if (draft.image) event.tags.push(['image', draft.image]);
	if (draft.category) event.tags.push(['t', draft.category]);
	if (draft.sourceUrl) event.tags.push(['r', draft.sourceUrl]);

	await event.publish();
}

/** Entwurf mit bearbeitetem Inhalt aktualisieren (bleibt Draft) */
export async function updateDraft(draft: Draft, updates: { title?: string; summary?: string; content?: string; category?: string }): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const dTag = draft.naddr.split(':').slice(2).join(':');

	const event = new NDKEvent(ndk);
	event.kind = 30023;
	event.content = updates.content ?? draft.content;
	event.tags = [
		['d', dTag],
		['title', updates.title ?? draft.title],
		['summary', updates.summary ?? draft.summary],
		['published_at', String(Math.floor(new Date(draft.publishedAt).getTime() / 1000))],
		['t', 'bitcoincafe-draft']
	];

	if (draft.image) event.tags.push(['image', draft.image]);
	const cat = updates.category ?? draft.category;
	if (cat) event.tags.push(['t', cat]);
	if (draft.sourceUrl) event.tags.push(['r', draft.sourceUrl]);

	await event.publish();
}

/** Entwurf löschen (Kind 5 delete event) */
export async function deleteDraft(draft: Draft): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const dTag = draft.naddr.split(':').slice(2).join(':');

	const event = new NDKEvent(ndk);
	event.kind = 5;
	event.tags = [
		['e', draft.id],
		['a', `30023:${draft.author}:${dTag}`]
	];

	await event.publish();
}

/** Neuen Entwurf erstellen (manuell oder via Content-Pipeline) */
export async function createDraft(data: {
	title: string;
	summary: string;
	content: string;
	category?: string;
	image?: string;
	sourceUrl?: string;
}): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	// Unique d-tag from title + timestamp
	const slug = data.title
		.toLowerCase()
		.replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
	const dTag = `${slug}-${Date.now().toString(36)}`;

	const event = new NDKEvent(ndk);
	event.kind = 30023;
	event.content = data.content;
	event.tags = [
		['d', dTag],
		['title', data.title],
		['summary', data.summary],
		['published_at', String(Math.floor(Date.now() / 1000))],
		['t', 'bitcoincafe-draft']
	];

	if (data.image) event.tags.push(['image', data.image]);
	if (data.category) event.tags.push(['t', data.category]);
	if (data.sourceUrl) event.tags.push(['r', data.sourceUrl]);

	await event.publish();
}
