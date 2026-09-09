/** IndexedDB persistence for queries marked `meta: { persist: true }`, giving a second offline layer that survives Workbox cache eviction. */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';
import { get, set, del, createStore } from 'idb-keyval';

// Minimal async-storage surface, since the library's AsyncStorage type isn't publicly exported.
interface AsyncStorageLike {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const STORE_KEY = 'rdswa-query-cache';
const DATABASE_NAME = 'rdswa-offline';
const STORE_NAME = 'tanstack-query';
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

/** The longest gcTime a browser can honour, because setTimeout overflows past 2^31-1 ms and fires immediately instead. */
export const MAX_GC_TIME = 2 ** 31 - 1;

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

/** Filters for PersistQueryClient so only queries marked `meta: { persist: true }` leave memory. */
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

/** Request persistent storage once at app start, which installed PWAs get silently and plain tabs may harmlessly refuse. */
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
