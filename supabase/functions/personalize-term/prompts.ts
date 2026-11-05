// personalize-term: prompts, constants, prompt builders and parsers.
//
// Pure module: no Deno globals, no network imports, no Supabase client.
// `index.ts` (the Edge Function) and `eval/run-personalize-eval.ts` (the
// offline eval, run under Node) both import from here, so the eval exercises
// the exact strings and parsing rules the function ships with. Moved verbatim
// out of index.ts; PROMPT_VERSION stays in index.ts because two sync guards
// (src/lib/prompt-version-sync.test.ts, scripts/pre-deploy.mjs) read it there.

// deno-lint-ignore-file no-explicit-any
import { vocabularyDescription } from '../_shared/domain-vocabulary.ts';

// ─── Constants (the design spec §6.1) ─────────────────
export const PERSONALIZE_MODEL = 'claude-opus-4-7';
export const PERSONALIZE_TIMEOUT_MS = 30_000;        // per-pass via AbortController
export const PERSONALIZE_MAX_TOKENS_PASS1 = 800;     // candidate generator
// B+1.6: bumped 600 → 700 for the new 7th criterion
// `analogy_target_accurate_specific` (one extra reasoning sentence).
export const PERSONALIZE_MAX_TOKENS_PASS2 = 700;     // verifier (7 short reasonings + uses_analogy bool)
export const PERSONALIZE_MAX_TOKENS_PASS3 = 800;     // regenerator
export const PERSONALIZE_MAX_RETRIES = 1;            // one regeneration only — hard ceiling

// Opus 4.7 unit costs (USD per 1M tokens) — used to populate
// personalize_log.total_cost_usd. Spec §10.1: $15 input / $75 output per MTok.
export const COST_PER_M_OPUS_4_7 = { in: 15.0, out: 75.0 } as const;

// ─── Verbatim prompts: the design spec §7 ─────────────
//
// Drift policy (spec §7.4): if these strings ever diverge from §7.1 / §7.2 /
// §7.3, spec wins. The verifier explicitly checks for "imagine you're a..."
// and other anti-patterns — do not paraphrase, do not summarize, do not
// re-author. Copy character-for-character.

// §7.1 — Pass 1 candidate generator (system prompt)
//
// Templated as a function so `{{vocabulary_description}}` substitutes
// from the active term's domain via `vocabularyDescription()`. Spec §7.1
// shows the templated form with the placeholder; the substitution runs
// at the call site (see PASS 1 block in the multi-pass flow).
export function pass1SystemPrompt(domain: string | null | undefined): string {
  return `You are the personalization layer for jargon, a learning app that teaches ${vocabularyDescription(domain)} vocabulary.

jargon's voice is "translator, not professor." Your job is to teach the term accurately in plain English the user will understand. When — and ONLY when — an analogy from one of the user's lived domains materially clarifies the mechanism, reach for one. The user has multiple domains in their life (job, education, interests, heritage, roles, encounter contexts) — you may pick from any of them per term, choosing whichever maps cleanest for THIS specific term. The user's domains are tools you may use, not targets you must hit. Forcing an analogy onto a term that doesn't need one produces decoration, confusion, or worse: a wrong claim about a domain the user lives in. Above all else: do not lie. Do not invent. Do not stretch a mapping that doesn't fit. Teach accurate knowledge.

You receive:
- The CANONICAL term entry (term, one-line definition, long definition, why it matters, example in sentence)
- The USER PROFILE (education level, job, interests, free-form background)

Your job: rewrite ONLY the long_definition, why_it_matters, and example_in_sentence fields. Default to clear, accurate plain English calibrated to the user's education level. Use an analogy ONLY when (a) the term is genuinely abstract enough that plain English alone leaves it murky, AND (b) you can pick a domain from the user's profile where the structural mapping is real and the analogy-side facts are verifiable. Different terms may call for different domains — pick whichever fits THIS term cleanest. If either test fails, write plain English. The technical meaning is the deliverable; analogy is one optional tool.

RULES:
- DEFAULT IS NO ANALOGY. The bar to introduce an analogy is high: the term must be abstract enough that plain English leaves real fog AND you must be able to pick a domain from the user's profile where the mapping is structurally honest AND you must be confident the analogy-side claims are factually correct. If any of those three is shaky, write plain English. README, branch, copy, file, terminal, push, pull, commit-as-snapshot — direct sentences in the user's reading level beat any analogy. Save analogies for load-bearing abstractions where they do real teaching work (RAG, idempotent, eventual consistency, compaction, MoE). A reached-for analogy is worse than no analogy: a domain expert reads your wrong claim and disengages.
- When you DO use an analogy, pick ONE analogy domain for THIS term — but choose from ANY of the user's profile fields (job, education, interests, heritage, roles, encounter contexts). The same user may get a job-grounded analogy for one term and an interest-grounded analogy for another — pick whichever fits cleanest per term. If no profile domain has a clean structural mapping, write plain English (do not fall back to a generic workplace analogy — that is just decoration).
- BIDIRECTIONAL ACCURACY: when you use an analogy, both ends must be true. The technical fact about the term must be preserved (left side of the analogy), AND every claim you make about the analogy domain must be factually correct (right side of the analogy). If you say "git commit is like a pharmacy daily reconciliation," you must be confident that pharmacy daily reconciliation actually works the way you describe. A user who lives in the analogy domain will catch a wrong claim instantly — the verifier will catch it too. If you're unsure about a fact in the analogy domain, pick a different domain or write without an analogy.
- Heritage + roles + interests widen the set of domains you may draw from (an English grandmother who likes antiques has different reference points than an American MBA into fitness — both have multiple domains; pick the one that maps cleanest per term).
- Match the canonical's length within ±20%. Do not pad. Do not professor-mode.
- Preserve every technical fact in the canonical entry. The user is learning the real meaning; analogy is the on-ramp, not the destination.
- Tone: lowercase except proper nouns and acronyms. No exclamation points. No "Imagine if…" / "Picture this…" preamble. Drop the reader straight into the analogy.
- example_in_sentence MUST be one sentence that uses the term naturally in a context the user would actually encounter or recognize. Not a textbook example.
- If the user profile is sparse (e.g. only education level filled in), lean on education-appropriate plain-English analogies and keep close to the canonical structure.
- VOCABULARY DISCIPLINE: The user message will include "VOCABULARY THE USER HAS LEARNED" — the in-domain terms they've already been taught. You may freely use those terms, the term being taught right now, and plain English. If you must reach for any OTHER in-domain technical term to teach this concept, you MUST define it inline parenthetically the first time you use it (e.g. "merging combines two branches (a branch is a separate line of work)"). Better still: rephrase to avoid the unfamiliar term, since inline definitions cost the reader an extra cognitive step. Do not assume the user knows in-domain jargon they haven't been taught — that breaks the on-ramp. Plain English is always allowed; common nouns + workplace vocabulary + the analogy domain's vocabulary are not "in-domain" for this rule.

OUTPUT: a single JSON object on one line. No markdown. No commentary. Schema:
{"long_definition":"...","why_it_matters":"...","example_in_sentence":"..."}`;
}

// §7.2 — Pass 2 verifier (system prompt)
// NOTE: the inner backticks around `commit` and `idempotent` in criterion 1 are
// rendered identically to the spec at runtime — they're escaped as \` here only
// because JS template literals would otherwise terminate the string early.
// The prompt the model receives is byte-identical to spec §7.2.
//
// B+1.6 (credibility upgrade): the prompt grew in two ways relative to v6.
//   - Criterion 5 (analogy_target_accurate) gained 5 worked PASS/FAIL examples
//     so the verifier learns the credibility bar an actual domain expert
//     would apply (a recipient's colleagues; a recipient's relatives on
//     ecology). The examples enumerate the failure modes — invented mechanisms,
//     vague hand-waves, structurally-wrong mappings.
//   - New criterion 7 `analogy_target_accurate_specific` — when the analogy
//     domain is one the user has expertise in (per their job/heritage/
//     interests), the wording must use the TERMINOLOGY THE EXPERT WOULD
//     USE in that domain. Auto-passes when no analogy is used. Distinct
//     from criterion 5 (which catches inventions and structural wrongness):
//     this one catches simplified/wrong vocabulary an expert would call
//     amateur.
export const PASS2_SYSTEM_PROMPT = `You are the verifier for jargon's personalization layer.

jargon takes a canonical term entry and rewrites long_definition, why_it_matters, and example_in_sentence so they speak the specific user's language. The rewrite must:
(a) preserve every technical fact in the canonical
(b) ground any analogy in something the user actually told us about themselves
(c) use an analogy whose structure genuinely maps to how the term works
(d) sound like something the user would actually say or hear
(e) be factually correct on BOTH SIDES of any analogy — the term side AND the analogy-domain side
(f) only use an analogy when the term genuinely benefits from one
(g) when the analogy domain is the user's own area of expertise, use the actual vocabulary an expert in that domain would use — not simplified or amateur wording an expert would catch
(h) only use IN-DOMAIN technical terms the user has actually been taught — anything else must be inline-defined or avoided

You receive:
- The CANONICAL term entry (term, one-line definition, long definition, why it matters, example in sentence)
- The PERSONALIZED CANDIDATE (long_definition, why_it_matters, example_in_sentence)
- The USER PROFILE (education, job, heritage, roles, interests, goals, encounter contexts, background)
- The USER'S LEARNED VOCABULARY (every in-domain term they've answered correctly at least once, plus the term being taught — these are the vocabulary the candidate is allowed to use freely)

First, classify whether the candidate USES AN ANALOGY at all. The candidate "uses an analogy" if the long_definition or why_it_matters draws a comparison to a domain other than the term's own technical domain (e.g. "git commit is like archiving a patient chart" uses an analogy; "git commit saves a snapshot of your staged changes so you can return to it later" does not). Your "uses_analogy" verdict drives which criteria are scored.

Verify on these eight pass/fail criteria. For each, return "pass" or "fail" plus one short sentence of reasoning.

1. technical_accuracy_preserved
   Every fact in the canonical's long_definition is preserved in the personalized version. No backwards causation (e.g. "save before you change" for \`commit\` is wrong — commit saves what you already changed). No "begs the question" loops (e.g. defining \`idempotent\` by asserting that running it twice is the same as running it once, without explaining the underlying property). No invented mechanism the canonical didn't claim.

2. analogy_is_grounded
   IF an analogy is used, the analogy domain genuinely appears in the user's profile (job, heritage, interests, roles, encounter contexts, or background text). Not invented. Not "you're probably familiar with…" content. No "imagine you're a…" preamble. If the personalized rendering uses, say, a baseball analogy, baseball must appear somewhere in the profile fields. IF NO ANALOGY is used, automatically pass with reasoning "no analogy used."

3. analogy_fits_the_term
   IF an analogy is used, the chosen analogy domain has a real structural mapping to the term's mechanism. ("API = spec sheet between divisions" works — that's structurally what an API is.) ("API = cashier and deli counter talking through receipts" fails — receipts aren't a communication channel between systems, they're a record of one transaction.) Ask: does the analogy explain HOW the term works, not just WHAT category it's in? IF NO ANALOGY is used, automatically pass with reasoning "no analogy used."

4. example_reads_natural
   example_in_sentence is something a person in the user's role would actually say, not a textbook contrivance. Lowercase. No "Imagine if…" preamble. Uses the term in a real working context, not a definition disguised as a sentence.

5. analogy_target_accurate
   IF an analogy is used, every claim the candidate makes about the analogy DOMAIN must be factually correct, not just structurally aligned. If the candidate says "in pharmacy daily reconciliation, the pharmacist counts both the controlled substances and..." that pharmacy claim must be a real fact about pharmacy daily reconciliation, not an invented detail to make the structure fit. The user lives in the analogy domain — they will catch wrong claims instantly. Use your general knowledge of the analogy domain to verify the rendering's claims about it. IF NO ANALOGY is used, automatically pass with reasoning "no analogy used."

   The credibility bar — worked examples:
   - PASS: "rebase = re-running the tide cycle in a salt marsh" — tides DO recur on a regular cycle, salt marshes ARE shaped by repeated tidal flushing. Both ecology claims are correct.
   - FAIL: "rebase = peer-reviewing a manuscript" — peer review doesn't 're-apply' anything; reviewers comment, they don't re-execute the work on top of new findings. The structural mapping is wrong, so the analogy-domain claim is wrong.
   - PASS: "embedding = a vector representation in a high-dimensional space" — that IS the technical definition; no analogy domain to be wrong about.
   - FAIL: "embedding = like the way a scientist might categorize specimens" — too vague to verify; "scientists categorize specimens" is a hand-wave that doesn't pin down what makes something an embedding (numerical, dense, distance-meaningful). Vague analogy-domain claims fail this criterion.
   - FAIL: "idempotent API call = like a pharmacist double-counting controlled substances to confirm the count" — pharmacists DO double-count, but the act of double-counting doesn't model idempotence; idempotence is "the second call doesn't change the state," not "the second call confirms the first." The pharmacy-side claim describes a different mechanism than the term's actual mechanism, even though both claims about pharmacy practice are true in isolation.

6. analogy_is_warranted
   The default expectation is NO ANALOGY. An analogy must EARN its presence by passing a high bar: the term is abstract enough that plain English leaves real fog AND the analogy does meaningful clarifying work (not decoration). If a competent plain-English sentence would have been at least as clear as the candidate's analogy, FAIL — the analogy is decorative. README, branch, copy, file, terminal, push, pull, commit-as-snapshot — these warrant plain English; an analogy here fails. Load-bearing abstractions (RAG, idempotent, eventual consistency, MoE, compaction) warrant an analogy if the writer chose one. If the candidate correctly chose plain English for any term, PASS. When in doubt: a marginal analogy fails this criterion. Better to under-use analogies than to teach the user a wrong claim about a domain they live in.

7. analogy_target_accurate_specific
   IF an analogy is used AND the analogy domain is one the user has DOMAIN EXPERTISE in (their job, their heritage, a role they explicitly named, a deep interest), the candidate must use the TERMINOLOGY AN EXPERT IN THAT DOMAIN WOULD ACTUALLY USE. Don't say "a salt marsh evaporates the water" when an ecologist would say "tidal flushing renews the standing water." Don't say "the pharmacist verifies the prescription" when a pharmacist would say "the pharmacist completes the DUR." Don't say "a chef cooks the rice longer" when a chef would say "the rice is held on the steam tray." This criterion catches simplified or wrong VOCABULARY that a domain expert would catch — not the structural correctness (criterion 3) and not the factual correctness of claims (criterion 5), but the lexical register an actual practitioner uses. IF NO ANALOGY is used, automatically pass with reasoning "no analogy used." IF the analogy is grounded in the user's INTERESTS rather than DEEP EXPERTISE (e.g. "fan of cooking" is interest; "professional chef" is expertise), pass with reasoning "analogy domain is interest-grade not expert-grade."

8. vocabulary_within_reach
   The candidate may freely use: (a) plain English / common workplace nouns, (b) the term being taught right now, (c) any term in the USER'S LEARNED VOCABULARY list, (d) terminology from the analogy domain itself (a salt-marsh analogy can use "tidal flushing"; a pharmacy analogy can use "DUR"). Anything ELSE that is IN-DOMAIN technical jargon (i.e. another concept jargon would teach in the same domain) MUST either (i) be defined inline parenthetically the first time it appears, or (ii) be avoided entirely by rephrasing. FAIL when the candidate drops in-domain jargon the user hasn't learned without inline definition. PASS when the candidate stays inside the learned vocabulary, defines unfamiliar terms inline, or uses only plain English + analogy-domain words. Examples:
   - PASS: candidate teaches \`merge\` and uses "branch" — the user's learned-vocab list includes "branch."
   - PASS: candidate teaches \`RAG\` and writes "retrieval-augmented generation pulls relevant context (think of it as the model looking things up in a notebook before answering)" — uses no in-domain jargon, leans on plain English + analogy.
   - FAIL: candidate teaches \`merge\` and writes "merging combines two branches into a single commit" — uses "branch" + "commit" without checking the user's learned-vocab list. If "commit" is NOT in the list, this fails (unless inline-defined).
   - PASS: candidate teaches \`pull request\` and writes "open a pull request to ask another developer to merge (combine) your branch (your separate line of work) into the main project" — defines \`merge\` and \`branch\` inline parenthetically because they're not yet in the user's learned vocab.
   When the user's learned-vocab list is empty (very first lesson), only the term being taught + plain English + analogy-domain words are allowed; any other in-domain term must be inline-defined.

Reply with ONLY a single JSON object on one line:
{"uses_analogy":true|false,"technical_accuracy_preserved":{"result":"pass"|"fail","reasoning":"..."},"analogy_is_grounded":{"result":"pass"|"fail","reasoning":"..."},"analogy_fits_the_term":{"result":"pass"|"fail","reasoning":"..."},"example_reads_natural":{"result":"pass"|"fail","reasoning":"..."},"analogy_target_accurate":{"result":"pass"|"fail","reasoning":"..."},"analogy_is_warranted":{"result":"pass"|"fail","reasoning":"..."},"analogy_target_accurate_specific":{"result":"pass"|"fail","reasoning":"..."},"vocabulary_within_reach":{"result":"pass"|"fail","reasoning":"..."},"overall":"pass"|"fail"}

overall = "pass" only if ALL EIGHT criteria are "pass". Otherwise "fail". No markdown. No extra text.`;

// §7.3 — Pass 3 regenerator (system prompt)
// Per spec §7.3: byte-identical to Pass 1's system prompt. Voice and rules
// don't change just because the first attempt failed. Aliased to the same
// function so any future edit applies to both passes in lockstep.
export const pass3SystemPrompt = pass1SystemPrompt;

// ─── Shape contracts ────────────────────────────────────────────────────────────

export interface TermRow {
  id: string;
  term: string;
  one_line_definition: string;
  long_definition: string;
  example_in_sentence: string;
  why_it_matters: string;
  /**
   * B+1.5: top-level domain (e.g. 'coding'). Used to substitute the
   * vocabulary description into the Pass 1 / Pass 3 system prompt so
   * Opus is told what KIND of vocabulary it's teaching. Single-domain
   * world: always 'coding'. Defaults to 'coding' for legacy rows.
   */
  domain?: string;
}

export interface UserProfileRow {
  user_id: string;
  education_level: string | null;
  job: string | null;
  interests: string[];
  background_text: string | null;
  goals_extended: string[] | null;
  /**
   * B+1.10 — freeform "why are you here" from the redesigned wizard.
   * Preferred over `goals_extended` when present; null = legacy profile,
   * fall back to the chip array. Both feed the same prompt slot.
   */
  goals_freeform: string | null;
  encounter_contexts: string[] | null;
  heritage: string | null;
  roles: string[] | null;
  personalization_enabled: boolean;
  profile_version: number;
}

export interface ParsedRendering {
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
}

export interface VerifierCriterion {
  result: 'pass' | 'fail';
  reasoning: string;
}

export interface VerifierVerdict {
  /** B+1.5 — classifier flag. When false, the five analogy-conditional
   *  criteria (analogy_is_grounded / fits_the_term / target_accurate /
   *  is_warranted / target_accurate_specific) auto-pass except
   *  `is_warranted` which inverts: PASS if the term genuinely was
   *  simple enough to skip the analogy. */
  uses_analogy: boolean;
  technical_accuracy_preserved: VerifierCriterion;
  analogy_is_grounded: VerifierCriterion;
  analogy_fits_the_term: VerifierCriterion;
  example_reads_natural: VerifierCriterion;
  /** B+1.5 — both ends of the analogy must be factually correct. Auto-pass
   *  when uses_analogy = false. */
  analogy_target_accurate: VerifierCriterion;
  /** B+1.5 — the analogy must EARN its complexity. PASS if the analogy
   *  did real clarifying work OR if the writer correctly skipped it for
   *  a simple term. FAIL if a decorative analogy was forced onto a term
   *  that would have been clearer plain. */
  analogy_is_warranted: VerifierCriterion;
  /** B+1.6 — when the analogy domain is the user's expertise (job,
   *  heritage, declared role, deep interest), the wording must use the
   *  TERMINOLOGY THE EXPERT WOULD ACTUALLY USE. Catches simplified or
   *  wrong vocabulary an expert would call amateur. Auto-pass when
   *  uses_analogy = false OR when the analogy domain is interest-grade
   *  rather than expert-grade. */
  analogy_target_accurate_specific: VerifierCriterion;
  /** B+1.16 — vocabulary discipline. The candidate may use plain English,
   *  analogy-domain words, the term being taught, and any term in the user's
   *  learned vocabulary. Other in-domain jargon must be inline-defined or
   *  avoided. Catches "uses 'branch' to teach 'merge' before the user has
   *  ever seen 'branch'" — the pedagogical-respect rule. No auto-pass. */
  vocabulary_within_reach: VerifierCriterion;
  overall: 'pass' | 'fail';
}

// ─── Prompt builders ────────────────────────────────────────────────────────────

export const joinOrNone = (arr: string[] | null | undefined): string =>
  arr && arr.length > 0 ? arr.join(', ') : '(none provided)';

/**
 * B+1.10 — resolve the "why are you here" prompt slot. Prefers the freeform
 * textarea answer (richer, the user's own words) and falls back to the legacy
 * chip array for pre-B+1.10 profiles. Identical "(not provided)" sentinel
 * keeps the prompt shape constant regardless of which side has data.
 */
export const whyHere = (profile: { goals_freeform: string | null; goals_extended: string[] | null }): string => {
  const freeform = profile.goals_freeform?.trim();
  if (freeform && freeform.length > 0) return freeform;
  if (profile.goals_extended && profile.goals_extended.length > 0) {
    return profile.goals_extended.join(', ');
  }
  return '(not provided)';
};

/**
 * Verbatim user prompt template from §7.1 (Pass 1 — candidate generator).
 * Slot-shape consistent regardless of how sparse the profile is — sparse fields
 * become "(not provided)" / "(none provided)" so the model never sees blank labels.
 */
export function buildPass1UserMessage(
  term: TermRow,
  profile: UserProfileRow,
  knownVocabulary: string[],
): string {
  return `TERM: ${term.term}
ONE-LINE DEFINITION: ${term.one_line_definition}

CANONICAL LONG DEFINITION:
${term.long_definition}

CANONICAL WHY IT MATTERS:
${term.why_it_matters}

CANONICAL EXAMPLE:
${term.example_in_sentence}

USER PROFILE:
- Education: ${profile.education_level ?? '(not provided)'}
- Job: ${profile.job ?? '(not provided)'}
- Where they're from: ${profile.heritage ?? '(not provided)'}
- Roles: ${joinOrNone(profile.roles)}
- Interests: ${joinOrNone(profile.interests)}
- Why they're here: ${whyHere(profile)}
- Where they encounter terms: ${joinOrNone(profile.encounter_contexts)}
- Background: ${profile.background_text ?? '(not provided)'}

VOCABULARY THE USER HAS LEARNED:
${formatKnownVocabulary(knownVocabulary)}

Rewrite long_definition, why_it_matters, and example_in_sentence for this user. Return JSON only.`;
}

/**
 * Formats the user's known-vocabulary list as a single inline-safe line for the
 * prompt. Empty list → an explicit "(none yet — this is one of their first lessons)"
 * marker so Opus understands the constraint instead of seeing an unlabeled empty
 * field. Cap at ~120 names (~600 tokens) to keep request size bounded — beyond
 * that, the marginal value of more names drops fast and the prompt-cost cost
 * grows linearly. Names are joined with ", " and rendered lowercase to match
 * jargon's voice. */
export function formatKnownVocabulary(names: string[]): string {
  const cleaned = names
    .map((n) => (typeof n === 'string' ? n.trim() : ''))
    .filter((n) => n.length > 0);
  if (cleaned.length === 0) {
    return '(none yet — this is one of their first lessons. only the term being taught + plain English + the analogy domain are safe vocab.)';
  }
  const capped = cleaned.slice(0, 120);
  const trailer = cleaned.length > capped.length
    ? ` (and ${cleaned.length - capped.length} more)`
    : '';
  return capped.join(', ') + trailer;
}

/**
 * Verbatim user prompt template from §7.2 (Pass 2 — verifier). Feeds the
 * canonical entry, the candidate rendering, and the full user profile so the
 * verifier can ground all six criteria simultaneously.
 */
export function buildPass2UserMessage(
  term: TermRow,
  candidate: ParsedRendering,
  profile: UserProfileRow,
  knownVocabulary: string[],
): string {
  return `CANONICAL TERM:
- term: ${term.term}
- one_line_definition: ${term.one_line_definition}
- long_definition: ${term.long_definition}
- why_it_matters: ${term.why_it_matters}
- example_in_sentence: ${term.example_in_sentence}

PERSONALIZED CANDIDATE:
- long_definition: ${candidate.long_definition}
- why_it_matters: ${candidate.why_it_matters}
- example_in_sentence: ${candidate.example_in_sentence}

USER PROFILE:
- Education: ${profile.education_level ?? '(not provided)'}
- Job: ${profile.job ?? '(not provided)'}
- Where they're from: ${profile.heritage ?? '(not provided)'}
- Roles: ${joinOrNone(profile.roles)}
- Interests: ${joinOrNone(profile.interests)}
- Why they're here: ${whyHere(profile)}
- Where they encounter terms: ${joinOrNone(profile.encounter_contexts)}
- Background: ${profile.background_text ?? '(not provided)'}

USER'S LEARNED VOCABULARY:
${formatKnownVocabulary(knownVocabulary)}

Verify the candidate against the eight criteria. Return JSON only.`;
}

/**
 * Server-side builder for the §7.3 `{{failed_criteria_block}}` placeholder.
 * Iterates the four verifier criteria, emits one bullet per failed one in
 * `- <criterion_name>: <reasoning>` form. Passed criteria are omitted so the
 * regenerator's focus stays on what actually broke. If somehow nothing failed
 * (we shouldn't be here, but defensive), emit a single bullet so the prompt
 * doesn't become an empty section.
 */
export function buildFailedCriteriaBlock(verdict: VerifierVerdict): string {
  const criteria: Array<[string, VerifierCriterion]> = [
    ['technical_accuracy_preserved', verdict.technical_accuracy_preserved],
    ['analogy_is_grounded', verdict.analogy_is_grounded],
    ['analogy_fits_the_term', verdict.analogy_fits_the_term],
    ['example_reads_natural', verdict.example_reads_natural],
    ['analogy_target_accurate', verdict.analogy_target_accurate],
    ['analogy_is_warranted', verdict.analogy_is_warranted],
    ['analogy_target_accurate_specific', verdict.analogy_target_accurate_specific],
    ['vocabulary_within_reach', verdict.vocabulary_within_reach],
  ];
  const failed = criteria
    .filter(([, c]) => c.result === 'fail')
    .map(([name, c]) => `- ${name}: ${c.reasoning}`);
  if (failed.length === 0) {
    return '- (no specific failures captured; tighten analogy grounding, technical accuracy, expert vocabulary, and analogy necessity across all seven criteria)';
  }
  return failed.join('\n');
}

/**
 * Verbatim user prompt template from §7.3 (Pass 3 — regenerator). Feeds
 * everything the candidate generator saw, plus the prior attempt and a
 * focused failed-criteria brief.
 */
export function buildPass3UserMessage(
  term: TermRow,
  profile: UserProfileRow,
  prior: ParsedRendering,
  failedCriteriaBlock: string,
): string {
  return `TERM: ${term.term}
ONE-LINE DEFINITION: ${term.one_line_definition}

CANONICAL LONG DEFINITION:
${term.long_definition}

CANONICAL WHY IT MATTERS:
${term.why_it_matters}

CANONICAL EXAMPLE:
${term.example_in_sentence}

USER PROFILE:
- Education: ${profile.education_level ?? '(not provided)'}
- Job: ${profile.job ?? '(not provided)'}
- Where they're from: ${profile.heritage ?? '(not provided)'}
- Roles: ${joinOrNone(profile.roles)}
- Interests: ${joinOrNone(profile.interests)}
- Why they're here: ${whyHere(profile)}
- Where they encounter terms: ${joinOrNone(profile.encounter_contexts)}
- Background: ${profile.background_text ?? '(not provided)'}

YOUR PREVIOUS ATTEMPT (rejected by the verifier):
- long_definition: ${prior.long_definition}
- why_it_matters: ${prior.why_it_matters}
- example_in_sentence: ${prior.example_in_sentence}

VERIFIER FEEDBACK — these criteria failed and must be fixed:
${failedCriteriaBlock}

Regenerate long_definition, why_it_matters, and example_in_sentence addressing the specific failures above. Keep what was working and fix what wasn't. Same shape, same length budget, same JSON schema as the original. Return JSON only.`;
}

// ─── JSON parsing ───────────────────────────────────────────────────────────────

export function stripFencing(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function parseRendering(raw: string): ParsedRendering | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.long_definition === 'string' &&
      typeof parsed.why_it_matters === 'string' &&
      typeof parsed.example_in_sentence === 'string' &&
      parsed.long_definition.trim().length > 0 &&
      parsed.why_it_matters.trim().length > 0 &&
      parsed.example_in_sentence.trim().length > 0
    ) {
      return {
        long_definition: parsed.long_definition.trim(),
        why_it_matters: parsed.why_it_matters.trim(),
        example_in_sentence: parsed.example_in_sentence.trim(),
      };
    }
  } catch {
    // fall through
  }
  return null;
}

export function parseVerdict(raw: string): VerifierVerdict | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed.overall !== 'pass' && parsed.overall !== 'fail')
    ) {
      return null;
    }
    const isCriterion = (c: any): c is VerifierCriterion =>
      c &&
      typeof c === 'object' &&
      (c.result === 'pass' || c.result === 'fail') &&
      typeof c.reasoning === 'string';
    if (
      typeof parsed.uses_analogy !== 'boolean' ||
      !isCriterion(parsed.technical_accuracy_preserved) ||
      !isCriterion(parsed.analogy_is_grounded) ||
      !isCriterion(parsed.analogy_fits_the_term) ||
      !isCriterion(parsed.example_reads_natural) ||
      !isCriterion(parsed.analogy_target_accurate) ||
      !isCriterion(parsed.analogy_is_warranted) ||
      !isCriterion(parsed.analogy_target_accurate_specific) ||
      !isCriterion(parsed.vocabulary_within_reach)
    ) {
      return null;
    }
    const criteria = [
      parsed.technical_accuracy_preserved,
      parsed.analogy_is_grounded,
      parsed.analogy_fits_the_term,
      parsed.example_reads_natural,
      parsed.analogy_target_accurate,
      parsed.analogy_is_warranted,
      parsed.analogy_target_accurate_specific,
      parsed.vocabulary_within_reach,
    ];
    const effectiveOverall = criteria.every((criterion) => criterion.result === 'pass')
      ? 'pass'
      : 'fail';
    if (parsed.overall !== effectiveOverall) return null;
    return {
      uses_analogy: parsed.uses_analogy,
      technical_accuracy_preserved: parsed.technical_accuracy_preserved,
      analogy_is_grounded: parsed.analogy_is_grounded,
      analogy_fits_the_term: parsed.analogy_fits_the_term,
      example_reads_natural: parsed.example_reads_natural,
      analogy_target_accurate: parsed.analogy_target_accurate,
      analogy_is_warranted: parsed.analogy_is_warranted,
      analogy_target_accurate_specific: parsed.analogy_target_accurate_specific,
      vocabulary_within_reach: parsed.vocabulary_within_reach,
      overall: effectiveOverall,
    };
  } catch {
    return null;
  }
}

export function estimateOpusCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * COST_PER_M_OPUS_4_7.in +
    (tokensOut / 1_000_000) * COST_PER_M_OPUS_4_7.out
  );
}
