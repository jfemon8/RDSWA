import React from 'react';
import ReactDOM from 'react-dom/client';
import { onlineManager } from '@tanstack/react-query';
import { initSentry } from './lib/sentry';
import App from './app/App';
import './lib/i18n';
import './index.css';

// Initialize Sentry before rendering
initSentry();

// Prime TanStack Query's onlineManager with the real network state BEFORE
// React mounts. The manager defaults to `online: true` regardless of the
// actual device state, which means first-render queries briefly think
// they're online and can take the wrong network-mode branch. Priming here
// (plus refetchOnReconnect in individual queries) gives a coherent
// offline-first boot on cold PWA launches.
if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
  onlineManager.setOnline(navigator.onLine);
}

// Ask the browser to promote our storage to "persistent". When granted, the
// browser will NOT auto-evict Cache Storage / IndexedDB under low-disk
// pressure — essential for the offline-first guarantee on Bus Schedule +
// Blood Donors pages. The request is silent (no user prompt on Android
// WebView / installed PWAs; granted automatically when heuristics approve).
// Fire-and-forget: failures are non-fatal.
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => { /* best-effort */ });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
