import { json } from '@sveltejs/kit';
import { BARISTA_PUBKEY } from '$lib/nostr/ndk';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

/** POST /api/pipeline — Content-Pipeline starten (nur Barista) */
export const POST: RequestHandler = async ({ request }) => {
	const pubkey = request.headers.get('x-pubkey');
	if (pubkey !== BARISTA_PUBKEY) {
		return json({ error: 'Nicht autorisiert' }, { status: 403 });
	}

	try {
		const { stdout, stderr } = await execAsync(
			'source /var/www/bitcoincafe-app/.env && export LLM_API_KEY LLM_API_URL LLM_MODEL BARISTA_PRIVKEY && node /var/www/bitcoincafe-pipeline/fetch-and-draft.js',
			{ shell: '/bin/bash', timeout: 120000 }
		);

		// Anzahl erstellter Drafts aus Output parsen
		const match = stdout.match(/(\d+)\/(\d+) Entwuerfe erstellt/i) || stdout.match(/(\d+)\/(\d+) Entw/);
		const created = match ? Number(match[1]) : 0;
		const total = match ? Number(match[2]) : 0;

		return json({ ok: true, created, total, log: stdout.slice(-500) });
	} catch (e: any) {
		return json({ error: 'Pipeline fehlgeschlagen', log: e.stderr?.slice(-500) || e.message }, { status: 500 });
	}
};
