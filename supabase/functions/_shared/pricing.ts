// One price table for every model call jargon makes.
//
// Before this module, six files carried their own per-model constants. The
// Opus 4.7 rate in all six was $15 / $75 per million tokens, three times the
// list price, and none of them counted prompt-cache tokens. The spend guard
// reads the logged figures, so the monthly caps tripped at about a third of the
// intended spend, and the offline eval's $10 budget guard stopped the
// 2026-10-30 run at 79 of 120 planned items.
//
// Pure module: no Deno globals, no network imports. The Edge Functions, the
// offline eval and the unit tests all import it.

/** List prices in USD per million tokens. Checked on PRICES_CHECKED_ON. */
export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

export const PRICES_CHECKED_ON = '2026-11-03';

/**
 * Anthropic first-party list prices for the models this project calls, and the
 * OpenAI embedding model used by ingest-terms. Gemini image generation is
 * priced per image in `_shared/lived-icon-generation.ts` and is not listed here.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'claude-opus-4-7': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
  'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
  'text-embedding-3-small': { inputPerMTok: 0.02, outputPerMTok: 0 },
};

/** Prompt-cache writes bill at 1.25x the input rate, reads at 0.1x. */
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

/** Token counts as the Anthropic Messages API reports them in `usage`. */
export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface PriceLookup {
  price: ModelPrice;
  /** False when the model is not in the table and the most expensive known price was used. */
  known: boolean;
}

const MOST_EXPENSIVE: ModelPrice = Object.values(MODEL_PRICES).reduce(
  (max, p) => (p.inputPerMTok + p.outputPerMTok > max.inputPerMTok + max.outputPerMTok ? p : max),
);

/**
 * Price for a model. An unknown model gets the most expensive known price, so a
 * spend guard that reads the result can only overcount, never undercount.
 */
export function priceFor(model: string): PriceLookup {
  const price = MODEL_PRICES[model];
  if (price) return { price, known: true };
  return { price: MOST_EXPENSIVE, known: false };
}

function tokens(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** USD cost of one call, including prompt-cache writes and reads. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const { price } = priceFor(model);
  const perToken = price.inputPerMTok / 1_000_000;
  const outPerToken = price.outputPerMTok / 1_000_000;
  return (
    tokens(usage.input_tokens) * perToken +
    tokens(usage.cache_creation_input_tokens) * perToken * CACHE_WRITE_MULTIPLIER +
    tokens(usage.cache_read_input_tokens) * perToken * CACHE_READ_MULTIPLIER +
    tokens(usage.output_tokens) * outPerToken
  );
}

/** Round to 5 decimal places, the precision of the `numeric(8,5)` log columns. */
export function roundUsd(usd: number): number {
  return Math.round(usd * 100_000) / 100_000;
}

/**
 * Read the usage fields off an Anthropic response object. Missing fields are 0.
 * Never throws: a malformed response yields zero usage, which callers log as-is.
 */
export function usageFromResponse(response: unknown): Required<{ [K in keyof TokenUsage]: number }> {
  const u = (response as { usage?: TokenUsage } | null | undefined)?.usage ?? {};
  return {
    input_tokens: tokens(u.input_tokens),
    output_tokens: tokens(u.output_tokens),
    cache_creation_input_tokens: tokens(u.cache_creation_input_tokens),
    cache_read_input_tokens: tokens(u.cache_read_input_tokens),
  };
}

/**
 * Logged cost of one response, rounded for the log columns. Returns null when
 * the response carries no `usage` object at all, so a log row records
 * "unknown" rather than a misleading $0.
 */
export function costFromResponse(model: string, response: unknown): number | null {
  const usage = (response as { usage?: unknown } | null | undefined)?.usage;
  if (!usage || typeof usage !== 'object') return null;
  return roundUsd(estimateCostUsd(model, usageFromResponse(response)));
}
