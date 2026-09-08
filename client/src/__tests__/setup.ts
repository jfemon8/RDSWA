import '@testing-library/jest-dom/vitest';

/** Minimal Storage stand-in, since neither jsdom nor Node 26 supplies a usable one in this environment. */
function createStorage(): Storage {
  let entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    key: (i: number) => [...entries.keys()][i] ?? null,
    getItem: (k: string) => (entries.has(k) ? entries.get(k)! : null),
    setItem: (k: string, v: string) => { entries.set(k, String(v)); },
    removeItem: (k: string) => { entries.delete(k); },
    clear: () => { entries = new Map(); },
  } as Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const storage = createStorage();
  Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
  }
}
