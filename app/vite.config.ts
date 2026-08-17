import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'BitcoinCafé.de',
				short_name: 'BitcoinCafé',
				description: 'Deutschsprachiger Bitcoin-Treffpunkt — News, Zaps & Community',
				start_url: '/',
				display: 'standalone',
				theme_color: '#F7931A',
				background_color: '#F5F0E8',
				orientation: 'portrait-primary',
				icons: [
					{
						src: '/icons/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: '/icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff2}'],
				navigateFallback: null,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\.nostr\./,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'nostr-cache',
							expiration: { maxEntries: 100, maxAgeSeconds: 3600 }
						}
					}
				]
			}
		})
	]
});
