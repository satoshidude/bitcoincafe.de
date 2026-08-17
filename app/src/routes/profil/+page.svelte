<script lang="ts">
	import { userPubkey, userProfile } from '$lib/stores/user.svelte';
	import { loginWithExtension, logout } from '$lib/nostr/login';
	import { getNdk, getProfileNdk } from '$lib/nostr/ndk';
	import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

	let loggingIn = $state(false);
	let showEdit = $state(false);
	let saving = $state(false);
	let saveMsg = $state('');

	// Edit-Felder
	let editName = $state('');
	let editAbout = $state('');
	let editPicture = $state('');
	let editBanner = $state('');
	let editWebsite = $state('');
	let editNip05 = $state('');
	let editLud16 = $state('');
	let editRelays = $state('wss://relay.damus.io, wss://nos.lol, wss://purplepag.es, wss://relay.bitcoincafe.de');

	async function handleLogin() {
		loggingIn = true;
		try {
			await loginWithExtension();
		} finally {
			loggingIn = false;
		}
	}

	function openEdit() {
		editName = userProfile.value?.name || '';
		editAbout = userProfile.value?.about || '';
		editPicture = userProfile.value?.picture || '';
		editBanner = '';
		editWebsite = '';
		editNip05 = '';
		editLud16 = '';

		// Versuche bestehende Werte zu laden (werden beim fetchProfile nicht alle gespeichert)
		showEdit = true;
	}

	async function handleSave() {
		if (!userPubkey.value) return;
		saving = true;
		saveMsg = '';

		try {
			const ndk = getNdk();
			if (!ndk.signer) throw new Error('Nicht eingeloggt');

			// Bestehendes Profil vom Relay laden
			const profileNdk = getProfileNdk();
			const user = profileNdk.getUser({ pubkey: userPubkey.value });
			await user.fetchProfile();
			const existing = user.profile || {};

			// Profil mergen — nur geänderte Felder überschreiben
			const profile: Record<string, string> = {
				name: editName || existing.name || '',
				display_name: editName || existing.displayName || '',
				about: editAbout || existing.about || '',
				picture: editPicture || existing.image || '',
				banner: editBanner || (existing as any).banner || '',
				website: editWebsite || (existing as any).website || '',
				nip05: editNip05 || (existing as any).nip05 || '',
				lud16: editLud16 || (existing as any).lud16 || ''
			};

			// Kind 0 Event auf mehrere Relays publishen
			const relayUrls = editRelays.split(',').map((r) => r.trim()).filter((r) => r.startsWith('wss://'));
			const publishNdk = new NDK({ explicitRelayUrls: relayUrls, signer: ndk.signer });
			await publishNdk.connect();

			const event = new NDKEvent(publishNdk);
			event.kind = 0;
			event.content = JSON.stringify(profile);

			await event.publish();

			// Lokalen State updaten
			userProfile.value = {
				name: profile.name,
				picture: profile.picture,
				about: profile.about
			};

			saveMsg = 'Profil gespeichert!';
			setTimeout(() => { showEdit = false; saveMsg = ''; }, 1500);
		} catch (e: any) {
			saveMsg = e.message || 'Speichern fehlgeschlagen.';
		}
		saving = false;
	}
</script>

<svelte:head>
	<title>Profil — BitcoinCafé.de</title>
</svelte:head>

<section>
	<header class="menu-page mb-8 px-6 py-8 sm:px-8">
		<p class="menu-kicker mb-3">Dein Stammplatz</p>
		<h1 class="neon-text text-4xl font-semibold">Profil</h1>
		<p class="mt-2 text-sm text-text-secondary">Nostr-Identität und Café-Einstellungen</p>
	</header>

	{#if userPubkey.value}
		<div class="rounded-xl border border-border bg-bg-card p-6">
			<div class="flex items-center gap-4">
				{#if userProfile.value?.picture}
					<img src={userProfile.value.picture} alt="" class="h-16 w-16 rounded-full object-cover" />
				{:else}
					<div class="h-16 w-16 rounded-full bg-accent/20"></div>
				{/if}
				<div>
					<p class="text-lg font-semibold">{userProfile.value?.name || 'Anon'}</p>
					<p class="text-xs text-text-secondary">{userPubkey.value.slice(0, 16)}...</p>
				</div>
			</div>
			{#if userProfile.value?.about}
				<p class="mt-4 text-sm text-text-secondary">{userProfile.value.about}</p>
			{/if}
			<div class="mt-6 flex gap-2">
				<button
					onclick={openEdit}
					class="rounded-lg border border-accent px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
				>
					Profil bearbeiten
				</button>
				<button
					onclick={logout}
					class="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-red-500 hover:text-red-400"
				>
					Abmelden
				</button>
			</div>
		</div>

		<!-- Edit Formular -->
		{#if showEdit}
			<div class="mt-4 rounded-xl border border-border bg-bg-card p-6">
				<h2 class="mb-4 text-lg font-semibold">Profil bearbeiten</h2>
				<div class="flex flex-col gap-3">
					<div>
						<label for="profile-name" class="mb-1 block text-xs text-text-secondary">Name</label>
						<input
							id="profile-name"
							bind:value={editName}
							placeholder="Dein Name"
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						/>
					</div>
					<div>
						<label for="profile-about" class="mb-1 block text-xs text-text-secondary">Über mich</label>
						<textarea
							id="profile-about"
							bind:value={editAbout}
							placeholder="Kurze Beschreibung..."
							rows="3"
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						></textarea>
					</div>
					<div>
						<label for="profile-picture" class="mb-1 block text-xs text-text-secondary">Profilbild (URL)</label>
						<input
							id="profile-picture"
							bind:value={editPicture}
							placeholder="https://..."
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						/>
					</div>
					<div>
						<label for="profile-banner" class="mb-1 block text-xs text-text-secondary">Banner (URL)</label>
						<input
							id="profile-banner"
							bind:value={editBanner}
							placeholder="https://..."
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						/>
					</div>
					<div>
						<label for="profile-website" class="mb-1 block text-xs text-text-secondary">Website</label>
						<input
							id="profile-website"
							bind:value={editWebsite}
							placeholder="https://..."
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						/>
					</div>
					<div>
						<label for="profile-nip05" class="mb-1 block text-xs text-text-secondary">NIP-05 Adresse</label>
						<input
							id="profile-nip05"
							bind:value={editNip05}
							placeholder="name@domain.com"
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						/>
					</div>
					<div>
						<label for="profile-lightning" class="mb-1 block text-xs text-text-secondary">Lightning-Adresse</label>
						<input
							id="profile-lightning"
							bind:value={editLud16}
							placeholder="name@domain.com"
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						/>
					</div>
					<div>
						<label for="profile-relays" class="mb-1 block text-xs text-text-secondary">Relays (kommagetrennt)</label>
						<input
							id="profile-relays"
							bind:value={editRelays}
							placeholder="wss://relay.damus.io, wss://nos.lol"
							class="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm focus:border-accent focus:outline-none"
						/>
					</div>

					{#if saveMsg}
						<p class="text-sm {saveMsg.includes('gespeichert') ? 'text-green-400' : 'text-red-400'}">{saveMsg}</p>
					{/if}

					<div class="flex gap-2">
						<button
							onclick={handleSave}
							disabled={saving}
							class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent/80 disabled:opacity-50"
						>
							{saving ? 'Speichern...' : 'Speichern'}
						</button>
						<button
							onclick={() => (showEdit = false)}
							class="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary"
						>
							Abbrechen
						</button>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="rounded-xl border border-border bg-bg-card p-6 text-center">
			<p class="mb-4 text-text-secondary">Melde dich mit deinem Nostr-Key an</p>
			<button
				onclick={handleLogin}
				disabled={loggingIn}
				class="rounded-lg bg-accent px-6 py-2.5 font-medium text-bg-primary transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				{loggingIn ? 'Verbinde...' : 'Mit Nostr anmelden'}
			</button>
			<p class="mt-3 text-xs text-text-secondary">
				Du brauchst eine Nostr-Extension wie Alby oder nos2x
			</p>
		</div>
	{/if}
</section>
