import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { BARISTA_PUBKEY } from '$lib/nostr/ndk';
import type { RequestHandler } from './$types';

const DRAFTS_FILE = process.env.DRAFTS_FILE || '/var/www/bitcoincafe-pipeline/data/drafts.json';

interface Draft {
	id: string;
	title: string;
	summary: string;
	content: string;
	category: string;
	sourceUrl: string;
	createdAt: string;
}

async function loadDrafts(): Promise<Draft[]> {
	try {
		const data = await readFile(DRAFTS_FILE, 'utf-8');
		return JSON.parse(data);
	} catch {
		return [];
	}
}

async function saveDrafts(drafts: Draft[]): Promise<void> {
	await writeFile(DRAFTS_FILE, JSON.stringify(drafts, null, 2));
}

/** GET /api/drafts — Alle Drafts laden (nur für Barista) */
export const GET: RequestHandler = async ({ request }) => {
	const pubkey = request.headers.get('x-pubkey');
	if (pubkey !== BARISTA_PUBKEY) {
		return json({ error: 'Nicht autorisiert' }, { status: 403 });
	}
	const drafts = await loadDrafts();
	return json(drafts);
};

/** DELETE /api/drafts/:id — Draft löschen */
export const DELETE: RequestHandler = async ({ request }) => {
	const pubkey = request.headers.get('x-pubkey');
	if (pubkey !== BARISTA_PUBKEY) {
		return json({ error: 'Nicht autorisiert' }, { status: 403 });
	}

	const { id } = await request.json();
	const drafts = await loadDrafts();
	const filtered = drafts.filter((d) => d.id !== id);
	await saveDrafts(filtered);
	return json({ ok: true, remaining: filtered.length });
};
