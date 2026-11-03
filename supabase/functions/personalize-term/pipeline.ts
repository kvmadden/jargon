// The personalize-term pass sequence, shared by the Edge Function and the
// offline eval.
//
// Before v10 the sequence lived inline in index.ts and was copied by hand into
// eval/run-personalize-eval.ts, so "the eval measures the shipped path" rested
// on the copy staying in sync. Both now call runPersonalization() with their
// own model transport. Unit tests drive it with a fake model.
//
// Sequence:
//   Pass 1 generate → Pass 2 verify → claim gate
//     accept only when the verifier's criteria all pass (computed in code,
//     not read from the model's `overall` string) AND the claim gate passes.
//   otherwise one regeneration (Pass 3) with the verifier and gate feedback,
//   then Pass 2 again and the gate again.
//   A rewrite that still carries claims the gate cannot verify is HELD for
//   human review and the learner sees the canonical text.
//
// Pure module: no Deno globals, no network imports.

import {
  PERSONALIZE_MODEL,
  RENDERING_FIELD_MAX_CHARS,
  PERSONALIZE_MAX_RETRIES,
  PERSONALIZE_MAX_TOKENS_PASS1,
  PERSONALIZE_MAX_TOKENS_PASS2,
  PERSONALIZE_MAX_TOKENS_PASS3,
  PASS2_SYSTEM_PROMPT,
  buildFailedCriteriaBlock,
  buildPass1UserMessage,
  buildPass2UserMessage,
  buildPass3UserMessage,
  estimatePersonalizeCost,
  parseRendering,
  parseVerdict,
  pass1SystemPrompt,
  pass3SystemPrompt,
} from './prompts.ts';
import type { KnownVocabulary, ParsedRendering, TermRow, UserProfileRow, VerifierVerdict } from './prompts.ts';
import { checkRendering, gateFeedbackBlock } from './claim-gate.ts';
import type { ApprovedAnalogy, GateResult } from './claim-gate.ts';
import type { TokenUsage } from '../_shared/pricing.ts';
import { worstCaseCallUsd } from '../_shared/cycle-budget.ts';

/**
 * Every final_status personalize-term can write. The personalize_log CHECK
 * constraint (supabase/migrations/20261103000000_personalize_log_v10.sql) must
 * list exactly these, or a row is rejected with 23514 and the log write is
 * lost. A test compares the two lists.
 */
export const FINAL_STATUSES = [
  'cached',
  'held-needs-review',
  'fallback-format',
  'fallback-no-profile',
  'fallback-pass1-parse',
  'fallback-pass2-parse',
  'fallback-pass2-fail',
  'fallback-pass3-parse',
  'fallback-pass2-retry-fail',
  'fallback-anthropic-error',
  'fallback-timeout',
  'skipped-over-cap',
  'cache-hit',
  'skipped-recent-fallback',
] as const;

export type FinalStatus = (typeof FINAL_STATUSES)[number];

export type PassName = 'pass1' | 'pass2' | 'pass3' | 'pass2_retry';

export interface ModelRequest {
  pass: PassName;
  system: string;
  user: string;
  maxTokens: number;
}

export interface ModelReply {
  rawText: string;
  /** null when the response carried no usage. The call is then priced at its worst case. */
  usage: TokenUsage | null;
  stopReason: string | null;
  latencyMs: number;
}

/** Transport for one model call. Throws on network, HTTP or timeout failure. */
export type CallModel = (request: ModelRequest) => Promise<ModelReply>;

export interface PassRecord extends ModelReply {
  pass: PassName;
  costUsd: number;
  /** True when the response had no usage and costUsd is the call's worst case. */
  usageMissing: boolean;
}

export interface PersonalizationInput {
  term: TermRow;
  profile: UserProfileRow;
  knownVocabulary: KnownVocabulary;
  approvedAnalogies?: readonly ApprovedAnalogy[];
  /** Override for tests. Production uses PERSONALIZE_MAX_RETRIES (1). */
  maxRetries?: number;
}

export interface PersonalizationOutcome {
  status: FinalStatus;
  /** The rewrite to show and cache. Non-null only when status is 'cached'. */
  accepted: ParsedRendering | null;
  /** True when a rewrite was held because of claims the gate cannot verify. */
  needsReview: boolean;
  /** Canonical statements the verifier disputed, on any pass. They go to review whether or not the rewrite is shown. */
  canonicalReview: string[];
  pass1Candidate: ParsedRendering | null;
  pass1Verdict: VerifierVerdict | null;
  pass1Gate: GateResult | null;
  retryCandidate: ParsedRendering | null;
  retryVerdict: VerifierVerdict | null;
  retryGate: GateResult | null;
  passes: PassRecord[];
  costUsd: number;
  errorText: string | null;
}

const TIMEOUT_ERROR_NAMES = new Set(['AbortError', 'TimeoutError', 'APIUserAbortError', 'APIConnectionTimeoutError']);
const TIMEOUT_MESSAGE = /^(?:timeout after \d+ ?ms|request (?:was aborted|timed out)\.?|the operation was aborted\.?)$/i;

/**
 * True for an aborted or timed-out call, in the Deno SDK or in the eval's
 * fetch transport. It reads the error name, and only whole known timeout
 * messages, so an API error that merely mentions "timeout" is not one.
 */
export function isTimeoutError(err: unknown): boolean {
  const e = err as { name?: unknown; message?: unknown } | null;
  const name = typeof e?.name === 'string' ? e.name : '';
  const message = typeof e?.message === 'string' ? e.message.trim() : '';
  return TIMEOUT_ERROR_NAMES.has(name) || TIMEOUT_MESSAGE.test(message);
}

/** Longest feedback block the regeneration prompt gets. The eval's worst-case budget uses it as a bound. */
export const RETRY_FEEDBACK_MAX_CHARS = 8000;

function verdictPasses(v: VerifierVerdict): boolean {
  return v.overall === 'pass';
}

function retryFeedback(verdict: VerifierVerdict, gate: GateResult): string {
  const parts: string[] = [];
  if (!verdictPasses(verdict)) parts.push(buildFailedCriteriaBlock(verdict));
  const gateBlock = gateFeedbackBlock(gate);
  if (gateBlock) parts.push(gateBlock);
  const block = parts.length > 0 ? parts.join('\n') : '- (no specific failure captured; recheck every criterion)';
  return block.length > RETRY_FEEDBACK_MAX_CHARS ? block.slice(0, RETRY_FEEDBACK_MAX_CHARS) : block;
}

/** Status for a rewrite that ends without being accepted. Held claims take precedence. */
function rejectionStatus(verdict: VerifierVerdict, gate: GateResult, retried: boolean): FinalStatus {
  if (gate.decision === 'needs_review') return 'held-needs-review';
  if (!verdictPasses(verdict)) return retried ? 'fallback-pass2-retry-fail' : 'fallback-pass2-fail';
  return 'fallback-format';
}

/**
 * Upper bound on one request's cost at list price: Pass 1, Pass 2, Pass 3 and
 * the Pass 2 re-run, each with the longest prompt it can have. A parsed field
 * is at most RENDERING_FIELD_MAX_CHARS characters of at most 4 UTF-8 bytes, and
 * the regeneration feedback is cut at RETRY_FEEDBACK_MAX_CHARS. The Edge
 * Function checks this against the spend caps before it starts, and the eval
 * reserves it per item.
 */
export function worstCaseRequestUsd(term: TermRow, profile: UserProfileRow, kv: KnownVocabulary): number {
  const big = 'x'.repeat(RENDERING_FIELD_MAX_CHARS * 4);
  const maxCandidate: ParsedRendering = { long_definition: big, why_it_matters: big, example_in_sentence: big };
  const domain = term.domain ?? 'coding';
  const pass1 = worstCaseCallUsd(PERSONALIZE_MODEL, pass1SystemPrompt(domain) + buildPass1UserMessage(term, profile, kv), PERSONALIZE_MAX_TOKENS_PASS1);
  const pass2 = worstCaseCallUsd(PERSONALIZE_MODEL, PASS2_SYSTEM_PROMPT + buildPass2UserMessage(term, maxCandidate, profile, kv), PERSONALIZE_MAX_TOKENS_PASS2);
  const pass3 = worstCaseCallUsd(
    PERSONALIZE_MODEL,
    pass3SystemPrompt(domain) + buildPass3UserMessage(term, profile, maxCandidate, 'x'.repeat(RETRY_FEEDBACK_MAX_CHARS * 4), kv),
    PERSONALIZE_MAX_TOKENS_PASS3,
  );
  return pass1 + pass2 + pass3 + pass2;
}

export async function runPersonalization(
  input: PersonalizationInput,
  callModel: CallModel,
): Promise<PersonalizationOutcome> {
  const { term, profile, knownVocabulary, approvedAnalogies = [] } = input;
  const maxRetries = input.maxRetries ?? PERSONALIZE_MAX_RETRIES;
  const out: PersonalizationOutcome = {
    status: 'fallback-anthropic-error',
    accepted: null,
    needsReview: false,
    canonicalReview: [],
    pass1Candidate: null,
    pass1Verdict: null,
    pass1Gate: null,
    retryCandidate: null,
    retryVerdict: null,
    retryGate: null,
    passes: [],
    costUsd: 0,
    errorText: null,
  };

  async function call(request: ModelRequest): Promise<ModelReply> {
    const reply = await callModel(request);
    // A response without usage is priced at the call's worst case, so the
    // spend log and the caps never count it as free.
    const usageMissing = !reply.usage || !((reply.usage.input_tokens ?? 0) > 0 || (reply.usage.output_tokens ?? 0) > 0);
    const costUsd = usageMissing
      ? worstCaseCallUsd(PERSONALIZE_MODEL, request.system + request.user, request.maxTokens)
      : estimatePersonalizeCost(reply.usage!);
    out.passes.push({ ...reply, pass: request.pass, costUsd, usageMissing });
    out.costUsd += costUsd;
    return reply;
  }

  function fail(status: FinalStatus, errorText: string | null): PersonalizationOutcome {
    out.status = status;
    out.errorText = errorText;
    return out;
  }

  function failFromError(pass: PassName, err: unknown): PersonalizationOutcome {
    const message = (err as { message?: unknown } | null)?.message;
    return fail(
      isTimeoutError(err) ? 'fallback-timeout' : 'fallback-anthropic-error',
      `${pass}: ${typeof message === 'string' ? message : String(err)}`,
    );
  }

  function gate(candidate: ParsedRendering, verdict: VerifierVerdict): GateResult {
    return checkRendering({ term, rendering: candidate, profile, verdict, approvedAnalogies });
  }

  // ─── Pass 1: generate ───────────────────────────────────────────────────────
  let reply: ModelReply;
  try {
    reply = await call({
      pass: 'pass1',
      system: pass1SystemPrompt(term.domain),
      user: buildPass1UserMessage(term, profile, knownVocabulary),
      maxTokens: PERSONALIZE_MAX_TOKENS_PASS1,
    });
  } catch (err) {
    return failFromError('pass1', err);
  }
  out.pass1Candidate = reply.rawText ? parseRendering(reply.rawText) : null;
  if (!out.pass1Candidate) return fail('fallback-pass1-parse', `pass1 unparseable: ${reply.rawText.slice(0, 200)}`);
  const candidate1 = out.pass1Candidate;

  // ─── Pass 2: verify, then the claim gate ───────────────────────────────────
  try {
    reply = await call({
      pass: 'pass2',
      system: PASS2_SYSTEM_PROMPT,
      user: buildPass2UserMessage(term, candidate1, profile, knownVocabulary),
      maxTokens: PERSONALIZE_MAX_TOKENS_PASS2,
    });
  } catch (err) {
    return failFromError('pass2', err);
  }
  out.pass1Verdict = reply.rawText ? parseVerdict(reply.rawText) : null;
  if (!out.pass1Verdict) return fail('fallback-pass2-parse', `pass2 unparseable: ${reply.rawText.slice(0, 200)}`);
  const verdict1 = out.pass1Verdict;
  out.pass1Gate = gate(candidate1, verdict1);
  if (out.pass1Gate.decision === 'needs_review') out.needsReview = true;
  out.canonicalReview.push(...out.pass1Gate.canonicalReview);

  if (verdictPasses(verdict1) && out.pass1Gate.decision === 'pass') {
    out.status = 'cached';
    out.accepted = candidate1;
    return out;
  }
  if (maxRetries < 1) return fail(rejectionStatus(verdict1, out.pass1Gate, false), null);

  // ─── Pass 3: regenerate with the combined feedback ─────────────────────────
  try {
    reply = await call({
      pass: 'pass3',
      system: pass3SystemPrompt(term.domain),
      user: buildPass3UserMessage(term, profile, candidate1, retryFeedback(verdict1, out.pass1Gate), knownVocabulary),
      maxTokens: PERSONALIZE_MAX_TOKENS_PASS3,
    });
  } catch (err) {
    return failFromError('pass3', err);
  }
  out.retryCandidate = reply.rawText ? parseRendering(reply.rawText) : null;
  if (!out.retryCandidate) return fail('fallback-pass3-parse', `pass3 unparseable: ${reply.rawText.slice(0, 200)}`);
  const candidate2 = out.retryCandidate;

  // ─── Pass 2 again on the regenerated rewrite ───────────────────────────────
  try {
    reply = await call({
      pass: 'pass2_retry',
      system: PASS2_SYSTEM_PROMPT,
      user: buildPass2UserMessage(term, candidate2, profile, knownVocabulary),
      maxTokens: PERSONALIZE_MAX_TOKENS_PASS2,
    });
  } catch (err) {
    return failFromError('pass2_retry', err);
  }
  out.retryVerdict = reply.rawText ? parseVerdict(reply.rawText) : null;
  if (!out.retryVerdict) {
    return fail('fallback-pass2-retry-fail', `pass2-retry unparseable: ${reply.rawText.slice(0, 200)}`);
  }
  const verdict2 = out.retryVerdict;
  out.retryGate = gate(candidate2, verdict2);
  for (const c of out.retryGate.canonicalReview) if (!out.canonicalReview.includes(c)) out.canonicalReview.push(c);

  if (verdictPasses(verdict2) && out.retryGate.decision === 'pass') {
    // The accepted retry carries no held claim, so it is shown, even if Pass 1 had one.
    out.needsReview = false;
    out.status = 'cached';
    out.accepted = candidate2;
    return out;
  }
  out.needsReview = out.needsReview || out.retryGate.decision === 'needs_review';
  return fail(rejectionStatus(verdict2, out.retryGate, true), null);
}
