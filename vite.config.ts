import { defineConfig } from 'vite';

// Deployed to GitHub Pages at https://<user>.github.io/otaku-hunters/
// so assets must resolve under that base path in production.
//
// No service worker / PWA: during active iteration a cached SW kept leaving
// testers on stale or blank builds. Shipping zero SW means every deploy is
// fetched fresh and the page can't go blank from caching. (Anyone who still has
// the old self-destroying SW gets unregistered by it on their next load.)
// Re-add a PWA before a real launch if offline/installable is wanted.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/otaku-hunters/' : '/',
  build: {
    target: 'es2020',
    sourcemap: true,
  },
}));
