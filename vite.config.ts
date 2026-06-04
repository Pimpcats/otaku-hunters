import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Deployed to GitHub Pages at https://<user>.github.io/otaku-hunters/
// so assets must resolve under that base path in production.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/otaku-hunters/' : '/',
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  plugins: [
    VitePWA({
      // DEV-TIME: ship a self-destroying service worker. It unregisters any
      // previously-installed SW and clears its caches on next visit, so rapid
      // redeploys can't leave testers on a stale/blank cached build. Re-enable
      // the full PWA (remove this flag) before a real launch.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Otaku Hunter',
        short_name: 'OtakuHunter',
        description: 'A Vampire Survivors-style auto-battler that teaches Japanese.',
        theme_color: '#0b0d1a',
        background_color: '#0b0d1a',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}));
