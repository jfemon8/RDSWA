/**
 * IndexedDB-backed persistence for TanStack Query results.
 *
 * Why this exists:
 *   Workbox caches raw HTTP responses in Cache Storage — good, but not enough
 *   for a truly offline-first experience. TanStack Query holds *parsed*
 *   results + pagination cursors + filter-state keyed by queryKey; on a cold
 *   start (RAM cleared, app relaunched), an empty TanStack cache would still
 *   trigger a network request, and while the SW would answer that request
 *   from its own cache, we rely on Workbox's cache being alive.
 *
 *   Persisting TanStack state gives us a **second independent offline layer**
 *   that restores query state instantly on mount, before any fetch is even
 *   attempted. If Workbox evicts a response due to quota pressure, TanStack
 *   persistence still has the parsed result.
 *
 * Scope:
 *   Only queries with `meta: { persist: true }` are dehydrated. This keeps
 *   the persistent bundle small — we don't want to persist every query in
 *   the app, only the ones the user explicitly needs offline (bus schedule,
 *   blood donors, supporting settings/config).
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';
import { get, set, del, createStore } from 'idb-keyval';

// Persister-compatible async-storage shape. The library's AsyncStorage type
// isn't publicly exported, so we define the minimal surface it accepts.
interface AsyncStorageLike {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const STORE_KEY = 'rdswa-query-cache';
const DATABASE_NAME = 'rdswa-offline';
const STORE_NAME = 'tanstack-query';
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

// Dedicated IDB object store so we don't collide with any other idb-keyval usage.
const store = createStore(DATABASE_NAME, STORE_NAME);

const idbStorage: AsyncStorageLike = {
  getItem: (key: string) => get<string>(key, store).then((v) => v ?? null),
  setItem: async (key: string, value: string) => { await set(key, value, store); },
  removeItem: async (key: string) => { await del(key, store); },
};

export const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: STORE_KEY,
  // Throttle writes — without this, every query update triggers an IDB put,
  // which thrashes the main thread on lists with many concurrent queries.
  throttleTime: 1000,
});

/**
 * Filters passed to PersistQueryClient — only queries explicitly marked with
 * `meta: { persist: true }` are persisted. Everything else (auth profile,
 * notifications, admin pages, etc.) stays in memory only.
 */
export const persistOptions = {
  persister: queryPersister,
  maxAge: THIRTY_DAYS_MS,
  // Bump this when the query cache shape changes in an incompatible way —
  // persisted data with a different buster is discarded on app load.
  buster: 'v2-offlineFirst',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { meta?: { persist?: boolean }; state: { status: string } }) => {
      // Only persist successful, explicitly opted-in queries.
      return query.state.status === 'success' && query.meta?.persist === true;
    },
  },
};

/**
 * Call this once on app start to request persistent storage from the browser.
 * When granted, the OS will not auto-evict our IDB / Cache Storage under
 * low-disk pressure. Granted silently for installed PWAs / TWAs; may be
 * denied in plain browser tabs (harmless — eviction still follows LRU).
 */
export async function requestPersistentStorage(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
  } catch {
    /* best-effort */
  }
}

// Re-export for places that need to clear the persisted cache manually (e.g. logout).
export async function clearPersistedQueries(): Promise<void> {
  await idbStorage.removeItem(STORE_KEY);
}

export function buildDefaultClient(client: QueryClient): QueryClient {
  return client; // placeholder — kept so persistence setup has one entry point.
}
