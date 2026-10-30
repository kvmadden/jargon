// First-mastered-term flag — Stage B+1.16 gameplay loop polish.
//
// One-shot per-user celebration: when a user gets their VERY FIRST term
// to mastered status, lesson-runner fires confetti + a special "first
// term mastered!" toast. After that the flag is set so subsequent
// masteries get the standard treatment.
//
// Per-user × per-device: stored in localStorage keyed by user id. If the
// user signs in on a second device, they get the celebration there too —
// not a bug, just a small extra dopamine hit per device. Acceptable
// tradeoff vs the complexity of round-tripping a settings.first_mastery_at
// timestamp through Supabase.
//
// Mirror of `onboarding-session.ts` patterns: in-memory cache + localStorage
// fallback, `safeStorage()` defensive read, _resetForTests for unit coverage.

const STORAGE_PREFIX = 'jargon:first-mastery-celebrated';

// In-memory cache so reads on every keystroke / animation frame don't hit
// the storage API. Set is sufficient — we only care about presence.
const celebratedInMemory: Set<string> = new Set();

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Returns true when this user has already celebrated their first mastery
 *  on this device. Used by lesson-runner to gate the special toast +
 *  confetti burst. */
export function hasCelebratedFirstMastery(userId: string): boolean {
  if (!userId) return false;
  if (celebratedInMemory.has(userId)) return true;
  const storage = safeStorage();
  if (!storage) return false;
  const v = storage.getItem(storageKey(userId));
  if (v === '1') {
    celebratedInMemory.add(userId);
    return true;
  }
  return false;
}

/** Marks the celebration as done. Idempotent — safe to call repeatedly. */
export function markFirstMasteryCelebrated(userId: string): void {
  if (!userId) return;
  celebratedInMemory.add(userId);
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(userId), '1');
  } catch {
    // Storage write can fail in private-browsing / quota-exceeded cases.
    // The in-memory cache already prevents re-fires within this tab; the
    // worst case across-tab regression is one extra celebration on the
    // next mount in the other tab.
  }
}

/** Test helper — clears both the in-memory cache + localStorage for the
 *  given user. Not exported for production code. */
export function _resetFirstMasteryFlagForTests(userId: string): void {
  celebratedInMemory.delete(userId);
  const storage = safeStorage();
  if (storage) {
    try {
      storage.removeItem(storageKey(userId));
    } catch {
      // ignore
    }
  }
}
