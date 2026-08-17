#!/usr/bin/env node
/**
 * BitcoinCafé Auto-Publisher
 *
 * Veröffentlicht alle 2 Stunden den ältesten Entwurf.
 * Wenn keine Entwürfe vorhanden → Pipeline starten.
 *
 * Usage: node auto-publish.js
 */

import { finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { hexToBytes } from 'nostr-tools/utils';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

// Eigener Relay + öffentliche Relays für maximale Reichweite
const PUBLISH_RELAYS = [
	'wss://relay.bitcoincafe.de',
	'wss://relay.nsnip.io',
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.nostr.band',
	'wss://relay.snort.social',
	'wss://nostr.wine',
	'wss://relay.primal.net',
	'wss://purplepag.es'
];
const BARISTA_PRIVKEY = process.env.BARISTA_PRIVKEY;
const DRAFTS_FILE = process.env.DRAFTS_FILE || '/var/www/bitcoincafe-pipeline/data/drafts.json';

if (!BARISTA_PRIVKEY) { console.error('BARISTA_PRIVKEY nicht gesetzt'); process.exit(1); }

const privkeyBytes = hexToBytes(BARISTA_PRIVKEY);
const pool = new SimplePool();

function loadDrafts() {
	try { return JSON.parse(readFileSync(DRAFTS_FILE, 'utf-8')); }
	catch { return []; }
}

function saveDrafts(drafts) {
	writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2));
}

async function publishOldestDraft() {
	let drafts = loadDrafts();

	// Keine Entwürfe → Pipeline starten
	if (drafts.length === 0) {
		console.log('Keine Entwürfe vorhanden, starte Pipeline...');
		try {
			execSync(
				'source /var/www/bitcoincafe-app/.env && export LLM_API_KEY LLM_API_URL LLM_MODEL BARISTA_PRIVKEY && node /var/www/bitcoincafe-pipeline/fetch-and-draft.js',
				{ shell: '/bin/bash', timeout: 120000, stdio: 'inherit' }
			);
		} catch (e) {
			console.error('Pipeline fehlgeschlagen:', e.message);
			return;
		}
		drafts = loadDrafts();
		if (drafts.length === 0) {
			console.log('Immer noch keine Entwürfe nach Pipeline. Fertig.');
			return;
		}
	}

	// Ältesten Entwurf nehmen (erster in der Liste)
	const draft = drafts[0];
	console.log(`Veröffentliche: "${draft.title}"`);

	const slug = draft.title
		.toLowerCase()
		.replace(/[\u00e4]/g, 'ae').replace(/[\u00f6]/g, 'oe').replace(/[\u00fc]/g, 'ue').replace(/[\u00df]/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
	const dTag = `${slug}-${Date.now().toString(36)}`;

	const tags = [
		['d', dTag],
		['title', draft.title],
		['summary', draft.summary],
		['published_at', String(Math.floor(Date.now() / 1000))]
	];
	if (draft.category) tags.push(['t', draft.category]);
	if (draft.sourceUrl) tags.push(['r', draft.sourceUrl]);

	const event = finalizeEvent({
		kind: 30023,
		created_at: Math.floor(Date.now() / 1000),
		tags,
		content: draft.content
	}, privkeyBytes);

	if (!verifyEvent(event)) {
		console.error('Signatur ungültig!');
		return;
	}

	// Auf alle Relays publishen
	let published = 0;
	for (const relay of PUBLISH_RELAYS) {
		try {
			await Promise.any(pool.publish([relay], event));
			published++;
		} catch {}
	}

	if (published > 0) {
		console.log(`✓ Veröffentlicht: "${draft.title}" (${published}/${PUBLISH_RELAYS.length} Relays)`);
		drafts.shift();
		saveDrafts(drafts);
		console.log(`${drafts.length} Entwürfe verbleibend.`);
	} else {
		console.error('Publish fehlgeschlagen: kein Relay hat akzeptiert');
	}
}

async function main() {
	console.log(`\n☕ BitcoinCafé Auto-Publisher`);
	console.log(`   ${new Date().toLocaleString('de-DE')}\n`);

	await publishOldestDraft();

	pool.close(PUBLISH_RELAYS);
}

main().catch(e => { console.error('Fehler:', e); process.exit(1); });
