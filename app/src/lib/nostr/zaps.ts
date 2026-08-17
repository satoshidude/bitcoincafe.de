import { getNdk, getProfileNdk } from './ndk';
import type { NDKFilter } from '@nostr-dev-kit/ndk';

/**
 * NIP-57 Zap Integration
 * - Zap-Counts aus Kind 9735 (Zap Receipts) laden
 * - Zap-Request (Kind 9734) erstellen und Invoice holen
 */

/** Zap-Receipts für ein Event zählen und Sats summieren */
export async function fetchZapTotal(eventId: string, naddr?: string): Promise<number> {
	const ndk = getNdk();

	// Suche nach e-Tag (Event ID) und optional a-Tag (addressable reference)
	const filters: NDKFilter[] = [
		{ kinds: [9735 as number], '#e': [eventId], limit: 200 }
	];

	// Auch nach a-Tag suchen falls naddr vorhanden (überlebt Event-Updates)
	if (naddr) {
		const parts = naddr.split(':');
		if (parts.length >= 3) {
			const aTag = `${parts[0]}:${parts[1]}:${parts.slice(2).join(':')}`;
			filters.push({ kinds: [9735 as number], '#a': [aTag], limit: 200 });
		}
	}

	const allEvents = new Map();
	for (const f of filters) {
		const events = await ndk.fetchEvents(f);
		for (const e of events) allEvents.set(e.id, e);
	}
	const events = allEvents.values();
	let totalSats = 0;

	for (const receipt of events) {
		totalSats += getZapReceiptAmount(receipt.tags);
	}

	return totalSats;
}

/** Bolt11 Invoice Amount in Sats decodieren (einfacher Parser) */
export function decodeBolt11Amount(bolt11: string): number {
	const lower = bolt11.toLowerCase();
	// Format: lnbc<amount><multiplier>...
	const match = lower.match(/^lnbc(\d+)([munp]?)/);
	if (!match) return 0;

	const num = Number(match[1]);
	const mult = match[2];

	switch (mult) {
		case '': return num * 100000000; // BTC to sats
		case 'm': return num * 100000;   // mBTC to sats
		case 'u': return num * 100;      // μBTC to sats
		case 'n': return Math.floor(num / 10); // nBTC to sats
		case 'p': return Math.floor(num / 10000); // pBTC to sats
		default: return 0;
	}
}

/** Betrag eines NIP-57-Receipts in Sats; bevorzugt die signierte Invoice. */
export function getZapReceiptAmount(tags: string[][]): number {
	const bolt11 = tags.find((tag) => tag[0] === 'bolt11')?.[1];
	if (bolt11) return decodeBolt11Amount(bolt11);

	const description = tags.find((tag) => tag[0] === 'description')?.[1];
	if (!description) return 0;
	try {
		const request = JSON.parse(description);
		const amount = request.tags?.find((tag: string[]) => tag[0] === 'amount')?.[1];
		return amount ? Math.floor(Number(amount) / 1000) : 0;
	} catch {
		return 0;
	}
}

/** Lightning Address (LUD-16) auflösen → LNURL-pay Callback */
export async function resolveLightningAddress(address: string): Promise<{
	callback: string;
	minSendable: number;
	maxSendable: number;
	allowsNostr: boolean;
	nostrPubkey?: string;
} | null> {
	const [user, domain] = address.split('@');
	if (!user || !domain) return null;

	try {
		const res = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
		if (!res.ok) return null;
		const data = await res.json();
		return {
			callback: data.callback,
			minSendable: data.minSendable ?? 1000,
			maxSendable: data.maxSendable ?? 100000000000,
			allowsNostr: data.allowsNostr ?? false,
			nostrPubkey: data.nostrPubkey
		};
	} catch {
		return null;
	}
}

/** Zap-Invoice holen (für WebLN oder QR-Anzeige) */
export async function getZapInvoice(
	lightningAddress: string,
	amountSats: number,
	eventId: string,
	authorPubkey: string
): Promise<string | null> {
	// 1. Lightning Address auflösen
	const lnurl = await resolveLightningAddress(lightningAddress);
	if (!lnurl) return null;

	const amountMsats = amountSats * 1000;
	if (amountMsats < lnurl.minSendable || amountMsats > lnurl.maxSendable) return null;

	const separator = lnurl.callback.includes('?') ? '&' : '?';

	// Einfaches LNURL-pay — funktioniert immer
	try {
		const res = await fetch(`${lnurl.callback}${separator}amount=${amountMsats}`);
		if (!res.ok) return null;
		const data = await res.json();
		if (data.status === 'ERROR' || !data.pr) return null;
		return data.pr;
	} catch {
		return null;
	}
}

/** Zap bezahlen via WebLN (Alby etc.) */
export async function payWithWebLN(invoice: string): Promise<boolean> {
	if (typeof window === 'undefined' || !(window as any).webln) return false;

	try {
		await (window as any).webln.enable();
		await (window as any).webln.sendPayment(invoice);
		return true;
	} catch {
		return false;
	}
}
