import NDK from '@nostr-dev-kit/ndk';

/** Content-Relay — hier kommen Artikel und Notes her */
export const RELAYS = [
	'wss://relay.bitcoincafe.de'
];

/** Zusätzliche Relays nur für Profil-Lookups */
export const PROFILE_RELAYS = [
	'wss://relay.bitcoincafe.de',
	'wss://relay.damus.io',
	'wss://purplepag.es',
	'wss://nos.lol'
];

export const BARISTA_PUBKEY = '2a6bba74d25ee8f0b42681d0e0559c84cde6b4f7b5af88c9eab98552529d80ae';

let ndkInstance: NDK | null = null;
let profileNdkInstance: NDK | null = null;

/** Haupt-NDK — nur bitcoincafe relay für Content */
export function getNdk(): NDK {
	if (!ndkInstance) {
		ndkInstance = new NDK({
			explicitRelayUrls: RELAYS
		});
	}
	return ndkInstance;
}

/** Profil-NDK — mehrere Relays für User-Profile */
export function getProfileNdk(): NDK {
	if (!profileNdkInstance) {
		profileNdkInstance = new NDK({
			explicitRelayUrls: PROFILE_RELAYS
		});
	}
	return profileNdkInstance;
}

export async function connectNdk(): Promise<NDK> {
	const ndk = getNdk();
	const profileNdk = getProfileNdk();
	await Promise.all([ndk.connect(), profileNdk.connect()]);
	return ndk;
}
