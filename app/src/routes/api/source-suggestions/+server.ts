import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { BARISTA_PUBKEY } from '$lib/nostr/ndk';
import type { RequestHandler } from './$types';

const SUGGESTIONS_FILE = process.env.SUGGESTIONS_FILE || '/var/www/bitcoincafe-pipeline/data/source-suggestions.json';

interface SourceSuggestion {
	id: string;
	url: string;
	name: string;
	category: string;
	suggestedBy: string;
	createdAt: string;
}

async function loadSuggestions(): Promise<SourceSuggestion[]> {
	try {
		const data = await readFile(SUGGESTIONS_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return [];
	}
}

async function saveSuggestions(suggestions: SourceSuggestion[]): Promise<void> {
	await writeFile(SUGGESTIONS_FILE, JSON.stringify(suggestions, null, 2));
}

/** GET — Vorschläge laden (nur Barista sieht alle) */
export const GET: RequestHandler = async ({ request }) => {
	const pubkey = request.headers.get('x-pubkey');
	if (!pubkey) return json({ error: 'Nicht eingeloggt' }, { status: 401 });

	const suggestions = await loadSuggestions();

	// Barista sieht alle, User sieht nur eigene
	if (pubkey === BARISTA_PUBKEY) return json(suggestions);
	return json(suggestions.filter((s) => s.suggestedBy === pubkey));
};

/** POST — Neue Quelle vorschlagen */
export const POST: RequestHandler = async ({ request }) => {
	const pubkey = request.headers.get('x-pubkey');
	if (!pubkey) return json({ error: 'Nicht eingeloggt' }, { status: 401 });

	const { url, name, category } = await request.json();
	if (!url?.trim() || !name?.trim()) {
		return json({ error: 'URL und Name erforderlich' }, { status: 400 });
	}

	const suggestions = await loadSuggestions();

	// Duplikat-Check
	const urlNorm = url.trim().toLowerCase().replace(/\/+$/, '');
	if (suggestions.some((s) => s.url.toLowerCase().replace(/\/+$/, '') === urlNorm)) {
		return json({ error: 'Diese Quelle wurde bereits vorgeschlagen' }, { status: 409 });
	}

	suggestions.push({
		id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		url: url.trim(),
		name: name.trim(),
		category: category || '',
		suggestedBy: pubkey,
		createdAt: new Date().toISOString()
	});

	await saveSuggestions(suggestions);
	return json({ ok: true });
};

/** DELETE — Vorschlag löschen (nur Barista) */
export const DELETE: RequestHandler = async ({ request }) => {
	const pubkey = request.headers.get('x-pubkey');
	if (pubkey !== BARISTA_PUBKEY) return json({ error: 'Nicht autorisiert' }, { status: 403 });

	const { id } = await request.json();
	const suggestions = await loadSuggestions();
	await saveSuggestions(suggestions.filter((s) => s.id !== id));
	return json({ ok: true });
};
