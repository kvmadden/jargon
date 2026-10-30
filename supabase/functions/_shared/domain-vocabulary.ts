// Domain → vocabulary description, for Edge-Function prompt substitution.
//
// Mirror of `src/lib/domains.ts` `DOMAIN_META[*].vocabularyDescription`.
// Edge Functions can't import the TS-side registry (different runtime,
// different module system), so we duplicate the small lookup here.
//
// HARD RULE: when you add a domain to `src/lib/domains.ts`, you MUST add
// the matching entry here. Otherwise the Edge Function's prompt will
// fall back to 'coding' for the new domain — Opus would be told it's
// teaching the wrong vocabulary, the verifier would still pass on
// structural grounds, and the user would get subtly wrong renderings
// across the new domain.
//
// The pre-deploy script (`scripts/pre-deploy.mjs`) gates drift via gate
// 7 ("domain vocabulary sync"): greps both this file and src/lib/domains.ts
// DOMAIN_META, fails the deploy if any domain key is missing on one side
// or if the vocabulary string differs. Run `npm run pre-deploy` to verify.

const VOCABULARY_BY_DOMAIN: Record<string, string> = {
  // VERBATIM match for the pre-templating literal: "dev/AI/enterprise
  // software vocabulary" (no spaces around the slashes). The Pass 1 +
  // grade-sentence prompts append " vocabulary" after this string, so
  // changing the spacing here would shift the prompt content even though
  // the cache key invalidates via PROMPT_VERSION.
  coding: 'dev/AI/enterprise software',
  // B+1.9 — AI domain registered. Practitioner audience (non-engineer):
  // PMs, analysts, clinicians, managers using AI tools without building
  // them. Same prompt-template suffix appends " vocabulary."
  ai: 'modern AI tools and concepts',
};

const DEFAULT = 'dev/AI/enterprise software';

/**
 * Returns the noun phrase that goes inside Opus system prompts where the
 * old hardcoded string was "dev/AI/enterprise software vocabulary." Falls
 * back to the coding description for unknown domains so the prompt stays
 * coherent even if a new term row carries an unregistered domain value.
 */
export function vocabularyDescription(domain: string | null | undefined): string {
  if (!domain) return DEFAULT;
  return VOCABULARY_BY_DOMAIN[domain] ?? DEFAULT;
}
