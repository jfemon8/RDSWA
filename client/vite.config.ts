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
        // Screenshots stay out until PNGs land in public/icons/, since PWABuilder only raises a non-blocking warning without them.
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // A new worker takes over immediately so no one keeps a cached index.html pointing at chunk hashes that 404 after a rolling deploy, while navigateFallback serves the shell for SPA deep links offline.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Paths that must never fall back to index.html, or a returning visitor with the worker installed gets HTML where /ads.txt, /robots.txt or /sitemap.xml was expected.
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
          // Offline-first endpoints use NetworkFirst with a 3s timeout rather than StaleWhileRevalidate, because SWR would hand TanStack a stale response while online and leave the UI out of date until the next navigation.
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
          // The current-user profile is cached so useAuth can hydrate on a cold offline launch, but only for 7 days since a stale role set must not linger.
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
          // Cloudinary URLs are immutable per URL so CacheFirst can skip the network entirely, and purgeOnQuotaError lets this cache be dropped first to protect the API caches above.
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
  // `vite preview` needs its own proxy block because it does not inherit `server.proxy`, without which the built app 404s on /api and local PWA offline testing is impossible.
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
