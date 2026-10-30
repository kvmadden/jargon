import type { FeedbackDraft } from './types';

const DRAFT_PREFIX = 'jargon.feedback.draft.v1';
const QUEUE_PREFIX = 'jargon.feedback.queue.v1';
const RATE_PREFIX = 'jargon.feedback.rate.v1';
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function storageKey(prefix: string, userId: string) {
  return `${prefix}.${userId}`;
}
function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadFeedbackDraft(userId: string): FeedbackDraft | null {
  return readJson<FeedbackDraft | null>(storageKey(DRAFT_PREFIX, userId), null);
}

export function saveFeedbackDraft(userId: string, draft: FeedbackDraft) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(DRAFT_PREFIX, userId), JSON.stringify(draft));
  } catch {
    // Storage can be unavailable in private browsing. The live textarea still works.
  }
}

export function clearFeedbackDraft(userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(DRAFT_PREFIX, userId));
}

export function loadFeedbackQueue(userId: string): FeedbackDraft[] {
  return readJson<FeedbackDraft[]>(storageKey(QUEUE_PREFIX, userId), []);
}

export function saveFeedbackQueue(userId: string, queue: FeedbackDraft[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(QUEUE_PREFIX, userId), JSON.stringify(queue));
}

export function enqueueFeedback(userId: string, draft: FeedbackDraft) {
  const queue = loadFeedbackQueue(userId);
  queue.push(draft);
  saveFeedbackQueue(userId, queue);
}

export function useFeedbackRateSlot(
  userId: string,
  now = Date.now(),
): { allowed: true } | { allowed: false; secondsLeft: number } {
  const key = storageKey(RATE_PREFIX, userId);
  const prior = readJson<number[]>(key, []).filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (prior.length >= RATE_LIMIT) {
    const secondsLeft = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - prior[0])) / 1000));
    return { allowed: false, secondsLeft };
  }
  prior.push(now);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(prior));
  }
  return { allowed: true };
}
