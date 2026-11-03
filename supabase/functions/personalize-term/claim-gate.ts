// Deterministic claim gate for personalize-term.
//
// Why it exists. In the 2026-10-30 offline run the LLM verifier accepted 78 of
// 79 rewrites. A pharmacist confirmed five of the accepted ones wrong. Four of
// those errors were introduced by the rewrite, and all four sat inside an
// analogy that made a claim about the learner's own field:
//   - a nurse's EHR "only" opening charts on the nurse's unit,
//   - a pharmacy system "only" showing a tech the patients of one store,
//   - a "signed, tamper-evident script label" offered as a JWT analogy,
//   - a prescription transfer that hands over everything but "the patient's
//     login to their chart".
// The verifier's own accuracy criteria never failed. This gate does not try to
// decide whether such a claim is true. It cannot: nothing here has evidence
// about how a given hospital or pharmacy works. It finds the claims this
// pipeline cannot verify and abstains, so the rewrite is regenerated in plain
// English or held for human review instead of being shown as checked.
//
// Rules. Every sentence of all three fields is read. A sentence that uses the
// learner's field vocabulary is a field sentence, unless it only restates the
// canonical entry. Each field sentence must clear all of these:
//   1. unvouched_field_claim: the verifier must list the sentence in
//      domain_claims as supported. A field sentence it did not vouch for is
//      held. This is the fail-closed rule: a missing marker word is not
//      evidence that a sentence is safe (review round 2).
//   2. analogy_about_learner_field: a comparison into the field ("think of",
//      "like a", "similar to", "the same reason") is held even when vouched.
//      When the verifier says the rewrite uses an analogy, every field sentence
//      is read as part of it, so one marked sentence cannot hide another.
//   3. restrictive_claim_about_learner_field: a restriction ("only", "only
//      if", "never", "cannot", "restricted to", "unless", "locked out", "keeps
//      ... inside", "does not let") is held even when vouched, unless a
//      canonical sentence states the same restriction about the same things.
// And for the rewrite as a whole:
//   4. verifier_unsupported_claim: any claim the verifier marked unsupported
//      or unsure.
//   5. canonical_concern: a canonical statement the verifier disputes always
//      goes to canonical review. It holds the rewrite only when the rewrite
//      repeats it, because the learner would otherwise see the disputed
//      canonical text instead.
//   6. length_out_of_range: under 0.4x or over 2x the canonical length asks
//      for a revision. It is not a truth claim.
// An SME-approved analogy (approved-analogies.ts) clears rule 2 for the one
// sentence that contains its anchor, for its own term. It never clears rule 1
// or rule 3.
//
// These rules were written after reading the four errors they were built to
// catch and the review findings, so every result on that material is a
// development result.
//
// Pure module: no Deno globals, no network imports.

import {
  RENDERING_FIELDS,
  type RenderingField,
  containsPhrase,
  contentWords,
  restrictiveMarkers,
  hasComparisonMarker,
  shareOf,
  splitSentences,
} from './claim-text.ts';
import { buildLearnerLexicon, learnerFieldMentions, type DomainProfile } from './domain-lexicon.ts';

export type GateDecision = 'pass' | 'revise' | 'needs_review';

export type GateFindingKind =
  | 'unvouched_field_claim'
  | 'analogy_about_learner_field'
  | 'restrictive_claim_about_learner_field'
  | 'verifier_unsupported_claim'
  | 'canonical_concern'
  | 'length_out_of_range';

export interface GateFinding {
  kind: GateFindingKind;
  field?: RenderingField;
  sentence?: string;
  detail: string;
  /** False for a finding that is recorded but does not hold the rewrite (a canonical concern the rewrite does not repeat). */
  blocking: boolean;
}

export interface GateResult {
  decision: GateDecision;
  findings: GateFinding[];
  /** Rendering length divided by canonical length, all three fields together. */
  lengthRatio: number;
  /** Sentences read. Every sentence of every field is read before a decision. */
  sentencesChecked: number;
  /** Canonical statements the verifier disputed. They go to review whatever the decision. */
  canonicalReview: string[];
}

export interface CanonicalEntry {
  id: string;
  term: string;
  one_line_definition: string;
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
}

export interface RenderingText {
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
}

export interface VerifierClaim {
  field: string;
  claim: string;
  assessment: 'supported' | 'unsupported' | 'unsure';
}

/** The parts of a verifier verdict the gate reads. */
export interface GateVerdictView {
  uses_analogy?: boolean;
  domain_claims?: VerifierClaim[];
  canonical_concerns?: string[];
}

/** An analogy a named subject-matter expert reviewed and approved for one term. */
export interface ApprovedAnalogy {
  termId: string;
  /** A distinctive phrase of the approved analogy, matched as whole words in order. */
  anchor: string;
  reviewer: string;
  reviewedAt: string;
}

export interface GateInput {
  term: CanonicalEntry;
  rendering: RenderingText;
  profile: DomainProfile;
  verdict?: GateVerdictView | null;
  approvedAnalogies?: readonly ApprovedAnalogy[];
}

export const LENGTH_RATIO_MIN = 0.4;
export const LENGTH_RATIO_MAX = 2.0;

/** Share of a sentence's content words that must appear in the canonical text for it to count as a restatement. */
export const RESTATEMENT_SHARE = 0.8;
/** Share of a restrictive sentence's content words a canonical sentence must share to state the same restriction. */
export const SAME_RESTRICTION_SHARE = 0.6;
/** Share of a disputed canonical statement's content words a rewrite sentence must share to repeat it. */
export const REPEATS_CONCERN_SHARE = 0.5;

function canonicalText(term: CanonicalEntry): string {
  return [term.one_line_definition, term.long_definition, term.why_it_matters, term.example_in_sentence].join(' ');
}

function totalLength(fields: RenderingText): number {
  return RENDERING_FIELDS.reduce((n, f) => n + fields[f].length, 0);
}

function normalizeSentence(text: string): string {
  return text.toLowerCase().replace(/[“”"'‘’]/g, '').replace(/\s+/g, ' ').replace(/[.!?;:,\s]+$/, '').trim();
}

/** True when the verifier listed this exact sentence (or a near quote of it) as supported. */
function vouchedFor(field: RenderingField, sentence: string, claims: readonly VerifierClaim[]): boolean {
  const s = normalizeSentence(sentence);
  const sWords = contentWords(sentence);
  return claims.some((c) => {
    if (c.assessment !== 'supported') return false;
    if (RENDERING_FIELDS.includes(c.field as RenderingField) && c.field !== field) return false;
    const q = normalizeSentence(c.claim);
    if (q.length === 0) return false;
    if (q === s || (s.includes(q) && q.length >= 0.8 * s.length) || q.includes(s)) return true;
    const qWords = contentWords(c.claim);
    return shareOf(sWords, qWords) >= 0.9 && shareOf(qWords, sWords) >= 0.9;
  });
}

const CANONICAL_PREFIX = /^(?:the )?canonical(?: entry| text| definition| example)?(?: (?:says|claims|states|implies|suggests))?(?: that)?\s*/i;

export function checkRendering(input: GateInput): GateResult {
  const { term, rendering, profile, verdict, approvedAnalogies = [] } = input;
  const canonical = canonicalText(term);
  const canonicalWords = contentWords(canonical);
  const canonicalSentences = splitSentences(canonical).map((sentence) => ({
    words: contentWords(sentence),
    restrictive: new Set(restrictiveMarkers(sentence)),
  }));
  const lexicon = buildLearnerLexicon(profile);
  const claims = verdict?.domain_claims ?? [];
  const anchors = approvedAnalogies
    .filter((a) => a.termId === term.id && a.anchor.trim().length > 0)
    .map((a) => a.anchor);

  const findings: GateFinding[] = [];
  const sentences = RENDERING_FIELDS.flatMap((field) =>
    splitSentences(rendering[field]).map((sentence) => ({ field, sentence })),
  );

  for (const { field, sentence } of sentences) {
    const mentions = learnerFieldMentions(sentence, lexicon);
    if (mentions.length === 0) continue;
    const words = contentWords(sentence);
    // A restatement of the canonical entry: nearly all of its words, and every
    // field word, come from the canonical text.
    const restates =
      shareOf(words, canonicalWords) >= RESTATEMENT_SHARE && mentions.every((m) => containsPhrase(canonical, m));
    if (restates) continue;
    const named = mentions.slice(0, 4).join(', ');

    if (!vouchedFor(field, sentence, claims)) {
      findings.push({
        kind: 'unvouched_field_claim',
        field,
        sentence,
        blocking: true,
        detail: `sentence about the learner's field (${named}) that the verifier did not mark supported`,
      });
    }
    const approved = anchors.some((a) => containsPhrase(sentence, a));
    if ((hasComparisonMarker(sentence) || verdict?.uses_analogy === true) && !approved) {
      findings.push({
        kind: 'analogy_about_learner_field',
        field,
        sentence,
        blocking: true,
        detail: `analogy into the learner's field (${named}) makes a claim this pipeline cannot verify`,
      });
    }
    const restrictive = restrictiveMarkers(sentence);
    const stated = canonicalSentences.some(
      (c) => restrictive.some((l) => c.restrictive.has(l)) && shareOf(words, c.words) >= SAME_RESTRICTION_SHARE,
    );
    if (restrictive.length > 0 && !stated) {
      findings.push({
        kind: 'restrictive_claim_about_learner_field',
        field,
        sentence,
        blocking: true,
        detail: `"${restrictive.join('", "')}" claim about the learner's field (${named}) that no canonical sentence states`,
      });
    }
  }

  for (const claim of claims) {
    if (claim.assessment !== 'supported') {
      findings.push({
        kind: 'verifier_unsupported_claim',
        field: RENDERING_FIELDS.includes(claim.field as RenderingField) ? (claim.field as RenderingField) : undefined,
        sentence: claim.claim,
        blocking: true,
        detail: `the verifier marked this claim ${claim.assessment}`,
      });
    }
  }

  const canonicalReview = (verdict?.canonical_concerns ?? []).filter((c) => typeof c === 'string' && c.trim().length > 0);
  for (const concern of canonicalReview) {
    const concernWords = contentWords(concern.replace(CANONICAL_PREFIX, ''));
    const repeated = sentences.find(({ sentence }) => shareOf(concernWords, contentWords(sentence)) >= REPEATS_CONCERN_SHARE);
    findings.push({
      kind: 'canonical_concern',
      field: repeated?.field,
      sentence: repeated?.sentence,
      blocking: Boolean(repeated),
      detail: repeated
        ? `the rewrite repeats a canonical statement the verifier disputes: ${concern}`
        : `the verifier disputes the canonical entry (sent to canonical review): ${concern}`,
    });
  }

  const canonicalLength = totalLength(term);
  const lengthRatio = canonicalLength > 0 ? totalLength(rendering) / canonicalLength : Number.POSITIVE_INFINITY;
  if (!(lengthRatio >= LENGTH_RATIO_MIN && lengthRatio <= LENGTH_RATIO_MAX)) {
    findings.push({
      kind: 'length_out_of_range',
      blocking: false,
      detail: `rewrite is ${lengthRatio.toFixed(2)}x the canonical length; keep it between ${LENGTH_RATIO_MIN}x and ${LENGTH_RATIO_MAX}x`,
    });
  }

  const decision: GateDecision = findings.some((f) => f.blocking)
    ? 'needs_review'
    : findings.some((f) => f.kind === 'length_out_of_range')
      ? 'revise'
      : 'pass';
  return { decision, findings, lengthRatio, sentencesChecked: sentences.length, canonicalReview };
}

/** Longest quoted sentence or detail in the regeneration feedback. */
export const FEEDBACK_ITEM_MAX_CHARS = 300;
/** Most findings quoted in the regeneration feedback. */
export const FEEDBACK_MAX_ITEMS = 12;

function cap(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * Bullet list for the regeneration prompt. Model-written text (the quoted
 * sentence) is JSON-encoded and capped, so it cannot close a quote and pose as
 * an instruction to the next pass.
 */
export function gateFeedbackBlock(result: GateResult): string {
  const shown = result.findings.filter((f) => f.blocking || f.kind === 'length_out_of_range').slice(0, FEEDBACK_MAX_ITEMS);
  return shown
    .map((f) => {
      const quoted = f.sentence ? ` sentence=${JSON.stringify(cap(f.sentence, FEEDBACK_ITEM_MAX_CHARS))}` : '';
      return `- claim_check ${f.kind}: ${cap(f.detail, FEEDBACK_ITEM_MAX_CHARS)}${quoted}`;
    })
    .join('\n');
}
