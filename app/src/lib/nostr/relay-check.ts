/**
 * Prüft auf welchen Relays ein Event verfügbar ist
 */

const PUBLIC_RELAYS = [
	'wss://relay.bitcoincafe.de',
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://purplepag.es',
	'wss://relay.nsnip.io',
	'wss://relay.nostr.band'
];

export interface RelayStatus {
	url: string;
	found: boolean;
}

export async function checkEventOnRelays(eventId: string): Promise<RelayStatus[]> {
	const results: RelayStatus[] = [];

	const checks = PUBLIC_RELAYS.map(async (url) => {
		try {
			const ws = new WebSocket(url);
			const found = await new Promise<boolean>((resolve) => {
				const timeout = setTimeout(() => { ws.close(); resolve(false); }, 5000);

				ws.onopen = () => {
					const subId = Math.random().toString(36).slice(2, 8);
					ws.send(JSON.stringify(['REQ', subId, { ids: [eventId], limit: 1 }]));
				};

				ws.onmessage = (msg) => {
					try {
						const data = JSON.parse(msg.data);
						if (data[0] === 'EVENT') {
							clearTimeout(timeout);
							ws.close();
							resolve(true);
						} else if (data[0] === 'EOSE') {
							clearTimeout(timeout);
							ws.close();
							resolve(false);
						}
					} catch {}
				};

				ws.onerror = () => { clearTimeout(timeout); resolve(false); };
			});

			results.push({ url, found });
		} catch {
			results.push({ url, found: false });
		}
	});

	await Promise.all(checks);
	return results.sort((a, b) => a.url.localeCompare(b.url));
}
