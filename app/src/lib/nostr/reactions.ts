import { getNdk } from './ndk';
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';

/** Like-Count für ein Event laden (Kind 7 Reactions mit "+") */
export async function fetchLikeCount(eventId: string): Promise<number> {
	const ndk = getNdk();
	const filter: NDKFilter = {
		kinds: [7 as number],
		'#e': [eventId],
		limit: 500
	};

	const events = await ndk.fetchEvents(filter);
	let count = 0;
	for (const e of events) {
		if (e.content === '+' || e.content === '') count++;
	}
	return count;
}

/** Prüfe ob der aktuelle User bereits geliked hat */
export async function hasLiked(eventId: string, userPubkey: string): Promise<boolean> {
	const ndk = getNdk();
	const events = await ndk.fetchEvents({
		kinds: [7 as number],
		'#e': [eventId],
		authors: [userPubkey],
		limit: 1
	});
	return events.size > 0;
}

/** Like/Reaction posten (Kind 7) */
export async function postLike(eventId: string, authorPubkey: string): Promise<void> {
	const ndk = getNdk();
	if (!ndk.signer) throw new Error('Nicht eingeloggt');

	const event = new NDKEvent(ndk);
	event.kind = 7;
	event.content = '+';
	event.tags = [
		['e', eventId],
		['p', authorPubkey]
	];

	await event.publish();
}
