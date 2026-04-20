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
        navigateFallbackDenylist: [/^\/api\//],
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
          // StaleWhileRevalidate: serve cached instantly, refresh in the background.
          // Placed BEFORE the generic /api/* rule so it takes priority.
          {
            urlPattern: /\/api\/bus\/.*$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-bus-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/settings(\?.*)?$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-settings-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/users\/blood-donors.*$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-blood-donors-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 6 },
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
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
