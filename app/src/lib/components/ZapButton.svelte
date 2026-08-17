<script lang="ts">
	import { userPubkey } from '$lib/stores/user.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { getZapInvoice, payWithWebLN } from '$lib/nostr/zaps';

	interface Props {
		eventId: string;
		authorPubkey: string;
		lightningAddress: string;
		onZapped?: () => void;
		zapCount?: number;
		zapTotal?: number;
	}

	let { eventId, authorPubkey, lightningAddress, onZapped, zapCount = 0, zapTotal = 0 }: Props = $props();

	let showDialog = $state(false);
	let amount = $state(21);
	let loading = $state(false);
	let invoice = $state('');
	let paid = $state(false);
	let error = $state('');

	const presets = [21, 100, 500, 1000, 5000];

	async function handleZap() {
		loading = true;
		error = '';
		invoice = '';

		try {
			const inv = await getZapInvoice(lightningAddress, amount, eventId, authorPubkey);
			if (!inv) {
				error = 'Invoice konnte nicht erstellt werden.';
				loading = false;
				return;
			}

			// Invoice direkt anzeigen (WebLN/Alby verursacht Probleme mit "no wallet connected")
			invoice = inv;
		} catch (e: any) {
			error = e?.message || 'Zap fehlgeschlagen.';
		}
		loading = false;
	}

	let copied = $state(false);

	async function copyInvoice() {
		try {
			await navigator.clipboard.writeText(invoice);
		} catch {
			// Fallback für ältere Browser
			const ta = document.createElement('textarea');
			ta.value = invoice;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function open() {
		amount = settings.defaultZapAmount;
		showDialog = true;
		invoice = '';
		paid = false;
		error = '';
	}
</script>

	<button
		onclick={open}
		class="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
	>
		⚡ {zapTotal > 0 ? `${zapTotal.toLocaleString('de-DE')} Sats` : 'Zap'}
	</button>

	{#if showDialog}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 z-50 bg-black/50"
			onclick={() => (showDialog = false)}
			aria-label="Schließen"
		></button>

		<!-- Dialog -->
		<div class="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-border bg-bg-card p-6 shadow-xl">
			{#if paid}
				<div class="py-6 text-center">
					<p class="text-4xl">⚡</p>
					<p class="mt-3 text-lg font-semibold text-accent">{amount} Sats gezappt!</p>
				</div>
			{:else if invoice}
				<h3 class="mb-4 text-lg font-semibold">Lightning Invoice</h3>
				<div class="mb-4 max-h-24 overflow-y-auto rounded-lg bg-bg-primary p-3">
					<p class="select-all break-all text-xs text-text-secondary">{invoice}</p>
				</div>
				<div class="flex gap-2">
					<button
						onclick={copyInvoice}
						class="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
					>
						{copied ? '✓ Kopiert!' : 'Kopieren'}
					</button>
					<a
						href="lightning:{invoice}"
						class="flex-1 rounded-lg border border-accent px-4 py-2 text-center text-sm font-medium text-accent"
					>
						In Wallet öffnen
					</a>
				</div>
			{:else}
				<h3 class="mb-4 text-lg font-semibold">⚡ Zap senden</h3>

				<!-- Amount Presets -->
				<div class="mb-4 flex flex-wrap gap-2">
					{#each presets as preset}
						<button
							onclick={() => (amount = preset)}
							class="rounded-lg px-3 py-1.5 text-sm transition-colors {amount === preset ? 'bg-accent text-black' : 'bg-bg-primary text-text-secondary hover:bg-bg-secondary'}"
						>
							{preset} sats
						</button>
					{/each}
				</div>

				<!-- Custom Amount -->
				<div class="mb-4">
					<input
						type="number"
						bind:value={amount}
						min="1"
						class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
					/>
				</div>

				{#if error}
					<p class="mb-3 text-sm text-red-400">{error}</p>
				{/if}

				<div class="flex gap-2">
					<button
						onclick={handleZap}
						disabled={loading || amount < 1}
						class="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent/80 disabled:opacity-50"
					>
						{loading ? 'Laden...' : `⚡ ${amount} Sats zappen`}
					</button>
					<button
						onclick={() => (showDialog = false)}
						class="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary"
					>
						Abbrechen
					</button>
				</div>
			{/if}
		</div>
	{/if}
