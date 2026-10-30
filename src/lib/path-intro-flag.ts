// Path-intro flag — Stage B+1.16 orientation pass.
//
// Per-user × per-path one-shot flag. The first time a user starts a
// lesson in a path, the lesson runner shows a brief PathIntroCard
// ("you're learning [path label]") before the first quiz card. After
// dismissing, the flag is set so subsequent lessons in the same path
// jump straight into the quiz cards.
//
// Per-device, intentionally — same tradeoff as first-mastery-flag.ts:
// signing in on a second device gives the user one extra "you're
// learning X" framing, which is a small benign re-orientation, not
// a bug worth round-tripping a settings column for.
//
// Mirror of `first-mastery-flag.ts` patterns: in-memory cache +
// localStorage fallback + reset helper for unit coverage.

const STORAGE_PREFIX = 'jargon:path-intro-seen';

// In-memory cache so reads on every render don't hit the storage API.
// Composite key `${userId}:${pathId}` keeps the cache compact + per-pair.
const seenInMemory: Set<string> = new Set();

function compositeKey(userId: string, pathId: string): string {
  return `${userId}:${pathId}`;
}

function storageKey(userId: string, pathId: string): string {
  return `${STORAGE_PREFIX}:${userId}:${pathId}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Returns true when this user has already seen the path intro for the
 *  given pathId on this device. lesson-runner gates the PathIntroCard
 *  on the negation of this. */
export function hasSeenPathIntro(userId: string, pathId: string): boolean {
  if (!userId || !pathId) return false;
  const key = compositeKey(userId, pathId);
  if (seenInMemory.has(key)) return true;
  const storage = safeStorage();
  if (!storage) return false;
  const v = storage.getItem(storageKey(userId, pathId));
  if (v === '1') {
    seenInMemory.add(key);
    return true;
  }
  return false;
}

/** Marks the path intro as seen for this user × path. Idempotent. */
export function markPathIntroSeen(userId: string, pathId: string): void {
  if (!userId || !pathId) return;
  const key = compositeKey(userId, pathId);
  seenInMemory.add(key);
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(userId, pathId), '1');
  } catch {
    // Storage write can fail in private-browsing / quota cases. The
    // in-memory cache already prevents re-fires within this tab; the
    // worst across-tab regression is one extra intro on the next mount
    // in another tab.
  }
}

/** Test helper — clears both the in-memory cache + localStorage for
 *  the given user × path. Not exported for production code. */
export function _resetPathIntroFlagForTests(userId: string, pathId: string): void {
  seenInMemory.delete(compositeKey(userId, pathId));
  const storage = safeStorage();
  if (storage) {
    try {
      storage.removeItem(storageKey(userId, pathId));
    } catch {
      // ignore
    }
  }
}
