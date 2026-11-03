// Per-run budget for batch jobs that are exempt from the per-user spend cap
// (ingest-terms). Before each model call, or each item that makes several,
// the job checks that the spend so far plus the worst case of what it is about
// to do stays within the budget. Anything else stops the run.

import { CACHE_WRITE_MULTIPLIER, priceFor } from './pricing.ts';

/**
 * Upper bound on one call's cost at list price. A tokenizer token is at least
 * one byte, so the UTF-8 byte length of the prompt bounds its input tokens.
 * Every input token is priced as a cache write (the dearest input rate), and
 * the output at the full max_tokens.
 */
export function worstCaseCallUsd(model: string, promptText: string, maxOutputTokens: number): number {
  const { price } = priceFor(model);
  const inputTokens = new TextEncoder().encode(promptText).length;
  return (
    (inputTokens * price.inputPerMTok * CACHE_WRITE_MULTIPLIER + maxOutputTokens * price.outputPerMTok) / 1_000_000
  );
}

export class RunBudget {
  readonly limitUsd: number;
  private spent = 0;

  constructor(limitUsd: number) {
    // A missing, negative or non-numeric limit allows nothing.
    this.limitUsd = Number.isFinite(limitUsd) && limitUsd > 0 ? limitUsd : 0;
  }

  get spentUsd(): number {
    return this.spent;
  }

  /** True when the spend so far plus this worst case stays within the limit. */
  canAfford(worstCaseUsd: number): boolean {
    if (!Number.isFinite(worstCaseUsd) || worstCaseUsd < 0) return false;
    return this.spent + worstCaseUsd <= this.limitUsd;
  }

  record(costUsd: number): void {
    // An unreadable cost counts as the whole remaining budget, so it stops the run.
    this.spent += Number.isFinite(costUsd) && costUsd >= 0 ? costUsd : this.limitUsd;
  }
}

/** Reads a budget in dollars from an env value, falling back to the default. */
export function budgetFromEnv(raw: string | undefined, fallbackUsd: number): number {
  if (raw === undefined || raw.trim() === '') return fallbackUsd;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
