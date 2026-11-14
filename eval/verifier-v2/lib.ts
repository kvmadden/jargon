// Verifier v2: a claim-level fact check with an expert sign-off question.
//
// Pure module (no network, no child processes) so the decision rule, the
// parser, the environment scrub and the scoring can be unit tested. The
// runner (run-verifiers.ts) does the model calls.
//
// Design, fixed before any v2 call was made:
//   1. Extract every checkable factual claim from the three learner-facing
//      fields, including claims implied by a comparison or by the example.
//   2. Give each claim one of five verifiable claim types (CLAIM_TYPES).
//   3. Judge each claim: supported, wrong, misleading or unverifiable.
//   4. Ask whether a practicing expert in the learner's field would sign off
//      on the explanation as written. For the retail pharmacist learner that
//      expert is a pharmacist.
//   5. The pass/fail decision is computed here from the claims and the
//      sign-off (decideV2), not taken from the model's own summary.
//
// The canonical seed entry is shown as a reference, and the prompt says it
// can itself be wrong. The original verifier treated the canonical as ground
// truth, which is why it could not catch errors inherited from it.

export const CLAIM_TYPES = {
  TECH: 'How the technical term itself works (mechanism, definition, behavior).',
  PRACTICE:
    "How the learner's own field works: workflows, who can see or do what, the systems they use, physical artifacts such as labels and forms, and rules or regulations.",
  MAPPING:
    "A comparison that says something in the learner's field corresponds to something about the term. Both sides must exist as described and must actually correspond.",
  SCENARIO:
    'The example or a described situation: could it really happen as written in that workplace, with that system, that environment and that cause and effect?',
  EXTERNAL: 'Named products, vendors, model sizes, numbers, versions and other public facts.',
} as const;
export type ClaimType = keyof typeof CLAIM_TYPES;

export const CLAIM_VERDICTS = ['supported', 'wrong', 'misleading', 'unverifiable'] as const;
export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number];

export interface V2Claim {
  type: ClaimType;
  claim: string;
  verdict: ClaimVerdict;
  reason: string;
}
export interface V2Verdict {
  claims: V2Claim[];
  expert: string;
  signoff: 'yes' | 'no';
  signoff_reason: string;
}

export interface CandidateText {
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
}
export interface CanonicalTerm {
  term: string;
  one_line_definition: string;
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
}
export interface LearnerProfile {
  label: string;
  job: string | null;
}

/** The expert whose sign-off is asked for, by learner profile id. */
export function expertFor(profileId: string, job?: string | null): string {
  if (profileId === 'pharmacist') return 'licensed pharmacist';
  if (profileId === 'nurse') return 'registered nurse';
  if (profileId === 'teacher') return 'experienced high-school teacher';
  // Added before the freeze so the rule applies to any learner. The three dev
  // profiles above are unchanged.
  if (job && job.trim()) return `experienced practitioner in the learner's job (${job.trim()})`;
  throw new Error(`no expert defined for profile ${profileId}`);
}

export function v2SystemPrompt(): string {
  const types = Object.entries(CLAIM_TYPES)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return `You are an independent fact-checker for a learning app that explains technical terms to working professionals in plain language. Each explanation was written by another AI for one specific learner, often with comparisons to the learner's own job. Your job is to find anything a careful expert in that learner's field would refuse to publish.

You receive the learner, the expert who must sign off, a CANONICAL reference entry written by the product team, and the PERSONALIZED EXPLANATION to check. The canonical entry is a reference, not ground truth. It can contain errors, and an error copied from it is still an error.

Do this:
1. Extract every checkable factual claim in the personalized explanation (long_definition, why_it_matters and example_in_sentence). Include claims that a comparison or the example implies without stating outright, for example that a workplace system behaves a certain way, or that an artifact carries certain information.
2. Give each claim exactly one type:
${types}
3. Judge each claim:
   - supported: true as stated.
   - wrong: false.
   - misleading: true only in a narrow sense, overstated, internally inconsistent, or it would leave the learner believing something false. A publicly unknown fact stated as certain is misleading.
   - unverifiable: cannot be checked from general professional knowledge, and is not stated as certain.
   Judge PRACTICE, MAPPING and SCENARIO claims the way a working practitioner in the learner's field would, using how that field typically works in the United States. Do not give a comparison credit just because its general shape is right. Every specific detail it states about the learner's field must also be true.
4. Decide whether the named expert would sign off on publishing this explanation to a colleague as written: "yes" or "no", with one sentence of reason.

Reply with ONLY one JSON object, no markdown, in this shape:
{"claims":[{"type":"TECH|PRACTICE|MAPPING|SCENARIO|EXTERNAL","claim":"...","verdict":"supported|wrong|misleading|unverifiable","reason":"one sentence"}],"expert":"...","signoff":"yes|no","signoff_reason":"one sentence"}`;
}

export function v2UserMessage(args: {
  canonical: CanonicalTerm;
  candidate: CandidateText;
  profileId: string;
  profile: LearnerProfile;
}): string {
  const { canonical, candidate, profileId, profile } = args;
  return `LEARNER: ${profile.label}${profile.job ? ` (${profile.job})` : ''}
EXPERT WHO MUST SIGN OFF: ${expertFor(profileId, profile.job)}

CANONICAL REFERENCE (may itself contain errors):
- term: ${canonical.term}
- one_line_definition: ${canonical.one_line_definition}
- long_definition: ${canonical.long_definition}
- why_it_matters: ${canonical.why_it_matters}
- example_in_sentence: ${canonical.example_in_sentence}

PERSONALIZED EXPLANATION TO CHECK:
- long_definition: ${candidate.long_definition}
- why_it_matters: ${candidate.why_it_matters}
- example_in_sentence: ${candidate.example_in_sentence}

Extract and judge every claim, then give the sign-off. JSON only.`;
}

/** JSON schema handed to CLIs that support constrained output. */
export const V2_JSON_SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.keys(CLAIM_TYPES) },
          claim: { type: 'string' },
          verdict: { type: 'string', enum: [...CLAIM_VERDICTS] },
          reason: { type: 'string' },
        },
        required: ['type', 'claim', 'verdict', 'reason'],
      },
    },
    expert: { type: 'string' },
    signoff: { type: 'string', enum: ['yes', 'no'] },
    signoff_reason: { type: 'string' },
  },
  required: ['claims', 'expert', 'signoff', 'signoff_reason'],
} as const;

function stripFence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}

/** Parse a v2 verdict. Returns null on anything malformed; never guesses. */
export function parseV2(raw: string | object | null | undefined): V2Verdict | null {
  if (raw == null) return null;
  let obj: any;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(stripFence(raw));
    } catch {
      return null;
    }
  } else {
    obj = raw;
  }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.claims)) return null;
  if (obj.signoff !== 'yes' && obj.signoff !== 'no') return null;
  if (typeof obj.signoff_reason !== 'string' || typeof obj.expert !== 'string') return null;
  if (obj.claims.length === 0) return null;
  for (const c of obj.claims) {
    if (!c || typeof c !== 'object') return null;
    if (!(c.type in CLAIM_TYPES)) return null;
    if (!(CLAIM_VERDICTS as readonly string[]).includes(c.verdict)) return null;
    if (typeof c.claim !== 'string' || typeof c.reason !== 'string') return null;
  }
  return {
    claims: obj.claims.map((c: any) => ({ type: c.type, claim: c.claim, verdict: c.verdict, reason: c.reason })),
    expert: obj.expert,
    signoff: obj.signoff,
    signoff_reason: obj.signoff_reason,
  };
}

/**
 * Two decision rules, both declared before any v2 call.
 *   primary: fail if any claim is wrong or misleading, or the expert would not sign off.
 *   lenient: fail only if a claim is wrong or the expert would not sign off.
 * Unverifiable claims never fail an explanation on their own.
 */
export type DecisionRule = 'primary' | 'lenient' | 'mapping';
/**
 * 'mapping' was added on 2026-11-13 after iteration 1 searched six rules over
 * stored verdicts on the dev set: fail if the expert would not sign off, a
 * claim is wrong, or a MAPPING claim is wrong or misleading. It was chosen
 * on the dev set, so its dev numbers are optimistic by construction.
 */
export function decideV2(v: V2Verdict, rule: DecisionRule = 'primary'): 'pass' | 'fail' {
  if (v.signoff === 'no') return 'fail';
  if (rule === 'mapping') {
    return v.claims.some((c) => c.verdict === 'wrong' || (c.type === 'MAPPING' && c.verdict === 'misleading')) ? 'fail' : 'pass';
  }
  const failing: ClaimVerdict[] = rule === 'primary' ? ['wrong', 'misleading'] : ['wrong'];
  return v.claims.some((c) => failing.includes(c.verdict)) ? 'fail' : 'pass';
}

/**
 * Environment for a subscription CLI call. Removes every metered API key the
 * CLIs could pick up, so a call can only authenticate through the logged-in
 * subscription. The caller must still check the CLI's own report of how it
 * authenticated (claude: init.apiKeySource must be "none").
 */
export const METERED_KEY_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'XAI_API_KEY',
  'GROK_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'OPENROUTER_API_KEY',
] as const;
export function subscriptionEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if ((METERED_KEY_VARS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Throws unless the claude CLI's init event shows subscription (OAuth) auth. */
export function assertClaudeSubscription(init: { apiKeySource?: unknown } | null | undefined): void {
  if (!init) throw new Error('claude CLI produced no init event, so its auth source is unknown');
  if (init.apiKeySource !== 'none') {
    throw new Error(`claude CLI authenticated with apiKeySource=${String(init.apiKeySource)}; only the subscription (none) is allowed`);
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export type GoldLabel = 'correct' | 'wrong' | 'misleading';
export interface GoldRow {
  id: string;
  group: string;
  label: GoldLabel;
  label_status: 'confirmed' | 'proposed';
  prior_ruling?: { label: GoldLabel } | null;
}
export interface ArmResult {
  id: string;
  decision: 'pass' | 'fail' | 'abstain' | null; // null = no usable verdict
}

export interface ArmScore {
  n: number;
  no_verdict: number;
  confirmed_misses: { caught: number; of: number };
  proposed_flawed: { caught: number; of: number }; // label wrong or misleading, any status
  proposed_correct: { false_alarms: number; of: number };
  reported_correct: { false_alarms: number; of: number }; // prior expert ruling "correct"
  abstained: { on_flawed: number; on_correct: number };
}

const flawed = (l: GoldLabel) => l === 'wrong' || l === 'misleading';

/**
 * A catch is a fail decision on an item labeled wrong or misleading.
 * A false alarm is a fail decision on an item labeled correct.
 * Items with no usable verdict count in the denominator and as neither a
 * catch nor a false alarm, so a broken run can never look better.
 */
export function scoreArm(gold: GoldRow[], results: ArmResult[]): ArmScore {
  const byId = new Map(results.map((r) => [r.id, r]));
  const s: ArmScore = {
    n: gold.length,
    no_verdict: 0,
    confirmed_misses: { caught: 0, of: 0 },
    proposed_flawed: { caught: 0, of: 0 },
    proposed_correct: { false_alarms: 0, of: 0 },
    reported_correct: { false_alarms: 0, of: 0 },
    abstained: { on_flawed: 0, on_correct: 0 },
  };
  for (const g of gold) {
    const d = byId.get(g.id)?.decision ?? null;
    if (d === null) s.no_verdict++;
    const fail = d === 'fail';
    if (d === 'abstain') {
      if (flawed(g.label)) s.abstained.on_flawed++;
      else s.abstained.on_correct++;
    }
    if (g.group === 'A-confirmed-miss') {
      if (g.label_status !== 'confirmed' || !flawed(g.label)) {
        throw new Error(`${g.id} is in the confirmed-miss group but is not a confirmed wrong or misleading label`);
      }
      s.confirmed_misses.of++;
      if (fail) s.confirmed_misses.caught++;
    }
    if (flawed(g.label)) {
      s.proposed_flawed.of++;
      if (fail) s.proposed_flawed.caught++;
    } else {
      s.proposed_correct.of++;
      if (fail) s.proposed_correct.false_alarms++;
    }
    if (g.prior_ruling?.label === 'correct') {
      s.reported_correct.of++;
      if (fail) s.reported_correct.false_alarms++;
    }
  }
  return s;
}

/**
 * Split a results file's rows into each item's first and latest row. A file
 * holds more than one row per item only when no-verdict items were retried.
 */
export function firstAndLatest<T extends { id: string }>(rows: T[]): { first: Map<string, T>; latest: Map<string, T> } {
  const first = new Map<string, T>();
  const latest = new Map<string, T>();
  for (const r of rows) {
    if (!first.has(r.id)) first.set(r.id, r);
    latest.set(r.id, r);
  }
  return { first, latest };
}

// ─── v3: two passes (extract, then verify against a reference list), with abstain ───
//
// Pass 1 extracts atomic claims and types them, with no judgment.
// Pass 2 checks each claim against REFERENCE_FACTS and general professional
// knowledge. "contradicted" needs a specific fact that the claim gets wrong.
// Imprecise or simplified wording is "imprecise", which never fails an
// explanation. That targets v2's main false-alarm source: pedantic
// "misleading" calls. The sign-off has a third answer, "unsure", which
// makes the verifier abstain instead of guessing.
//
// The reference list deliberately leaves out every fact behind the five
// confirmed misses (EHR chart access, environments, chain patient profiles,
// prescription labels and transfers), so it cannot hand the verifier those
// catches. Facts that touch a proposed-label dev item are tagged dev_item.

export interface ReferenceFact { id: string; area: string; fact: string; dev_item?: string }
export const REFERENCE_FACTS: ReferenceFact[] = [
  { id: 'R1', area: 'pharmacy', fact: 'In US pharmacies, final product verification of a filled prescription is limited to a licensed pharmacist. Technicians may enter and fill prescriptions.' },
  { id: 'R2', area: 'pharmacy', fact: 'Drug-interaction and DUR screening in pharmacy systems runs on licensed clinical knowledge bases (such as First Databank or Medi-Span) with rules, not on large language models.', dev_item: 'ai-llm::pharmacist' },
  { id: 'R3', area: 'pharmacy', fact: 'Retail pharmacy claims adjudicate in real time with the PBM using the NCPDP Telecommunication Standard, usually through a switch. A rejected claim comes back as an NCPDP reject code inside a normal response, not as a transport or HTTP error.', dev_item: 'sys-http-response::pharmacist' },
  { id: 'R4', area: 'pharmacy', fact: 'Alert fatigue from frequent, low-value drug-interaction alerts is well documented, and pharmacists override most of them.' },
  { id: 'R5', area: 'pharmacy', fact: 'Schedule II controlled substances need a valid prescription and carry extra record-keeping and inventory rules. More checks on a C-II is a safeguard practice, not an authentication factor.' },
  { id: 'R6', area: 'nursing', fact: 'SBAR (Situation, Background, Assessment, Recommendation) is a structured verbal or written handoff communication format. Patient identification and location belong to its Situation section. It is a way of speaking or writing a handoff, not a document attached to a chart.', dev_item: 'sys-payload::nurse, sys-http-header::nurse' },
  { id: 'R7', area: 'nursing', fact: 'Clinical alarm fatigue (for example from pumps and monitors) is well documented, and The Joint Commission issued a sentinel event alert on it in 2013.' },
  { id: 'R8', area: 'nursing', fact: 'Hospital nurse staffing flexes with census: extra staff are called in when census rises and staff are flexed off or called off when it falls.' },
  { id: 'R9', area: 'nursing', fact: 'EHRs assign permissions by role (nurse, physician, pharmacist, unit clerk). Each role can see and do different things.' },
  { id: 'R10', area: 'schools', fact: 'Student information systems and gradebooks usually show a teacher only the students in their own sections, and principals see their own school.' },
  { id: 'R11', area: 'tech', fact: 'In Power BI, a calculated column is computed per row at data refresh and stored. When a visual aggregates a calculated column, the total still responds to slicers and filters. What does not respond is the stored per-row value.', dev_item: 'bi-calculated-column::*' },
  { id: 'R12', area: 'tech', fact: 'Anthropic and OpenAI have not published parameter counts for Claude or GPT-5 models. Running a 70B open model on a laptop needs quantization and a high-memory machine.', dev_item: 'aid-parameters::pharmacist' },
  { id: 'R13', area: 'tech', fact: 'OAuth 2.0 is an authorization framework that issues access tokens. Sign-in on top of it is usually OpenID Connect. Learner-level explanations commonly describe both as OAuth, which is acceptable simplification.' },
  { id: 'R14', area: 'tech', fact: 'Under HIPAA, loss of properly encrypted protected health information is generally not a reportable breach (the encryption safe harbor).' },
  { id: 'R15', area: 'tech', fact: 'Session cookies with no expiry are cleared when the browser session ends, including a restart for an update.' },
];

export const V3_VERDICTS = ['supported', 'imprecise', 'contradicted', 'abstain'] as const;
export type V3Verdict = (typeof V3_VERDICTS)[number];

export function v3ExtractSystemPrompt(): string {
  const types = Object.entries(CLAIM_TYPES).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  return `You extract factual claims from a short plain-language explanation of a technical term written for a working professional. Do not judge them.

List every checkable factual claim in long_definition, why_it_matters and example_in_sentence, one atomic claim per item, in your own words. Include claims a comparison or the example implies without stating them, for example how a workplace system behaves, who can see or do what, or what an artifact carries. Skip pure opinion and pure advice.

Give each claim one type:
${types}

Mark load_bearing true when the explanation's teaching depends on the claim (the definition, the central comparison, or the example's cause and effect), and false for incidental detail.

Reply with ONLY one JSON object: {"claims":[{"type":"TECH|PRACTICE|MAPPING|SCENARIO|EXTERNAL","claim":"...","load_bearing":true|false}]}`;
}

export function v3VerifySystemPrompt(): string {
  const refs = REFERENCE_FACTS.map((r) => `${r.id} (${r.area}): ${r.fact}`).join('\n');
  return `You verify a list of factual claims taken from a plain-language explanation written for one learner. A careful expert in the learner's field will read the explanation, and they will reject it only for a claim that is actually false.

TRUSTED REFERENCE FACTS (United States practice). When a claim touches one of these, the fact decides:
${refs}

For each claim choose one verdict:
- supported: true as stated.
- imprecise: loosely worded or slightly overstated, but the stated fact is still true.
- contradicted: as stated, the claim is false. Name the fact that shows it. A publicly unknown number stated as certain counts as contradicted.
- abstain: you cannot tell whether it is true.

Two standards, by claim type:
- TECH and EXTERNAL claims may simplify the technology for a newcomer. A simplification is imprecise, not contradicted, if what the learner ends up believing is still true.
- PRACTICE, MAPPING and SCENARIO claims describe the learner's own field, which the learner and the expert know well. They get no simplification leeway. If typical United States practice differs from what the claim says (who can access what, what a system is connected to, what an artifact carries, how a process works between people), the claim is contradicted, even when a nearby simplified version would be true. Do not excuse such a claim as illustrative, simplified or sandbox-like. A plausible, ordinary scenario that matches how the field works is supported.
Use contradicted only when you can state the fact that makes the claim false. Never use it for wording, emphasis or tone.

Then answer the expert sign-off: would the named expert publish this explanation to a colleague as written? "yes", "no" (only if at least one claim is contradicted) or "unsure".

The CANONICAL entry is a reference written by the product team and can itself be wrong.

Reply with ONLY one JSON object: {"checks":[{"index":0,"verdict":"supported|imprecise|contradicted|abstain","basis":"reference id, fact, or empty","reason":"one sentence"}],"signoff":"yes|no|unsure","signoff_reason":"one sentence"}`;
}

export interface V3Claim { type: ClaimType; claim: string; load_bearing: boolean }
export interface V3Check { index: number; verdict: V3Verdict; basis: string; reason: string }
export interface V3Result { claims: V3Claim[]; checks: V3Check[]; signoff: 'yes' | 'no' | 'unsure'; signoff_reason: string }

export function v3VerifyUserMessage(args: {
  canonical: CanonicalTerm;
  candidate: CandidateText;
  profileId: string;
  profile: LearnerProfile;
  claims: V3Claim[];
}): string {
  const list = args.claims.map((c, i) => `${i}. [${c.type}${c.load_bearing ? ', load-bearing' : ''}] ${c.claim}`).join('\n');
  return `${v2UserMessage(args)}

CLAIMS TO VERIFY:
${list}

Return a check for every claim index, then the sign-off. JSON only.`;
}

export const V3_EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: Object.keys(CLAIM_TYPES) },
          claim: { type: 'string' },
          load_bearing: { type: 'boolean' },
        },
        required: ['type', 'claim', 'load_bearing'],
      },
    },
  },
  required: ['claims'],
} as const;

export const V3_VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          verdict: { type: 'string', enum: [...V3_VERDICTS] },
          basis: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['index', 'verdict', 'basis', 'reason'],
      },
    },
    signoff: { type: 'string', enum: ['yes', 'no', 'unsure'] },
    signoff_reason: { type: 'string' },
  },
  required: ['checks', 'signoff', 'signoff_reason'],
} as const;

function asObject(raw: unknown): any {
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(stripFence(raw));
  } catch {
    return null;
  }
}

export function parseV3Claims(raw: unknown): V3Claim[] | null {
  const o = asObject(raw);
  if (!o || !Array.isArray(o.claims) || o.claims.length === 0) return null;
  for (const c of o.claims) {
    if (!c || !(c.type in CLAIM_TYPES) || typeof c.claim !== 'string' || typeof c.load_bearing !== 'boolean') return null;
  }
  return o.claims.map((c: any) => ({ type: c.type, claim: c.claim, load_bearing: c.load_bearing }));
}

/** Parse pass 2. Every claim index must be checked exactly once. */
export function parseV3Checks(raw: unknown, nClaims: number): Omit<V3Result, 'claims'> | null {
  const o = asObject(raw);
  if (!o || !Array.isArray(o.checks)) return null;
  if (!['yes', 'no', 'unsure'].includes(o.signoff) || typeof o.signoff_reason !== 'string') return null;
  const seen = new Set<number>();
  for (const c of o.checks) {
    if (!c || !Number.isInteger(c.index) || c.index < 0 || c.index >= nClaims || seen.has(c.index)) return null;
    if (!(V3_VERDICTS as readonly string[]).includes(c.verdict)) return null;
    if (typeof c.reason !== 'string' || typeof c.basis !== 'string') return null;
    seen.add(c.index);
  }
  if (seen.size !== nClaims) return null;
  return {
    checks: o.checks.map((c: any) => ({ index: c.index, verdict: c.verdict, basis: c.basis, reason: c.reason })),
    signoff: o.signoff,
    signoff_reason: o.signoff_reason,
  };
}

/**
 * v3 decision. fail: a load-bearing claim is contradicted, or the expert
 * would not sign off. abstain: nothing fails but the expert is unsure. pass:
 * otherwise. Imprecise claims and contradicted incidental details alone never
 * fail an explanation.
 */
export function decideV3(r: V3Result): 'pass' | 'fail' | 'abstain' {
  const contradictedLoadBearing = r.checks.some((c) => c.verdict === 'contradicted' && r.claims[c.index]?.load_bearing);
  if (contradictedLoadBearing || r.signoff === 'no') return 'fail';
  if (r.signoff === 'unsure') return 'abstain';
  return 'pass';
}

/**
 * The frozen rule (FROZEN-RULE.json): cross-family consensus. An explanation
 * fails only when both verifiers fail it: v3 two-pass on a Claude model and
 * v2 single-pass (lenient rule) on a Gemini model. Any missing or abstained
 * verdict on either side makes the consensus abstain, so a broken call can
 * never pass an explanation silently.
 */
export function decideConsensus(
  v3: 'pass' | 'fail' | 'abstain' | null,
  v2Gemini: 'pass' | 'fail' | null,
): 'pass' | 'fail' | 'abstain' {
  if (v3 === null || v3 === 'abstain' || v2Gemini === null) return 'abstain';
  return v3 === 'fail' && v2Gemini === 'fail' ? 'fail' : 'pass';
}
