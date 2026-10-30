// Domain → Goal A / Goal B frame, for Edge-Function prompt substitution.
//
// Mirror of `src/lib/domains.ts` `DOMAIN_META[*].goalDescription`. Edge
// Functions can't import the TS-side registry (different runtime, different
// module system), so we duplicate the small lookup here.
//
// HARD RULE: when you add a domain to `src/lib/domains.ts`, you MUST add
// the matching entry here. The pre-deploy script gate-7 ("domain
// vocabulary sync") was extended in B+1.5.3 to also check goalDescription
// drift across both sides — fails the deploy if any domain's goal text
// differs between TS and Deno.
//
// Where the substitution lands: ingest-terms Pass 1 (candidate generator
// — what kind of terms to draft) + Pass 3 (relevance verifier — does this
// term plausibly land in a user's daily life). When ingest-terms gets
// invoked with a `domain` parameter, the prompt builders pull the
// matching Goal A/B frame from this lookup.

const GOALS_BY_DOMAIN: Record<string, string> = {
  coding: `Goal A: Follow Claude Code in real time — recognize words like rebase, monorepo, context window, RAG, idempotent that appear mid-CLI session
Goal B: Talk to coding-masters family members — drop tool call, embedding, sprint retro, feature flag, blast radius into family text threads naturally`,
  // B+1.9 — practitioner-flavored goals. Same two-line shape so the
  // ingest-terms Pass 1 + Pass 3 prompts substitute uniformly.
  ai: `Goal A: Follow modern AI in real time — recognize words like RAG, embedding, agent, fine-tuning, hallucination as they come up in articles, tools, and product launches
Goal B: Talk shop with engineers and AI-builders — drop tool call, context window, prompt engineering, retrieval into conversations naturally`,
};

const DEFAULT = GOALS_BY_DOMAIN.coding;

/**
 * Returns the Goal A / Goal B paragraph for a domain. Falls back to
 * coding's Goals for unknown domains so the prompt stays coherent even
 * if a new term row carries an unregistered domain value.
 */
export function goalDescription(domain: string | null | undefined): string {
  if (!domain) return DEFAULT;
  return GOALS_BY_DOMAIN[domain] ?? DEFAULT;
}
