import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { getNdk, getProfileNdk } from './ndk';
import { userPubkey, userProfile } from '$lib/stores/user.svelte';

export async function loginWithExtension(): Promise<string | null> {
	if (typeof window === 'undefined' || !window.nostr) {
		return null;
	}

	const signer = new NDKNip07Signer();
	const ndk = getNdk();
	ndk.signer = signer;

	const user = await signer.user();
	userPubkey.value = user.pubkey;

	// Profil über Profil-Relays laden (dort liegen die kind:0 Events)
	const profileNdk = getProfileNdk();
	const profileUser = profileNdk.getUser({ pubkey: user.pubkey });
	await profileUser.fetchProfile();
	if (profileUser.profile) {
		userProfile.value = {
			name: profileUser.profile.name ?? profileUser.profile.displayName ?? '',
			picture: profileUser.profile.image ?? '',
			about: profileUser.profile.about ?? ''
		};
	}

	// Pubkey merken für auto-reconnect
	localStorage.setItem('bitcoincafe:pubkey', user.pubkey);

	return user.pubkey;
}

export function logout(): void {
	const ndk = getNdk();
	ndk.signer = undefined;
	userPubkey.value = null;
	userProfile.value = null;
	localStorage.removeItem('bitcoincafe:pubkey');
}

export function getSavedPubkey(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('bitcoincafe:pubkey');
}
