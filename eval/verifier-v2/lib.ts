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
export function expertFor(profileId: string): string {
  if (profileId === 'pharmacist') return 'licensed pharmacist';
  if (profileId === 'nurse') return 'registered nurse';
  if (profileId === 'teacher') return 'experienced high-school teacher';
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
EXPERT WHO MUST SIGN OFF: ${expertFor(profileId)}

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
export type DecisionRule = 'primary' | 'lenient';
export function decideV2(v: V2Verdict, rule: DecisionRule = 'primary'): 'pass' | 'fail' {
  const failing: ClaimVerdict[] = rule === 'primary' ? ['wrong', 'misleading'] : ['wrong'];
  if (v.signoff === 'no') return 'fail';
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
  decision: 'pass' | 'fail' | null; // null = no usable verdict
}

export interface ArmScore {
  n: number;
  no_verdict: number;
  confirmed_misses: { caught: number; of: number };
  proposed_flawed: { caught: number; of: number }; // label wrong or misleading, any status
  proposed_correct: { false_alarms: number; of: number };
  reported_correct: { false_alarms: number; of: number }; // prior expert ruling "correct"
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
  };
  for (const g of gold) {
    const d = byId.get(g.id)?.decision ?? null;
    if (d === null) s.no_verdict++;
    const fail = d === 'fail';
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
