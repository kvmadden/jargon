// Vitest global setup
// @testing-library/jest-dom matchers are imported here so every test file gets them.
import '@testing-library/jest-dom';

// localStorage polyfill (fallback). jsdom 25 on newer node (v26 via homebrew)
// stopped exposing window.localStorage — its Storage impl regressed on that
// node — which broke every persistence/route test with
// "Cannot read properties of undefined (reading 'getItem')". Provide a minimal
// in-memory Storage ONLY when jsdom's is absent, so tests are stable across the
// jsdom/node combo. Fresh per test file (setupFiles run before each file);
// tests clear() in their own beforeEach as they always have.
if (typeof window !== 'undefined' && !window.localStorage) {
  const makeStorage = (): Storage => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      clear: () => {
        store.clear();
      },
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => {
        store.delete(k);
      },
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
    };
  };
  const local = makeStorage();
  Object.defineProperty(window, 'localStorage', { value: local, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  if (!window.sessionStorage) {
    const session = makeStorage();
    Object.defineProperty(window, 'sessionStorage', { value: session, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true, writable: true });
  }
}

// Silence console.warn/error noise from Supabase missing-key warnings and the
// grader's network-error logging during unit tests. Re-enable for a specific test
// by spying inside that test.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
