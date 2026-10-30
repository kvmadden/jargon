import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TermRow } from '../lib/database.types';

export type LessonOutcome = 'correct' | 'wrong' | 'partial';

export interface CardResult {
  termId: string;
  outcome: LessonOutcome;
  xpEarned: number;
  timeMs: number;
  quizType: 'mc' | 'match' | 'fill' | 'sentence' | 'xworld' | 'scenario' | 'transcript';
}

/**
 * Distinguishes a normal lesson from a dedicated /review session. Drives
 * runner header copy ("review" vs "lesson") + summary screen header copy
 * + "next" CTA destination on summary. Default `lesson` keeps the
 * existing /lesson flow untouched.
 */
export type LessonMode = 'lesson' | 'review';

interface LessonState {
  active: boolean;
  pathId: string | null;
  /**
   * Which surface kicked off this session. 'lesson' (default) is the
   * normal /lesson path; 'review' is a /review session that pulled only
   * SRS-due previously-mastered terms across the active domain.
   * Reset to 'lesson' on `reset()` so a stale flag never bleeds across
   * sessions.
   */
  mode: LessonMode;
  /**
   * A per-lesson UUID — regenerated on every `start`. Used by lesson-summary to make
   * the streak-bump idempotent across React StrictMode's double-invoked effects: only
   * the first effect run for a given sessionId will bump `lessons_completed`.
   */
  sessionId: string;
  terms: TermRow[];
  /**
   * Initial count of distinct terms in the lesson when `start()` was called.
   * Provides a stable denominator for progress calculation so relearn requeues
   * don't cause the progress bar to regress.
   */
  initialTermsCount: number;
  currentIndex: number;
  results: CardResult[];
  startedAt: number;
  cardStartedAt: number;
  /** termId → true once the user has dismissed that term's LearnCard prelude. */
  learnCardSeenForTerm: Record<string, boolean>;
  /**
   * B+1.6 — list of term IDs that hit mastery during this lesson, in the
   * order they tipped over. Used by the lesson summary to render the
   * `// mastered` chip strip below the stats. Cleared on `reset` /
   * `start` along with the rest of the per-lesson state.
   */
  masteredThisLesson: string[];
  /**
   * B+1.46 session-local relearn queue. Maps termId → how many times it has
   * been re-appended to `terms` after a wrong answer THIS session. The runner
   * re-drills a missed term later in the same lesson (Anki-style "again")
   * instead of letting it vanish for a day. Capped by the caller so a term
   * the user keeps missing doesn't loop forever. Reset on start/reset.
   */
  relearnCount: Record<string, number>;
  /**
   * v0.1 brand — "now use it →" runtime loop. When the user taps the secondary
   * CTA after a correct MC/Fill/Match, this gets set to that term's id. The
   * lesson runner reads it and overrides `pickQuizType` to render `sentence`
   * for that one card, then clears the flag on advance. Idempotent — repeat
   * taps for the same termId are a no-op.
   */
  sentenceModeFor: string | null;
  /**
   * Start a session. `mode` defaults to 'lesson' so existing call sites
   * (home, lesson-summary, what's-new, path-detail) compile unchanged.
   * Pass `mode: 'review'` from /review to flip the runner + summary copy.
   * `pathId` for review sessions is null — review pulls across all paths
   * in the active domain.
   */
  /**
   * Persisted list of session IDs whose summary completion has already been counted.
   * Caps at ~50 session IDs. Outlives reset() / start() calls so a page reload on summary
   * never re-counts XP or lessons completed.
   */
  countedSessionIds: string[];
  markCounted: (sessionId: string) => void;
  hasCounted: (sessionId: string) => boolean;
  start: (pathId: string | null, terms: TermRow[], mode?: LessonMode) => void;
  recordResult: (r: Omit<CardResult, 'timeMs'>) => void;
  advance: () => void;
  /** Re-append a missed term to the end of the lesson for same-session
   *  relearn, bumping its relearn counter. The cap lives in the caller. */
  requeueTerm: (term: TermRow) => void;
  markLearnCardSeen: (termId: string) => void;
  requestSentenceMode: (termId: string) => void;
  clearSentenceMode: () => void;
  /** B+1.6 — record a term that just hit mastery this lesson. Idempotent. */
  recordMastery: (termId: string) => void;
  reset: () => void;
  totals: () => { xp: number; correct: number; total: number; accuracy: number; avgTimeMs: number };
}

/** Use Web Crypto when available, fall back to a Math.random hex blob for jsdom/tests. */
function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useLessonStore = create<LessonState>()(
  persist(
    (set, get) => ({
      active: false,
      pathId: null,
      mode: 'lesson',
      sessionId: '',
      terms: [],
      initialTermsCount: 0,
      currentIndex: 0,
      results: [],
      startedAt: 0,
      cardStartedAt: 0,
      learnCardSeenForTerm: {},
      sentenceModeFor: null,
      masteredThisLesson: [],
      relearnCount: {},
      countedSessionIds: [],

      markCounted: (sessionId: string): void => {
        if (!sessionId) return;
        set((s) => {
          const list = Array.isArray(s.countedSessionIds) ? s.countedSessionIds : [];
          if (list.includes(sessionId)) return s;
          return { countedSessionIds: [...list, sessionId].slice(-50) };
        });
      },

      hasCounted: (sessionId: string): boolean => {
        if (!sessionId) return false;
        const list = get().countedSessionIds;
        return Array.isArray(list) ? list.includes(sessionId) : false;
      },

      start: (pathId: string | null, terms: TermRow[], mode: LessonMode = 'lesson'): void => {
        const validTerms = Array.isArray(terms) ? terms : [];
        const now = Date.now();
        set({
          active: true,
          pathId: pathId ?? null,
          mode,
          sessionId: makeSessionId(),
          terms: validTerms,
          initialTermsCount: validTerms.length,
          currentIndex: 0,
          results: [],
          startedAt: now,
          cardStartedAt: now,
          learnCardSeenForTerm: {},
          sentenceModeFor: null,
          masteredThisLesson: [],
          relearnCount: {},
        });
      },

      recordResult: (r: Omit<CardResult, 'timeMs'>): void => {
        if (!r || !r.termId) return;
        const now = Date.now();
        const cardStartedAt = get().cardStartedAt || now;
        const timeMs = Math.max(0, now - cardStartedAt);
        set((s) => ({
          results: [...s.results, { ...r, timeMs }],
        }));
      },

      advance: (): void => {
        set((s) => ({
          currentIndex: s.currentIndex + 1,
          cardStartedAt: Date.now(),
          // Always clear sentence-mode on advance — the next card is a fresh term
          // and we don't want a stale flag bleeding into it.
          sentenceModeFor: null,
        }));
      },

      requeueTerm: (term: TermRow): void => {
        if (!term || !term.id) return;
        set((s) => ({
          terms: [...s.terms, term],
          relearnCount: { ...s.relearnCount, [term.id]: (s.relearnCount[term.id] ?? 0) + 1 },
        }));
      },

      markLearnCardSeen: (termId: string): void => {
        if (!termId) return;
        set((s) => ({
          learnCardSeenForTerm: { ...s.learnCardSeenForTerm, [termId]: true },
          // Reset the per-card timer so the quiz that follows is timed from the
          // moment the user lands on it, not from when they opened the LearnCard.
          cardStartedAt: Date.now(),
        }));
      },

      requestSentenceMode: (termId: string): void => {
        if (!termId) return;
        set((s) => {
          // Defensive idempotency — repeat taps for the same termId are a no-op so
          // double-taps don't reset the per-card timer or thrash the quiz card.
          if (s.sentenceModeFor === termId) return s;
          return {
            sentenceModeFor: termId,
            // Reset the per-card timer so the sentence card is timed from when it
            // appears, not from the original MC/Fill/Match landing.
            cardStartedAt: Date.now(),
          };
        });
      },

      clearSentenceMode: (): void => {
        set({ sentenceModeFor: null });
      },

      recordMastery: (termId: string): void => {
        if (!termId) return;
        set((s) => {
          // Defensive idempotency — same term shouldn't appear twice even if
          // the runner double-fires (StrictMode, retry path, etc.).
          if (s.masteredThisLesson.includes(termId)) return s;
          return { masteredThisLesson: [...s.masteredThisLesson, termId] };
        });
      },

      reset: (): void => {
        set({
          active: false,
          pathId: null,
          mode: 'lesson',
          sessionId: '',
          terms: [],
          initialTermsCount: 0,
          currentIndex: 0,
          results: [],
          startedAt: 0,
          cardStartedAt: 0,
          learnCardSeenForTerm: {},
          sentenceModeFor: null,
          masteredThisLesson: [],
          relearnCount: {},
        });
      },

      totals: (): { xp: number; correct: number; total: number; accuracy: number; avgTimeMs: number } => {
        const { results } = get();
        const total = results.length;
        const correct = results.filter((r) => r.outcome === 'correct' || r.outcome === 'partial').length;
        const xp = results.reduce((sum, r) => sum + r.xpEarned, 0);
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const avgTimeMs = total > 0 ? Math.round(results.reduce((s, r) => s + r.timeMs, 0) / total) : 0;
        return { xp, correct, total, accuracy, avgTimeMs };
      },
    }),
    {
      name: 'jargon-lesson-session',
      // Real localStorage in the browser so an interrupted lesson resumes; an
      // ephemeral in-memory store under vitest (MODE==='test') — real
      // localStorage bled state across tests and stalled the parallel suite.
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') return localStorage;
        const mem = new Map<string, string>();
        return {
          getItem: (k) => mem.get(k) ?? null,
          setItem: (k, v) => {
            mem.set(k, v);
          },
          removeItem: (k) => {
            mem.delete(k);
          },
        };
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!Array.isArray(state.countedSessionIds)) {
          state.countedSessionIds = [];
        }
        if (state.active) {
          const isCorrupt =
            !Array.isArray(state.terms) ||
            state.terms.length === 0 ||
            typeof state.currentIndex !== 'number' ||
            state.currentIndex < 0 ||
            !state.sessionId ||
            !state.terms.every((t) => t && typeof t === 'object' && typeof t.id === 'string');
          if (isCorrupt) {
            state.reset();
          }
        }
      },
      partialize: (state) => ({
        active: state.active,
        pathId: state.pathId,
        mode: state.mode,
        sessionId: state.sessionId,
        terms: state.terms,
        initialTermsCount: state.initialTermsCount,
        currentIndex: state.currentIndex,
        results: state.results,
        startedAt: state.startedAt,
        learnCardSeenForTerm: state.learnCardSeenForTerm,
        masteredThisLesson: state.masteredThisLesson,
        relearnCount: state.relearnCount,
        sentenceModeFor: state.sentenceModeFor,
        countedSessionIds: Array.isArray(state.countedSessionIds) ? state.countedSessionIds : [],
      }),
    }
  )
);

