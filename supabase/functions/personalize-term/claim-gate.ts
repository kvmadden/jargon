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
// Rules, each general and none keyed to one saved output:
//   1. analogy_about_learner_field: a comparison ("think of", "like how",
//      "similar to", "the same reason", "the software version of") that uses the
//      learner's own field vocabulary.
//   2. restrictive_claim_about_learner_field: an "only / never / cannot / no
//      one" statement that uses the learner's field vocabulary, when the
//      canonical entry makes no such restrictive claim and the sentence is not
//      framed as a correction ("do not assume ...").
//   3. new_exclusive_claim: an "only / solely / the sole" claim when the
//      canonical entry makes no exclusive claim at all.
//   4. verifier_unsupported_claim and canonical_concern: claims the LLM
//      verifier itself marked unsupported or unsure, and canonical statements
//      it disputed. Missing lists are not read as "no claims": parseVerdict
//      rejects a verdict that omits them.
//   5. length_out_of_range: the rewrite is under 0.4x or over 2x the canonical
//      length. This asks for a revision, it is not a truth claim.
// An SME-approved analogy (approved-analogies.ts) can clear rule 1 and 2 for a
// specific term.
//
// Pure module: no Deno globals, no network imports.

import {
  RENDERING_FIELDS,
  type RenderingField,
  EXCLUSIVE_LABELS,
  restrictiveMarkers,
  hasComparisonMarker,
  splitSentences,
} from './claim-text.ts';
import { buildLearnerLexicon, learnerFieldMentions, type DomainProfile } from './domain-lexicon.ts';

export type GateDecision = 'pass' | 'revise' | 'needs_review';

export type GateFindingKind =
  | 'analogy_about_learner_field'
  | 'restrictive_claim_about_learner_field'
  | 'new_exclusive_claim'
  | 'verifier_unsupported_claim'
  | 'canonical_concern'
  | 'length_out_of_range';

export interface GateFinding {
  kind: GateFindingKind;
  field?: RenderingField;
  sentence?: string;
  detail: string;
}

export interface GateResult {
  decision: GateDecision;
  findings: GateFinding[];
  /** Rendering length divided by canonical length, all three fields together. */
  lengthRatio: number;
  /** Sentences read. Every sentence of every field is read before a decision. */
  sentencesChecked: number;
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
  /** A distinctive phrase of the approved analogy, matched case-insensitively. */
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

const CLAIM_KINDS: ReadonlySet<GateFindingKind> = new Set([
  'analogy_about_learner_field',
  'restrictive_claim_about_learner_field',
  'new_exclusive_claim',
  'verifier_unsupported_claim',
  'canonical_concern',
]);

function canonicalText(term: CanonicalEntry): string {
  return [term.one_line_definition, term.long_definition, term.why_it_matters, term.example_in_sentence].join(' ');
}

function totalLength(fields: RenderingText): number {
  return RENDERING_FIELDS.reduce((n, f) => n + fields[f].length, 0);
}

export function checkRendering(input: GateInput): GateResult {
  const { term, rendering, profile, verdict, approvedAnalogies = [] } = input;
  const canonical = canonicalText(term);
  const lexicon = buildLearnerLexicon(profile, canonical);
  const canonicalRestrictive = new Set(splitSentences(canonical).flatMap(restrictiveMarkers));
  const canonicalHasExclusive = [...canonicalRestrictive].some((label) => EXCLUSIVE_LABELS.has(label));
  const anchors = approvedAnalogies
    .filter((a) => a.termId === term.id && a.anchor.trim().length > 0)
    .map((a) => a.anchor.toLowerCase());

  const findings: GateFinding[] = [];
  let sentencesChecked = 0;

  const sentences = RENDERING_FIELDS.flatMap((field) =>
    splitSentences(rendering[field]).map((sentence) => ({ field, sentence })),
  );
  // When the verifier says an analogy was used but no sentence has a
  // comparison marker, the analogy is phrased without one ("RLS is the EHR's
  // unit filter"). Then any definition sentence that uses the learner's field
  // vocabulary is read as that analogy. When a marked comparison exists, only
  // marked sentences count, so scene-setting sentences are not swept in.
  const anyMarked = sentences.some(({ sentence }) => hasComparisonMarker(sentence));
  const unmarkedAnalogy = verdict?.uses_analogy === true && !anyMarked;

  for (const { field, sentence } of sentences) {
    sentencesChecked++;
    const lower = sentence.toLowerCase();
    if (anchors.some((a) => lower.includes(a))) continue;

    const mentions = learnerFieldMentions(sentence, lexicon);
    const restrictive = restrictiveMarkers(sentence);
    const newRestrictive = restrictive.filter((label) => !canonicalRestrictive.has(label));
    const comparison =
      hasComparisonMarker(sentence) ||
      (unmarkedAnalogy && field !== 'example_in_sentence' && mentions.length > 0);

    if (comparison && mentions.length > 0) {
      findings.push({
        kind: 'analogy_about_learner_field',
        field,
        sentence,
        detail: `analogy into the learner's field (${mentions.slice(0, 4).join(', ')}) makes a claim this pipeline cannot verify`,
      });
    }
    if (newRestrictive.length > 0 && mentions.length > 0) {
      findings.push({
        kind: 'restrictive_claim_about_learner_field',
        field,
        sentence,
        detail: `"${newRestrictive.join('", "')}" claim about the learner's field (${mentions.slice(0, 4).join(', ')}) that the canonical entry does not make`,
      });
    }
    const newExclusive = restrictive.filter((label) => EXCLUSIVE_LABELS.has(label));
    if (newExclusive.length > 0 && !canonicalHasExclusive) {
      findings.push({
        kind: 'new_exclusive_claim',
        field,
        sentence,
        detail: `adds an exclusive claim ("${newExclusive.join('", "')}") that the canonical entry does not make`,
      });
    }
  }

  for (const claim of verdict?.domain_claims ?? []) {
    if (claim.assessment !== 'supported') {
      findings.push({
        kind: 'verifier_unsupported_claim',
        field: RENDERING_FIELDS.includes(claim.field as RenderingField) ? (claim.field as RenderingField) : undefined,
        sentence: claim.claim,
        detail: `the verifier marked this claim ${claim.assessment}`,
      });
    }
  }
  for (const concern of verdict?.canonical_concerns ?? []) {
    findings.push({ kind: 'canonical_concern', detail: `the verifier disputes the canonical entry: ${concern}` });
  }

  const canonicalLength = totalLength(term);
  const lengthRatio = canonicalLength > 0 ? totalLength(rendering) / canonicalLength : Number.POSITIVE_INFINITY;
  if (!(lengthRatio >= LENGTH_RATIO_MIN && lengthRatio <= LENGTH_RATIO_MAX)) {
    findings.push({
      kind: 'length_out_of_range',
      detail: `rewrite is ${lengthRatio.toFixed(2)}x the canonical length; keep it between ${LENGTH_RATIO_MIN}x and ${LENGTH_RATIO_MAX}x`,
    });
  }

  const decision: GateDecision = findings.some((f) => CLAIM_KINDS.has(f.kind))
    ? 'needs_review'
    : findings.length > 0
      ? 'revise'
      : 'pass';
  return { decision, findings, lengthRatio, sentencesChecked };
}

/** Bullet list for the regeneration prompt. */
export function gateFeedbackBlock(result: GateResult): string {
  if (result.findings.length === 0) return '';
  return result.findings
    .map((f) => `- claim_check ${f.kind}: ${f.detail}${f.sentence ? ` (sentence: "${f.sentence}")` : ''}`)
    .join('\n');
}
