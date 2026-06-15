import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// The PWA plugin's service-worker generation (workbox + terser) can fail on
// some environments (e.g. Termux/Android). It's an optional offline/install
// nicety — the game runs fine without it. Set VITE_NO_PWA=1 to skip it:
//   VITE_NO_PWA=1 npm run build
// (ambient decls — see src/vite-env.d.ts — avoid pulling all of @types/node
// into tsc's types)
declare const process: { env: Record<string, string | undefined> };
const enablePWA = process.env.VITE_NO_PWA !== '1';

// Deploy base. Local dev / a root host stays '/'; the GitHub Pages project
// site is served from '/<repo>/' and sets VITE_BASE accordingly so asset URLs
// resolve under the sub-path (see src/game/rendering/assetUrl.ts).
const base = process.env.VITE_BASE ?? '/';

// Build identity stamp: short git hash + build time. Rendered on-device so a
// running bundle can be matched against `git rev-parse --short HEAD` — no more
// guessing whether the phone is serving a stale build.
const buildId = (() => {
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    return `${hash} · ${when}`;
  } catch {
    return `nogit · ${when}`;
  }
})();

export default defineConfig({
  base,
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    ...(enablePWA ? [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Tactical: Runes & Rifles',
        short_name: 'Tactical',
        description: 'Fantasy-modern turn-based tactical combat.',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'favicon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'favicon.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    })] : []),
  ],
  server: { host: true, port: 5173 },
  build: {
    // Bundle everything into a single JS file instead of code-splitting into
    // ~15 lazy chunks (Pixi v8 dynamically imports its renderer, filters, etc.).
    // On constrained setups (a phone serving the build via `npx serve`), those
    // parallel chunk fetches can drop, and a failed dynamic import of e.g.
    // WebGLRenderer-*.js takes the whole renderer down ("Failed to fetch
    // dynamically imported module"). One file = one request = no such failure.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
