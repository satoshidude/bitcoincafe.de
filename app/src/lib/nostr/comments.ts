import { getNdk, getProfileNdk } from './ndk';
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';

export interface Comment {
	id: string;
	content: string;
	pubkey: string;
	authorName: string;
	authorPicture: string;
	createdAt: string;
}

/** Kommentare zu einem Artikel laden (Kind 1, referenziert via e-Tag) */
export async function fetchComments(eventId: string): Promise<Comment[]> {
	const ndk = getNdk();
	const filter: NDKFilter = {
		kinds: [1],
		'#e': [eventId],
		limit: 100
	};

	const events = await ndk.fetchEvents(filter);
	const comments: Comment[] = [];
	const profileNdk = getProfileNdk();

	for (const event of events) {
		let authorName = event.pubkey.slice(0, 12) + '...';
		let authorPicture = '';

		try {
			const user = profileNdk.getUser({ pubkey: event.pubkey });
			await user.fetchProfile();
			if (user.profile) {
				authorName = user.profile.name ?? user.profile.displayName ?? authorName;
				authorPicture = user.profile.image ?? '';
			}
		} catch { /* fallback */ }

		comments.push({
			id: event.id,
			content: event.content,
			pubkey: event.pubkey,
			authorName,
			authorPicture,
			createdAt: new Date((event.created_at ?? 0) * 1000).toISOString()
		});
	}

	comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	return comments;
}

/** Kommentar zu einem Artikel posten */
export async function postComment(eventId: string, authorPubkey: string, content: string): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const event = new NDKEvent(ndk);
	event.kind = 1;
	event.content = content;
	event.tags = [
		['e', eventId, 'wss://relay.bitcoincafe.de', 'root'],
		['p', authorPubkey]
	];

	await event.publish();
}
