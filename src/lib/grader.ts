// Sentence-quiz grader — Stage B1: server-side via Supabase Edge Function.
//
// The Anthropic SDK no longer runs in the browser. This module POSTs to the
// `grade-sentence` Edge Function with the user's session JWT, and the function
// runs Opus 4.7 against the same verbatim grader prompt that lived here in Stage A.
//
// 10 codified edge cases (server is authoritative; client pre-checks 1–3 to save calls):
//   1. Empty / whitespace only       → fail (0)        — local precheck
//   2. One word                      → fail (0)        — local precheck
//   3. Verbatim copy of example      → fail (0)        — local precheck
//   4. Coherent metaphor / creative  → pass if meaning preserved
//   5. Adjacent sense (close-but-no) → partial (40-79)
//   6. Off-topic, term not used      → fail (0)
//   7. Prompt injection ("ignore...") → fail with neutral feedback
//   8. Other-language usage          → grade by meaning, not language
//   9. Offensive content             → fail with neutral redirect
//  10. Grader timeout / API error    → fallback partial (12 XP) so user is never stuck

import { supabase } from './supabase';
import type { TermRow } from './database.types';

export type GradeTier = 'pass' | 'partial' | 'fail';

export interface GradeResult {
  tier: GradeTier;
  score: number; // 0-100
  feedback: string;
  isFallback?: boolean;
}

/** Quick local pre-checks for the obvious edge cases — saves an Edge Function call. */
function localPrecheck(term: TermRow, answer: string): GradeResult | null {
  if (!term || typeof term.example_in_sentence !== 'string') {
    return { tier: 'fail', score: 0, feedback: 'Invalid term structure.' };
  }
  if (typeof answer !== 'string') {
    return { tier: 'fail', score: 0, feedback: 'Try writing a full sentence.' };
  }
  const trimmed = answer.trim();
  if (trimmed.length === 0) {
    return { tier: 'fail', score: 0, feedback: 'Try writing a full sentence.' };
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2) {
    return { tier: 'fail', score: 0, feedback: 'Try a full sentence — at least a subject and a verb.' };
  }
  if (trimmed.toLowerCase() === term.example_in_sentence.toLowerCase()) {
    return { tier: 'fail', score: 0, feedback: 'Use your own words to show you understand.' };
  }
  return null;
}

/** Hard upper bound on the grader call — see DESIGN.md §4 motion (6s/12s/30s). */
const GRADER_TIMEOUT_MS = 30_000;

/** Build the Edge Function URL from the configured Supabase project. */
function functionUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/functions/v1/grade-sentence`;
}

interface GradeResponseBody {
  tier?: string;
  score?: number;
  feedback?: string;
  isFallback?: boolean;
  error?: string;
}

function isGradeResult(body: GradeResponseBody): body is GradeResponseBody & GradeResult {
  return (
    (body.tier === 'pass' || body.tier === 'partial' || body.tier === 'fail') &&
    typeof body.score === 'number' &&
    typeof body.feedback === 'string'
  );
}

/** Grade a learner sentence against a term. Always resolves — never throws. */
export async function gradeSentence(term: TermRow, answer: string): Promise<GradeResult> {
  const pre = localPrecheck(term, answer);
  if (pre) return pre;

  // Need a live session to authorize the Edge Function call.
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData?.session?.access_token;
  if (!jwt) {
    return {
      tier: 'partial',
      score: 50,
      feedback: 'Grader unavailable — sign in to get a real evaluation.',
      isFallback: true,
    };
  }

  // AbortController-backed 30s timeout — matches client expectation and lets the
  // underlying fetch actually cancel (vs. the Stage A Promise.race that left
  // the SDK call running in the background).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRADER_TIMEOUT_MS);

  try {
    const res = await fetch(functionUrl(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        term: term.term,
        oneLineDefinition: term.one_line_definition,
        exampleInSentence: term.example_in_sentence,
        userSubmission: answer,
        // B+1.5.1: pass the term's domain so the Edge Function templates
        // the right vocabulary description into the grader system prompt.
        // Default to 'coding' for legacy term rows that predate B+1.5
        // migration 018 (which backfilled all rows with 'coding' anyway).
        domain: term.domain ?? 'coding',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let body: GradeResponseBody;
    try {
      body = (await res.json()) as GradeResponseBody;
    } catch {
      return {
        tier: 'partial',
        score: 50,
        feedback: 'Grader returned an unexpected response; gave you partial credit.',
        isFallback: true,
      };
    }

    if (!res.ok || !isGradeResult(body)) {
      return {
        tier: 'partial',
        score: 50,
        feedback: 'Grader timed out — gave you partial credit so you can keep moving.',
        isFallback: true,
      };
    }

    return {
      tier: body.tier,
      score: Math.max(0, Math.min(100, Math.round(body.score))),
      feedback: body.feedback,
      isFallback: body.isFallback,
    };
  } catch (err) {
    clearTimeout(timer);
    // eslint-disable-next-line no-console
    console.error('[grader] error:', err);
    return {
      tier: 'partial',
      score: 50,
      feedback: 'Grader timed out — gave you partial credit so you can keep moving.',
      isFallback: true,
    };
  }
}
