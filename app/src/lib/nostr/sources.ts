import { getNdk, BARISTA_PUBKEY } from './ndk';
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';

/**
 * RSS-Quellen werden als Kind 30078 (App-spezifische Daten) auf dem Relay gespeichert.
 * d-Tag = "bitcoincafe:source:<url-hash>"
 * Content = JSON { url, name, category, active }
 */

export interface RssSource {
	id: string;
	url: string;
	name: string;
	category: string;
	active: boolean;
	addedAt: string;
	addedBy: string;
	dTag: string;
	format: string;
}

function sourceDTag(url: string): string {
	// Simple hash from URL for d-tag
	let hash = 0;
	for (let i = 0; i < url.length; i++) {
		hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
	}
	return `bitcoincafe:source:${Math.abs(hash).toString(36)}`;
}

/** Alle RSS-Quellen vom Relay laden */
export async function fetchSources(): Promise<RssSource[]> {
	const ndk = getNdk();

	// Fetch all 30078 events, filter for source d-tags client-side
	const events = await ndk.fetchEvents({
		kinds: [30078 as number],
		'#t': ['bitcoincafe-source'],
		limit: 200
	});

	const sources: RssSource[] = [];
	for (const event of events) {
		const dTag = event.tagValue('d') ?? '';
		if (!dTag.startsWith('bitcoincafe:source:')) continue;

		try {
			const data = JSON.parse(event.content);
			sources.push({
				id: event.id,
				url: data.url,
				name: data.name,
				category: data.category ?? '',
				active: data.active !== false,
				addedAt: new Date((event.created_at ?? 0) * 1000).toISOString(),
				addedBy: event.pubkey,
				dTag,
				format: data.format ?? inferSourceFormat(data.url)
			});
		} catch {
			// Skip malformed events
		}
	}

	sources.sort((a, b) => a.name.localeCompare(b.name));
	return sources;
}

/** Neue RSS-Quelle auf dem Relay speichern */
export async function addSource(url: string, name: string, category: string, format = inferSourceFormat(url)): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const dTag = sourceDTag(url);
	const event = new NDKEvent(ndk);
	event.kind = 30078;
	event.content = JSON.stringify({ url, name, category, format, active: true });
	event.tags = [
		['d', dTag],
		['t', 'bitcoincafe-source']
	];

	await event.publish();
}

/** RSS-Quelle deaktivieren/aktivieren (überschreibt Event mit gleicher d-tag) */
export async function toggleSource(source: RssSource): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const event = new NDKEvent(ndk);
	event.kind = 30078;
	event.content = JSON.stringify({
		url: source.url,
		name: source.name,
		category: source.category,
		format: source.format,
		active: !source.active
	});
	event.tags = [
		['d', source.dTag],
		['t', 'bitcoincafe-source']
	];

	await event.publish();
}

export function inferSourceFormat(url: string): string {
	if (url.includes('youtube.com/feeds/')) return 'youtube';
	if (/podcast|podhome|audiorella|\.mp3/i.test(url)) return 'podcast';
	return 'blog';
}

/** RSS-Quelle löschen (Kind 5 delete event) */
export async function deleteSource(source: RssSource): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const event = new NDKEvent(ndk);
	event.kind = 5;
	event.tags = [
		['e', source.id],
		['a', `30078:${source.addedBy}:${source.dTag}`]
	];

	await event.publish();
}
