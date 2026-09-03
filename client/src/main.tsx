import React from 'react';
import ReactDOM from 'react-dom/client';
import { onlineManager } from '@tanstack/react-query';
import { initSentry } from './lib/sentry';
import App from './app/App';
import './lib/i18n';
import './index.css';

// Initialize Sentry before rendering
initSentry();

// Prime onlineManager with the real network state before React mounts, since it defaults to online and misleads first-render queries.
if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
  onlineManager.setOnline(navigator.onLine);
}

// Silently request persistent storage so the browser won't evict our caches under disk pressure, treating failure as non-fatal.
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => { /* best-effort */ });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
