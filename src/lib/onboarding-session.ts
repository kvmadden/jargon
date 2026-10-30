// Onboarding step memos — shared across tabs via localStorage with an
// in-memory cache for fast navigation reads.
//
// Two distinct flags (per-user × per-step):
//
//   - profileStep: the "skip" path on /onboarding/profile leaves no row
//     in user_profile (canonical-only mode is the absence of a row), so
//     we need a separate signal to prevent NeedsOnboarding from bouncing
//     the user back into the form on every navigation to /home.
//
//   - goalsStep: settings.diagnostic_completed only flips after the
//     diagnostic step. A user who finished goals but bailed before the
//     diagnostic should land back on /onboarding/diagnostic on next
//     entry — not be sent all the way back to /onboarding/goals to redo
//     toggles they already set.
//
// B+1.5 update: persistence moved from module-level Sets (tab-scoped)
// to localStorage (origin-scoped). Original failure mode: opening
// jargon in a second tab — or refreshing — would forget the within-
// session "I already saw this screen" signal and bounce the user
// backward through onboarding. The semantic shift is small but real:
// "saw this in this tab" → "saw this on this device." For an app
// optimized for habitual single-user use this is strictly better.
//
// signOut() MUST call `_resetProfileStepSeen()`. Without it, a
// returning user who skipped the profile step can never be re-prompted
// in this browser. The reset clears BOTH the in-memory cache AND the
// localStorage entries so the latent bug from Stage B+1 doesn't return.

type StepName = 'profile' | 'goals';

const STORAGE_PREFIX = 'jargon:onboarding-step-seen';

// In-memory cache mirroring localStorage. Exists so the per-navigation
// `hasSeen*` reads inside NeedsOnboarding don't hit the storage API on
// every render (cheap individually, but called on every wrapped route
// transition + every time the auth state flips).
const seenInMemory: Record<StepName, Set<string>> = {
  profile: new Set(),
  goals: new Set(),
};

function storageKey(step: StepName, userId: string): string {
  return `${STORAGE_PREFIX}:${step}:${userId}`;
}

function safeStorage(): Storage | null {
  // Defensive: SSR / Capacitor / private-browsing edge cases. Falls back
  // to the in-memory cache if localStorage is unavailable. The flag
  // becomes tab-scoped in that case (regression to the old behavior),
  // but the app keeps working rather than crashing.
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function markSeen(step: StepName, userId: string): void {
  if (typeof userId !== 'string' || !userId) return;
  const cleanUserId = userId.trim();
  if (!cleanUserId) return;
  seenInMemory[step].add(cleanUserId);
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(step, cleanUserId), '1');
  } catch {
    // QuotaExceeded / privacy mode — keep the in-memory mark, drop the
    // persistence. Same fallback behavior as if storage were unavailable.
  }
}

function checkSeen(step: StepName, userId: string): boolean {
  if (typeof userId !== 'string' || !userId) return false;
  const cleanUserId = userId.trim();
  if (!cleanUserId) return false;
  if (seenInMemory[step].has(cleanUserId)) return true;
  const storage = safeStorage();
  if (!storage) return false;
  try {
    if (storage.getItem(storageKey(step, cleanUserId)) === '1') {
      // Hydrate the cache so subsequent reads short-circuit.
      seenInMemory[step].add(cleanUserId);
      return true;
    }
  } catch {
    // Treat as not seen rather than throwing into the auth gate.
  }
  return false;
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export function markProfileStepSeen(userId: string): void {
  markSeen('profile', userId);
}

export function hasSeenProfileStep(userId: string): boolean {
  return checkSeen('profile', userId);
}

export function markGoalsStepSeen(userId: string): void {
  markSeen('goals', userId);
}

export function hasSeenGoalsStep(userId: string): boolean {
  return checkSeen('goals', userId);
}

/**
 * Test/HMR/sign-out escape hatch — clears all per-user memoization across
 * BOTH the in-memory cache and localStorage. Sign-out MUST call this
 * (see user-store.ts) so a returning user starts onboarding-clean rather
 * than inheriting the previous user's "I've seen this" flags.
 */
export function _resetProfileStepSeen(): void {
  seenInMemory.profile.clear();
  seenInMemory.goals.clear();
  const storage = safeStorage();
  if (!storage) return;
  try {
    // Iterate keys defensively — localStorage doesn't guarantee insertion
    // order, and modifying it mid-iteration on some browsers reorders the
    // remaining indices. Snapshot first, then delete.
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(`${STORAGE_PREFIX}:`)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      storage.removeItem(key);
    }
  } catch {
    // Best effort — in-memory cache is already cleared.
  }
}
