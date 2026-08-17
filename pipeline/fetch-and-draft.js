#!/usr/bin/env node
/**
 * BitcoinCafe Content-Pipeline
 *
 * 1. RSS-Quellen vom Relay laden (Kind 30078, bitcoincafe-source Tag)
 * 2. Neue Artikel aus RSS-Feeds fetchen
 * 3. Deutsche Zusammenfassungen über eine OpenAI-kompatible API generieren
 * 4. Als lokale Drafts speichern (JSON) — Freigabe über /redaktion
 *
 * Usage:
 *   node fetch-and-draft.js              # Normal run
 *   node fetch-and-draft.js --dry-run    # Nur fetchen + generieren, nicht publishen
 */

import { finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { hexToBytes } from 'nostr-tools/utils';
import WebSocket from 'ws';

// Polyfill WebSocket for Node.js
globalThis.WebSocket = WebSocket;

// --- Config ---
const RELAY_URL = 'wss://relay.bitcoincafe.de';
const BARISTA_PRIVKEY = process.env.BARISTA_PRIVKEY;
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_API_URL = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-5-mini';
const DRY_RUN = process.argv.includes('--dry-run');

if (!BARISTA_PRIVKEY) {
	console.error('BARISTA_PRIVKEY nicht gesetzt');
	process.exit(1);
}
if (!LLM_API_KEY) {
	console.error('LLM_API_KEY nicht gesetzt');
	process.exit(1);
}

const privkeyBytes = hexToBytes(BARISTA_PRIVKEY);
const pool = new SimplePool();

// Geprüfte Grundversorgung. Relay-Quellen werden zusätzlich geladen und können
// diesen Katalog erweitern, ohne dass die Pipeline bei einem leeren Relay stoppt.
const CURATED_SOURCES = [
	{ name: 'Blocktrainer', url: 'https://www.blocktrainer.de/feed.xml', category: 'markt', format: 'blog', language: 'de' },
	{ name: 'Nodesignal', url: 'https://nodesignal.space/feed/', category: 'technik', format: 'blog', language: 'de' },
	{ name: 'Bitcoin verstehen', url: 'https://cdn.audiorella.com/podcasts/1862-bitcoin-verstehen/feed.rss', category: 'kultur', format: 'podcast', language: 'de' },
	{ name: 'Einundzwanzig Podcast', url: 'https://serve.podhome.fm/rss/e8df0b13-47de-544a-99b7-ec7cbd960a16', category: 'kultur', format: 'podcast', language: 'de' },
	{ name: 'Bitcoin Optech', url: 'https://bitcoinops.org/feed.xml', category: 'technik', format: 'blog', language: 'en' },
	{ name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss/full/', category: 'markt', format: 'blog', language: 'en' },
	{ name: 'Jameson Lopp', url: 'https://blog.lopp.net/rss/', category: 'technik', format: 'blog', language: 'en' },
	{ name: 'Blocktrainer YouTube', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwk_JMd5LQAmjYRyhR9Rb0w', category: 'markt', format: 'youtube', language: 'de' },
	{ name: 'Bitcoin verstehen YouTube', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwdYYyyX9V3u_b6URNpBh_w', category: 'kultur', format: 'youtube', language: 'de' },
	{ name: 'Einundzwanzig YouTube', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCxSRxq14XIoMbFDEjMOPU5Q', category: 'kultur', format: 'youtube', language: 'de' },
	{ name: 'BTC Sessions YouTube', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrdO0NuQxk8uf1ST0MKVyCA', category: 'technik', format: 'youtube', language: 'en' }
];

// --- RSS Parsing (simple, no extra dependency) ---
async function fetchRssFeed(url) {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'BitcoinCafe-Pipeline/1.0' },
			signal: AbortSignal.timeout(15000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const xml = await res.text();
		return parseRssItems(xml, url);
	} catch (e) {
		console.warn(`  RSS fetch fehlgeschlagen für ${url}: ${e.message}`);
		return [];
	}
}

function parseRssItems(xml, feedUrl) {
	const items = [];
	// Match <item> or <entry> blocks
	const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
	let match;

	while ((match = itemRegex.exec(xml)) !== null) {
		const block = match[1];
		const title = extractTag(block, 'title');
		const link = extractLink(block);
		const description = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content:encoded') || '';
		const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || '';

		if (title && link) {
			items.push({
				title: decodeEntities(title),
				link,
				description: stripHtml(decodeEntities(description)).slice(0, 1000),
				pubDate: pubDate ? new Date(pubDate) : new Date(),
				feedUrl
			});
		}
	}

	return items;
}

function extractTag(block, tag) {
	// Handle CDATA
	const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
	const cdataMatch = block.match(cdataRegex);
	if (cdataMatch) return cdataMatch[1].trim();

	const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
	const m = block.match(regex);
	return m ? m[1].trim() : '';
}

function extractLink(block) {
	// Atom: <link href="..."/>
	const atomLink = block.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
	if (atomLink) return atomLink[1];
	// RSS: <link>...</link>
	return extractTag(block, 'link');
}

function stripHtml(html) {
	return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeEntities(str) {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&apos;/g, "'");
}

// --- Nostr: Quellen vom Relay laden ---
async function fetchSourcesFromRelay() {
	console.log('Lade RSS-Quellen vom Relay...');
	const events = await pool.querySync([RELAY_URL], {
		kinds: [30078],
		'#t': ['bitcoincafe-source'],
		limit: 200
	});

	const sources = [...CURATED_SOURCES];
	for (const event of events) {
		const dTag = event.tags.find(t => t[0] === 'd')?.[1] ?? '';
		if (!dTag.startsWith('bitcoincafe:source:')) continue;
		try {
			const data = JSON.parse(event.content);
			if (data.active !== false) {
				if (!sources.some(source => normalizeUrl(source.url) === normalizeUrl(data.url))) {
					sources.push({ url: data.url, name: data.name, category: data.category || '', format: data.format || 'blog', language: data.language || '' });
				}
			}
		} catch { /* skip */ }
	}

	console.log(`  ${sources.length} aktive Quellen gefunden`);
	return sources;
}

function normalizeUrl(url) {
	return String(url).trim().toLowerCase().replace(/\/+$/, '');
}

// --- Nostr: Bereits vorhandene Drafts/Artikel laden (Duplikat-Check) ---
async function fetchExistingUrls() {
	const events = await pool.querySync([RELAY_URL], {
		kinds: [30023],
		limit: 500
	});

	const urls = new Set();
	for (const event of events) {
		const rTag = event.tags.find(t => t[0] === 'r')?.[1];
		if (rTag) urls.add(rTag);
	}
	for (const draft of loadDrafts()) {
		if (draft.sourceUrl) urls.add(draft.sourceUrl);
	}

	console.log(`  ${urls.size} bereits verarbeitete URLs gefunden`);
	return urls;
}

// --- LLM: Zusammenfassung generieren ---
async function generateSummary(item, category) {
	const prompt = `Du bist der "Barista" von BitcoinCafe.de — eine deutschsprachige Bitcoin-Community für den DACH-Raum.

Erstelle aus dem folgenden Artikel eine deutsche Zusammenfassung für BitcoinCafe.de.

Regeln:
- Auf Deutsch schreiben
- Bitcoin-only Terminologie (niemals "Krypto" sagen)
- Sachlich, informativ, aber zugänglich — wie ein Barista der dir die Nachrichten erklärt
- DACH-Perspektive wo relevant
- Mindestens 3-4 Absätze, gut strukturiert mit Leerzeilen dazwischen
- Jeder Absatz sollte 2-3 Sätze haben
- Originalen Titel sinnvoll auf Deutsch übersetzen/anpassen (wenn nötig)
- Quell-Verweis am Ende als eigener Absatz

Artikeltitel: ${item.title}
Artikeltext: ${item.description}
Quelle: ${item.link}
${category ? `Kategorie: ${category}` : ''}

Antworte im folgenden JSON-Format (nur JSON, kein anderer Text):
{
  "title": "Deutscher Titel",
  "summary": "Kurze Zusammenfassung (1-2 Sätze für die Vorschau)",
  "content": "Erster Absatz mit Einleitung.\\n\\nZweiter Absatz mit Details.\\n\\nDritter Absatz mit Einordnung/DACH-Perspektive.\\n\\n---\\n\\n*Quelle: [Originalquelle](URL)*",
  "category": "markt|technik|regulierung|mining|kultur"
}`;

	try {
		const response = await fetch(LLM_API_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${LLM_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: LLM_MODEL,
				messages: [{ role: 'user', content: prompt }],
				response_format: { type: 'json_object' }
			}),
			signal: AbortSignal.timeout(60000)
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

		const data = await response.json();
		const text = data.choices?.[0]?.message?.content;
		if (!text) throw new Error('Leere Modellantwort');
		const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
		return JSON.parse(clean);
	} catch (e) {
		console.warn(`  LLM-Fehler für "${item.title}": ${e.message}`);
		return null;
	}
}

// --- Lokaler Draft-Speicher (JSON-Datei) ---
import { readFileSync, writeFileSync } from 'fs';

const DRAFTS_FILE = process.env.DRAFTS_FILE || '/var/www/bitcoincafe-pipeline/data/drafts.json';

function loadDrafts() {
	try { return JSON.parse(readFileSync(DRAFTS_FILE, 'utf-8')); }
	catch { return []; }
}

function saveDrafts(drafts) {
	writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2));
}

async function saveDraft(draft, sourceUrl) {
	const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

	if (DRY_RUN) {
		console.log(`  [DRY RUN] Würde speichern: "${draft.title}"`);
		return true;
	}

	const drafts = loadDrafts();
	drafts.push({
		id,
		title: draft.title,
		summary: draft.summary,
		content: draft.content,
		category: draft.category || '',
		sourceUrl: sourceUrl || '',
		createdAt: new Date().toISOString()
	});
	saveDrafts(drafts);
	console.log(`  ✓ Draft gespeichert: "${draft.title}"`);
	return true;
}

// --- Hauptprogramm ---
async function main() {
	console.log(`\n☕ BitcoinCafe Content-Pipeline${DRY_RUN ? ' (DRY RUN)' : ''}`);
	console.log(`   ${new Date().toLocaleString('de-DE')}\n`);

	// 1. Quellen laden
	const sources = await fetchSourcesFromRelay();
	if (sources.length === 0) {
		console.log('Keine aktiven Quellen — fertig.');
		pool.close([RELAY_URL]);
		process.exit(0);
	}

	// 2. Bereits verarbeitete URLs laden
	const existingUrls = await fetchExistingUrls();

	// 3. RSS-Feeds fetchen
	console.log('\nFetche RSS-Feeds...');
	let allItems = [];
	for (const source of sources) {
		console.log(`  ${source.name} (${source.url})`);
		const items = await fetchRssFeed(source.url);
		// Aktuelle Beiträge der letzten drei Tage, noch nicht verarbeitet.
		const cutoff = Date.now() - 72 * 60 * 60 * 1000;
		const newItems = items.filter(item =>
			Number.isFinite(item.pubDate.getTime()) &&
			item.pubDate.getTime() > cutoff &&
			!existingUrls.has(item.link)
		).slice(0, 3);
		// Category von der Quelle mitgeben
		newItems.forEach(item => {
			item.category = source.category;
			item.sourceName = source.name;
			item.sourceFormat = source.format || 'blog';
		});
		allItems.push(...newItems);
		console.log(`    ${items.length} Artikel, ${newItems.length} neu`);
	}

	if (allItems.length === 0) {
		console.log('\nKeine neuen Artikel — fertig.');
		pool.close([RELAY_URL]);
		process.exit(0);
	}

	// Neueste zuerst; URLs auch zwischen verschiedenen Feeds deduplizieren.
	allItems = Array.from(new Map(allItems.map(item => [item.link, item])).values())
		.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
		.slice(0, 15);
	console.log(`\nVerarbeite ${allItems.length} neue Artikel...\n`);

	// 4. Zusammenfassungen generieren + publishen
	let published = 0;
	for (const item of allItems) {
		console.log(`→ "${item.title}"`);
		const draft = await generateSummary(item, item.category);
		if (!draft) continue;

		const ok = await saveDraft(draft, item.link);
		if (ok) published++;

		// Kleine Pause zwischen API-Calls
		await new Promise(r => setTimeout(r, 500));
	}

	console.log(`\n☕ Fertig! ${published}/${allItems.length} Entwürfe erstellt.`);
	pool.close([RELAY_URL]);
}

main().catch(e => {
	console.error('Pipeline-Fehler:', e);
	process.exit(1);
});
