/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        // Stable identifier — keeps the PWA identity even if start_url changes
        id: '/',
        name: 'RDSWA - Rangpur Divisional Student Welfare Association',
        short_name: 'RDSWA',
        description: 'Official platform of Rangpur Divisional Student Welfare Association, University of Barishal.',
        // Brand colors sourced from the Rangpur Association logo palette —
        // #008f57 is the logo's signature emerald, darkened slightly from the
        // raw #00a060 so white status-bar icons meet WCAG AA contrast.
        theme_color: '#008f57',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['education', 'social', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Screenshots are optional — add them later by capturing the running
        // app (see `next-steps.md`) and re-enable this block once the PNGs
        // are in public/icons/. PWABuilder shows only a non-blocking warning
        // when screenshots are missing.
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ship updates the moment a new build deploys: the new SW skips the
        // waiting state, claims all open tabs, and evicts stale precache
        // entries. Without this, users keep a cached index.html that
        // references old chunk hashes — which 404 after a rolling deploy
        // and render blank pages until a manual hard-reload. SPA deep links
        // (e.g. /dashboard/chat) also need navigateFallback so the SW
        // returns the cached shell instead of a 404 when offline.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Anything that should NOT fall back to index.html. Without this,
        // returning visitors with the SW installed get index.html served
        // for paths like /ads.txt, /robots.txt, /sitemap.xml — which then
        // appear as "404" or as HTML content where text was expected.
        // AdSense crawlers don't run a SW, so they don't hit this — but
        // the user-visible 404 / wrong content is still real and
        // misleads any manual verification.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/ads\.txt$/,
          /^\/app-ads\.txt$/,
          /^\/robots\.txt$/,
          /^\/sitemap\.xml$/,
          /^\/manifest\.webmanifest$/,
          /^\/_vercel\//,
          // Catch-all: any path with a non-HTML file extension shouldn't
          // be treated as an SPA route.
          /\.(?:txt|xml|json|webmanifest|map|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|otf|eot|mp3|mp4|webm|pdf|css|js)$/i,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Offline-first endpoints (Bus Schedule, About/Settings, Blood Donors) ──
          //
          // Strategy: NetworkFirst with `networkTimeoutSeconds: 3`. This gives
          // us the best of both worlds:
          //   • Online (fast network): network response wins → fresh data.
          //     The UI immediately reflects server-side changes on navigation.
          //   • Online (slow / >3s network): timeout → cache fallback. Users
          //     never wait indefinitely on a bad connection.
          //   • Offline: the network fetch rejects immediately → cache
          //     fallback. All previously-visited data stays accessible.
          //
          // We deliberately DON'T use StaleWhileRevalidate here: SWR returns
          // the cached (potentially stale) response to the client even when
          // online, and the fresh background response only updates the SW's
          // cache. That means the TanStack in-memory cache gets the stale
          // response and the UI shows stale data until the next navigation —
          // a poor "just-came-online" sync experience.
          //
          // TanStack Query's refetchOnReconnect (default true) then triggers
          // a refetch when the browser fires the 'online' event, which hits
          // this rule and returns fresh data, completing the sync.
          //
          // The IndexedDB-backed TanStack persistence layer (see
          // lib/queryPersister.ts) acts as a *second* independent offline
          // source so even if Workbox evicts entries under quota pressure,
          // the UI still hydrates from persisted query state.
          //
          // Placed BEFORE the generic /api/* rule so it takes priority.
          // `purgeOnQuotaError: false` on these critical caches means the
          // browser evicts *other* origins' storage (and our image cache,
          // see below) before it touches Bus Schedule / Blood Donors data.
          {
            urlPattern: /\/api\/bus\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-bus-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: false },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/settings(\?.*)?$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-settings-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: false },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Blood Donors list — including all blood-group + district filter combos.
          {
            urlPattern: /\/api\/users\/blood-donors.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-blood-donors-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: false },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Academic config feeds dropdowns on member-related pages.
          {
            urlPattern: /\/api\/settings\/academic-config.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-academic-config-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: false },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Current-user profile. Cached so useAuth can hydrate the Zustand
          // store on cold offline launches without wiping the access token.
          // Kept short (7 days) because this response carries identity — we
          // don't want a stale role/permission set lingering indefinitely.
          {
            urlPattern: /\/api\/users\/me$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-users-me-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7, purgeOnQuotaError: false },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images (avatars, bus photos). Cloudinary URLs are content-hashed
          // and immutable per URL — CacheFirst is ideal because the browser
          // can skip the network entirely on repeat access.
          // `purgeOnQuotaError: true` lets Workbox auto-drop THIS cache first
          // when quota pressure hits, protecting the API data caches above.
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*\.(?:png|jpg|jpeg|webp|gif|svg|avif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Generic Cloudinary catch-all for URLs without a file-extension
          // suffix (Cloudinary URL transformations sometimes omit one).
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-assets-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@rdswa/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  // `vite preview` doesn't inherit `server.proxy` — it needs its own block.
  // Without this, the built app hits /api on the preview server (4173) and
  // 404s, making local PWA offline testing impossible.
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
