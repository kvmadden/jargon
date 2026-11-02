// Jargon Stage B+1.12 — server-side AI gift-profile composer.
//
// Replaces the 13-step manual gift-send wizard's primary path with a single
// freeform "tell me about them" textarea. The sender pastes (or dictates) a
// paragraph about the recipient; this Edge Function calls Opus 4.7 to draft
// the entire PrefilledProfile + custom_message + private_reasoning + a
// curated set of "lived icons" (Phosphor slugs from a hand-picked allowlist).
//
// The 13-step wizard becomes the SECONDARY ("compose by hand") path — used
// when the sender prefers structure or when this function falls back.
//
// 2-pass flow (mirrors `personalize-term`'s structural pattern):
//   Pass 1 — Opus 4.7 generates a candidate proposed_profile.
//   Pass 2 — Opus 4.7 self-verifies the candidate against simple rubric
//            (faithful to input, no invented facts, lived_icons valid).
//            Returns "ok" → confidence: 'high' OR "needs-rework" →
//            confidence: 'medium' (we still return what pass1 produced —
//            the user is the human-in-the-loop).
// No pass3 retry. The user reviews + edits everything anyway.
//
// Hard constraints:
//   - PERSONAL_TIMEOUT_MS = 60_000 per pass (stricter than personalize-term's
//     30s because the prompt + output are larger; 60s gives Opus headroom).
//   - PASS1_MAX_TOKENS = 4000 (the proposed_profile + drafts are dense).
//   - PASS2_MAX_TOKENS = 800 (verifier returns short JSON).
//   - AbortController + { signal } on every Anthropic call. NEVER Promise.race
//     (banned per project convention — doesn't actually cancel the in-flight HTTP
//     request, token spend continues until Anthropic's own timeout).
//
// Logging:
//   One row per call to compose_gift_log (cloud-migration-034) regardless of
//   outcome. Tracks per-pass status + total cost + recipient_name + describe
//   length (NOT the describe text itself — see migration-034 PRIVACY NOTE).
//
// Auth:
//   JWT-gated via shared `getUserFromJWT`. Allowlist-gated via shared
//   `isAllowlisted` (sender must already have an active jargon account).
//
// Failure semantics:
//   On ANY failure (parse, anthropic error, timeout, missing key) → return
//   `{ proposed_profile: <empty>, custom_message_draft: '', private_reasoning_draft: '',
//      lived_icons: [], confidence: 'low', isFallback: true }` with HTTP 200.
//   The client falls through to the 13-step manual wizard with recipient
//   name + email pre-filled.
//
// Per-call cost estimate (Opus 4.7 at $15/MTok in, $75/MTok out):
//   Pass 1: ~1500 in + ~1200 out = $0.0075 + $0.0300 = $0.0375
//   Pass 2: ~2500 in + ~200 out  = $0.0125 + $0.0050 = $0.0175
//   Total: ~$0.055/call. Worst case (verbose output) ≤ $0.10.
//
// Request:  POST {
//   recipient_name: string,
//   recipient_email: string,
//   freeform_describe: string,
//   sender_name: string,
//   relationship?: string | null,
//   voice_was_used?: boolean
// }
// Response: {
//   proposed_profile: PrefilledProfile,
//   custom_message_draft: string,
//   private_reasoning_draft: string,
//   lived_icons: string[],         // subset of LIVED_ICONS_ALLOWLIST, max 3
//   confidence: 'high' | 'medium' | 'low',
//   isFallback?: boolean
// }

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';
import { LIVED_ICONS_ALLOWLIST, validateLivedIcons } from '../_shared/lived-icons-allowlist.ts';
import { sanitizeProfileShape, type ProfileShape } from '../_shared/profile-shape.ts';

// ─── Constants ─────────────────────────────────────────────────────────────
// Retained Opus 4.7: synthesizing personalized gift profiles and message drafts from freeform text requires deep creative reasoning and taste.
const COMPOSE_MODEL = 'claude-opus-4-7';
const COMPOSE_TIMEOUT_MS = 60_000;
const PASS1_MAX_TOKENS = 4000;
const PASS2_MAX_TOKENS = 800;
const MAX_FREEFORM_CHARS = 2000;

// Opus 4.7 unit costs (USD per 1M tokens) — used to populate
// compose_gift_log.total_cost_usd. Spec §10.1: $15 input / $75 output per MTok.
const COST_PER_M_OPUS_4_7 = { in: 15.0, out: 75.0 } as const;

// ─── Shape contracts ───────────────────────────────────────────────────────

interface ComposeRequest {
  recipient_name: string;
  recipient_email: string;
  freeform_describe: string;
  sender_name: string;
  relationship?: string | null;
  voice_was_used?: boolean;
}

interface ComposeResponse {
  proposed_profile: ProfileShape;
  custom_message_draft: string;
  private_reasoning_draft: string;
  lived_icons: string[];
  confidence: 'high' | 'medium' | 'low';
  isFallback?: boolean;
}

interface ParsedProposed {
  display_name: string | null;
  job: string | null;
  heritage: string | null;
  interests: string[];
  roles: string[];
  encounter_contexts: string[];
  goals_extended: string[];
  goals_freeform: string | null;
  background_text: string | null;
  custom_message_draft: string;
  private_reasoning_draft: string;
  lived_icons: string[];
}

interface VerifierVerdict {
  faithful_to_input: 'pass' | 'fail';
  no_invented_facts: 'pass' | 'fail';
  icons_match_input: 'pass' | 'fail';
  drafts_read_natural: 'pass' | 'fail';
  overall: 'pass' | 'fail';
  reasoning: string;
}

type Pass1Status = 'success' | 'fallback-parse' | 'fallback-anthropic-error' | 'fallback-timeout' | 'skipped';
type Pass2Status =
  | 'success-ok'
  | 'success-needs-rework'
  | 'fallback-parse'
  | 'fallback-anthropic-error'
  | 'fallback-timeout'
  | 'skipped';
type FinalStatus =
  | 'success-high'
  | 'success-medium'
  | 'success-low'
  | 'fallback-empty-input'
  | 'fallback-pass1-parse'
  | 'fallback-pass1-anthropic-error'
  | 'fallback-pass1-timeout'
  | 'fallback-no-anthropic-key'
  | 'skipped-over-cap';

interface CallResult<T> {
  parsed: T | null;
  rawText: string;
  tokensIn: number;
  tokensOut: number;
}

interface LogState {
  user_id: string;
  request_started_at: string;
  request_started_ms: number;
  recipient_name: string;
  freeform_describe_chars: number;
  voice_was_used: boolean;
  pass1_status: Pass1Status | null;
  pass2_status: Pass2Status | null;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  error_text: string | null;
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function pass1SystemPrompt(): string {
  return `You are jargon's gift-profile composer. The sender is setting up a personalized jargon account for someone they love (a family member, mentor, partner, friend, colleague). They've described that person in their own words; your job is to draft the recipient's complete starter profile from that description.

jargon's voice is "translator, not professor." The profile you draft will drive Opus's per-term analogies for this recipient. Lean toward concrete, specific signals over abstract ones — "retired biology professor" beats "academic," "watches Tampa Bay Buccaneers" beats "follows football."

INPUT:
- The sender's name + their freeform description of the recipient
- Optionally: their relationship (father-in-law, mentor, friend, etc.)

OUTPUT (single JSON object, no markdown, no commentary):
{
  "display_name": "what to call them in greetings (first name, nickname). Capitalization preserved verbatim. Null if the description doesn't reveal it.",
  "job": "their work, with subspecialty if mentioned. Null if not mentioned.",
  "heritage": "country/region/origin if mentioned (e.g. 'Liverpool, England' or 'Cuban-American'). Null if not.",
  "interests": ["array of 3-8 specific hobbies, sports, shows, fandoms — concrete nouns only. Empty array if none mentioned."],
  "roles": ["array of 0-4 from this fixed set: parent, grandparent, partner, manager, mentor, student, immigrant, veteran, caretaker, freelancer, entrepreneur, other. Match what the description supports. Empty array if none apply."],
  "encounter_contexts": ["array of 0-4 from this fixed set: tech podcasts, family / friends, news articles, job listings, slack at work, nowhere yet — fresh start. Pick what fits where they'd hear coding/AI terms. Empty array if unknown."],
  "goals_extended": ["array of 0-3 from this fixed set, framed in third-person: 'follow what their dev family is up to', 'sound credible at work', 'just curious how software really works', 'keep up with their kid / partner'. Pick what the sender's description supports. Empty array if unclear."],
  "goals_freeform": "1-3 sentence paraphrase of WHY the sender thinks this person needs jargon, in second person referring to them ('you might want to follow what your daughter does', etc.). Use the sender's own framing where possible. Null if there's nothing to draw from.",
  "background_text": "2-4 sentence rich background — interests, quirks, the way they think — anything that would help an Opus translator land an analogy. Pull verbatim phrases from the sender's description when they're vivid. Null if the description is too sparse.",
  "custom_message_draft": "A short note (≤280 chars) the sender could send the recipient as the gift's invite copy. Lowercase except proper nouns. Translator-not-professor voice. Reference one specific thing from the description so it doesn't read generic. Address the recipient directly using display_name when available. NO emojis. NO 'Dear ___,' formal openings. Drop straight in, like a real text message.",
  "private_reasoning_draft": "1-2 sentences capturing what the sender is REALLY trying to give the recipient — their unfiltered intent. The recipient never sees this; Opus uses it to ground analogies. Refer to the recipient in third person ('Avery' or 'he/she'). Pull from the description's emotional core ('Avery keeps asking what I do for work and I want him to be able to ask better questions').",
  "lived_icons": ["array of EXACTLY 3 Phosphor icon slugs from the allowlist below. Pick the 3 that most concretely represent THIS recipient's world. Order: most-defining first."]
}

LIVED ICONS ALLOWLIST (pick exactly 3 — slugs MUST match exactly, lowercase):
${LIVED_ICONS_ALLOWLIST.join(', ')}

RULES:
- Capitalization in all freeform text fields (display_name, job, heritage, interests items, background_text, etc.) is preserved as the sender wrote it. Don't force lowercase, don't force titlecase.
- Don't invent facts the description doesn't support. If they didn't say where the recipient is from, leave heritage null. Better to under-fill than to fabricate.
- "Other" is a valid roles value — use it when the description names a role outside the fixed set ("retired professor", "stay-at-home dad before kids grew up").
- interests should be specific NOUNS the recipient actually engages with, not abstractions. "soccer" yes, "sports" no. "Red Dead Redemption" yes, "video games" only if no specific game named.
- The custom_message_draft is what the recipient SEES first when they open the gift. Make it land.
- The private_reasoning_draft is what the SENDER would say if asked "why this person, why now?" — the unfiltered version they'd never say to the recipient's face.
- lived_icons MUST be exactly 3 slugs, ALL from the allowlist. If you can only confidently pick 1-2, still return 3 — pad with the most generic fits ('briefcase', 'house', 'star', etc.).
- Return ONE JSON object only. No markdown fences, no preamble, no commentary.`;
}

function buildPass1User(req: ComposeRequest): string {
  const rel = req.relationship?.trim();
  const lines: string[] = [
    `SENDER: ${req.sender_name}`,
    `RECIPIENT NAME (from email setup): ${req.recipient_name}`,
  ];
  if (rel && rel.length > 0) {
    lines.push(`SENDER'S RELATIONSHIP TO RECIPIENT: ${rel}`);
  }
  lines.push('', 'SENDER\'S DESCRIPTION OF THE RECIPIENT:', req.freeform_describe.trim());
  lines.push('', 'Draft the recipient\'s complete starter profile. Return JSON only.');
  return lines.join('\n');
}

function pass2SystemPrompt(): string {
  return `You are the verifier for jargon's gift-profile composer.

The composer just drafted a complete recipient profile from the sender's freeform description. Your job: classify whether the draft is FAITHFUL to what the sender actually said vs INVENTED beyond it, and whether the lived_icons make sense for this person.

You receive:
- The sender's original freeform description
- The composer's drafted profile (all fields)

Verify on these four pass/fail criteria. Return ONE JSON object on one line.

1. faithful_to_input
   Every claim in the draft profile is anchored in the sender's description. The draft can rephrase or paraphrase, but it CAN'T invent facts the sender didn't provide. (E.g. if the sender said "my dad's a retired biology professor in Tampa," it's fine for the draft to say job="retired biology professor in Tampa, FL" but NOT fine to say heritage="Cuban-American" if Cuban heritage wasn't mentioned.)

2. no_invented_facts
   Specifically check the heritage / roles / interests fields for fabrication. If the sender didn't mention where the recipient is from, heritage should be null. If the sender didn't mention specific hobbies, interests should be empty or only contain things directly named. Pass = no fabrication. Fail = at least one invented fact.

3. icons_match_input
   The 3 lived_icons should each have a clear connection to something the sender mentioned. ("soccer-ball" if the sender mentioned soccer; "leaf" or "tree" if biology professor; "guitar" only if music was mentioned.) Pass = all 3 icons are defensible. Fail = at least one icon is decorative-only / unsupported.

4. drafts_read_natural
   The custom_message_draft and private_reasoning_draft should sound like a real human said them, not a template. Lowercase except proper nouns. No formal openings. References specific facts from the input. Pass = both drafts feel personal. Fail = either draft reads generic/template.

Reply with ONLY a single JSON object on one line:
{"faithful_to_input":"pass"|"fail","no_invented_facts":"pass"|"fail","icons_match_input":"pass"|"fail","drafts_read_natural":"pass"|"fail","overall":"pass"|"fail","reasoning":"one short sentence"}

overall = "pass" only if ALL FOUR criteria are "pass". Otherwise "fail". No markdown. No extra text.`;
}

function buildPass2User(req: ComposeRequest, draft: ParsedProposed): string {
  const rel = req.relationship?.trim();
  const lines: string[] = [
    `SENDER: ${req.sender_name}`,
    `RECIPIENT: ${req.recipient_name}`,
  ];
  if (rel) lines.push(`RELATIONSHIP: ${rel}`);
  lines.push(
    '',
    'SENDER\'S ORIGINAL DESCRIPTION:',
    req.freeform_describe.trim(),
    '',
    'COMPOSER\'S DRAFT:',
    JSON.stringify(
      {
        display_name: draft.display_name,
        job: draft.job,
        heritage: draft.heritage,
        interests: draft.interests,
        roles: draft.roles,
        encounter_contexts: draft.encounter_contexts,
        goals_extended: draft.goals_extended,
        goals_freeform: draft.goals_freeform,
        background_text: draft.background_text,
        custom_message_draft: draft.custom_message_draft,
        private_reasoning_draft: draft.private_reasoning_draft,
        lived_icons: draft.lived_icons,
      },
      null,
      2,
    ),
    '',
    'Verify against the four criteria. Return JSON only.',
  );
  return lines.join('\n');
}

// ─── Parsing ───────────────────────────────────────────────────────────────

function stripFencing(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function asString(v: any): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function asArray(v: any, max = 50): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (t.length === 0) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function parseProposed(raw: string): ParsedProposed | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      display_name: asString(parsed.display_name),
      job: asString(parsed.job),
      heritage: asString(parsed.heritage),
      interests: asArray(parsed.interests, 20),
      roles: asArray(parsed.roles, 8),
      encounter_contexts: asArray(parsed.encounter_contexts, 8),
      goals_extended: asArray(parsed.goals_extended, 8),
      goals_freeform: asString(parsed.goals_freeform),
      background_text: asString(parsed.background_text),
      custom_message_draft: asString(parsed.custom_message_draft) ?? '',
      private_reasoning_draft: asString(parsed.private_reasoning_draft) ?? '',
      lived_icons: validateLivedIcons(parsed.lived_icons, 3),
    };
  } catch {
    return null;
  }
}

function parseVerdict(raw: string): VerifierVerdict | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const isPF = (v: any): v is 'pass' | 'fail' => v === 'pass' || v === 'fail';
    if (
      !isPF(parsed.faithful_to_input) ||
      !isPF(parsed.no_invented_facts) ||
      !isPF(parsed.icons_match_input) ||
      !isPF(parsed.drafts_read_natural) ||
      !isPF(parsed.overall)
    ) {
      return null;
    }
    return {
      faithful_to_input: parsed.faithful_to_input,
      no_invented_facts: parsed.no_invented_facts,
      icons_match_input: parsed.icons_match_input,
      drafts_read_natural: parsed.drafts_read_natural,
      overall: parsed.overall,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 500) : '',
    };
  } catch {
    return null;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function emptyResponse(): ComposeResponse {
  return {
    proposed_profile: {
      goals_extended: [],
      goals_freeform: null,
      job: null,
      encounter_contexts: [],
      interests: [],
      heritage: null,
      roles: [],
      background_text: null,
      display_name: null,
      relationship: null,
    },
    custom_message_draft: '',
    private_reasoning_draft: '',
    lived_icons: [],
    confidence: 'low',
    isFallback: true,
  };
}

function estimateOpusCost(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * COST_PER_M_OPUS_4_7.in +
    (tokensOut / 1_000_000) * COST_PER_M_OPUS_4_7.out
  );
}

async function callOpusWithTimeout<T>(
  anthropic: Anthropic,
  args: { system: string; user: string; maxTokens: number },
  parser: (raw: string) => T | null,
): Promise<CallResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMPOSE_TIMEOUT_MS);
  try {
    const response = (await anthropic.messages.create(
      {
        model: COMPOSE_MODEL,
        max_tokens: args.maxTokens,
        system: [
          {
            type: 'text',
            text: args.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: args.user }],
      },
      { signal: controller.signal },
    )) as any;
    const block = response?.content?.[0];
    const rawText = block && block.type === 'text' ? (block.text as string) : '';
    return {
      parsed: rawText ? parser(rawText) : null,
      rawText,
      tokensIn: response?.usage?.input_tokens ?? 0,
      tokensOut: response?.usage?.output_tokens ?? 0,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function writeLog(
  serviceClient: SupabaseClient,
  state: LogState,
  finalStatus: FinalStatus,
): Promise<void> {
  const totalLatencyMs = Date.now() - state.request_started_ms;
  const totalCost = Math.round(state.total_cost_usd * 100_000) / 100_000;
  try {
    const { error } = await serviceClient.from('compose_gift_log').insert({
      user_id: state.user_id,
      request_started_at: state.request_started_at,
      recipient_name: state.recipient_name,
      freeform_describe_chars: state.freeform_describe_chars,
      voice_was_used: state.voice_was_used,
      pass1_status: state.pass1_status,
      pass2_status: state.pass2_status,
      total_tokens_in: state.total_tokens_in,
      total_tokens_out: state.total_tokens_out,
      total_cost_usd: totalCost,
      total_latency_ms: totalLatencyMs,
      final_status: finalStatus,
      error_text: state.error_text,
    });
    if (error) {
      console.error('[compose-gift-profile] compose_gift_log insert failed:', error.message);
    }
  } catch (err) {
    console.error('[compose-gift-profile] compose_gift_log insert threw:', err);
  }
}

// ─── Edge Function entry ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  const requestStartedMs = Date.now();
  const requestStartedAt = new Date(requestStartedMs).toISOString();

  // ─── Auth: JWT + allowlist ──────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return jsonResponse(req, { error: 'missing authorization bearer' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(
      req,
      { error: 'server misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing' },
      500,
    );
  }

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email || !user?.id) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email/id' }, 401);
  }
  const userId = user.id;

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const allow = await isAllowlisted(serviceClient, user.email);
  if (!allow.allowed) {
    return jsonResponse(req, { error: 'not on allowlist' }, 403);
  }

  // ─── Body validation ────────────────────────────────────────────────────
  let body: ComposeRequest;
  try {
    body = (await req.json()) as ComposeRequest;
  } catch {
    return jsonResponse(req, { error: 'invalid json body' }, 400);
  }
  if (
    typeof body.recipient_name !== 'string' ||
    typeof body.recipient_email !== 'string' ||
    typeof body.freeform_describe !== 'string' ||
    typeof body.sender_name !== 'string'
  ) {
    return jsonResponse(req, { error: 'missing or non-string required field' }, 400);
  }

  const recipientName = body.recipient_name.trim().slice(0, 120);
  const recipientEmail = body.recipient_email.trim().toLowerCase().slice(0, 254);
  const senderName = body.sender_name.trim().slice(0, 120);
  const relationship = body.relationship ? body.relationship.trim().slice(0, 60) : null;
  const voiceWasUsed = body.voice_was_used === true;

  // Length-cap describe text BEFORE measuring chars or sending to Opus.
  // The textarea on the client already enforces 2000 but we don't trust the
  // wire — a paste-bombed prompt would otherwise blow past max_tokens.
  const describe = body.freeform_describe.trim().slice(0, MAX_FREEFORM_CHARS);
  const describeChars = describe.length;

  // Initialize log accumulator so every code path below writes a row.
  const state: LogState = {
    user_id: userId,
    request_started_at: requestStartedAt,
    request_started_ms: requestStartedMs,
    recipient_name: recipientName,
    freeform_describe_chars: describeChars,
    voice_was_used: voiceWasUsed,
    pass1_status: null,
    pass2_status: null,
    total_tokens_in: 0,
    total_tokens_out: 0,
    total_cost_usd: 0,
    error_text: null,
  };

  // Empty describe → short-circuit before calling Opus.
  if (describeChars === 0) {
    state.pass1_status = 'skipped';
    state.pass2_status = 'skipped';
    await writeLog(serviceClient, state, 'fallback-empty-input');
    return jsonResponse(req, emptyResponse(), 200);
  }

  // Recipient-email sanity (mirrors EMAIL_REGEX in client). We don't bounce —
  // just log it as part of the request. The send-gift-invite call later will
  // hard-fail on a bad email; the composer can still return useful drafts.
  // (No-op assignment kept intentional for future hooks.)
    void recipientEmail;

  // ─── Spend check ─────────────────────────────────────────────────────────────
  const spend = await checkSpend(serviceClient, userId);
  if (!spend.allowed) {
    state.pass1_status = 'skipped';
    state.pass2_status = 'skipped';
    state.error_text = 'over spend cap';
    await writeLog(serviceClient, state, 'skipped-over-cap');
    return jsonResponse(req, emptyResponse(), 200);
  }

  // ─── Anthropic key gate ─────────────────────────────────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    state.pass1_status = 'skipped';
    state.pass2_status = 'skipped';
    state.error_text = 'ANTHROPIC_API_KEY env var not set';
    await writeLog(serviceClient, state, 'fallback-no-anthropic-key');
    return jsonResponse(req, emptyResponse(), 200);
  }
  // Q17: prefer AI Gateway when configured; fall back to direct Anthropic.
  const gwBase = Deno.env.get('AI_GATEWAY_BASE_URL');
  const gwKey = Deno.env.get('AI_GATEWAY_API_KEY');
  const useGateway = Boolean(gwBase && gwKey);
  const anthropic = useGateway
    ? new Anthropic({
        apiKey: gwKey,
        // Gateway exposes Anthropic-compat surface at /anthropic
        // (e.g. https://gateway.ai.vercel.app/v1/anthropic).
        baseURL: `${gwBase}/anthropic`,
      })
    : new Anthropic({ apiKey: anthropicKey });

  // ─── PASS 1 — Generate proposed profile ─────────────────────────────────
  const composeReq: ComposeRequest = {
    recipient_name: recipientName,
    recipient_email: recipientEmail,
    freeform_describe: describe,
    sender_name: senderName,
    relationship,
    voice_was_used: voiceWasUsed,
  };

  let pass1: CallResult<ParsedProposed>;
  try {
    pass1 = await callOpusWithTimeout(
      anthropic,
      {
        system: pass1SystemPrompt(),
        user: buildPass1User(composeReq),
        maxTokens: PASS1_MAX_TOKENS,
      },
      parseProposed,
    );
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.pass1_status = isAbort ? 'fallback-timeout' : 'fallback-anthropic-error';
    state.pass2_status = 'skipped';
    state.error_text = `pass1: ${err?.message ?? String(err)}`;
    console.error('[compose-gift-profile] pass1 error:', err);
    await writeLog(
      serviceClient,
      state,
      isAbort ? 'fallback-pass1-timeout' : 'fallback-pass1-anthropic-error',
    );
    return jsonResponse(req, emptyResponse(), 200);
  }

  state.total_tokens_in += pass1.tokensIn;
  state.total_tokens_out += pass1.tokensOut;
  state.total_cost_usd += estimateOpusCost(pass1.tokensIn, pass1.tokensOut);

  if (!pass1.parsed) {
    state.pass1_status = 'fallback-parse';
    state.pass2_status = 'skipped';
    state.error_text = `pass1 unparseable: ${pass1.rawText.slice(0, 200)}`;
    await writeLog(serviceClient, state, 'fallback-pass1-parse');
    return jsonResponse(req, emptyResponse(), 200);
  }

  state.pass1_status = 'success';
  const proposed = pass1.parsed;

  // ─── PASS 2 — Verify ────────────────────────────────────────────────────
  let pass2: CallResult<VerifierVerdict> | null = null;
  try {
    pass2 = await callOpusWithTimeout(
      anthropic,
      {
        system: pass2SystemPrompt(),
        user: buildPass2User(composeReq, proposed),
        maxTokens: PASS2_MAX_TOKENS,
      },
      parseVerdict,
    );
    state.total_tokens_in += pass2.tokensIn;
    state.total_tokens_out += pass2.tokensOut;
    state.total_cost_usd += estimateOpusCost(pass2.tokensIn, pass2.tokensOut);
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message ?? ''));
    state.pass2_status = isAbort ? 'fallback-timeout' : 'fallback-anthropic-error';
    state.error_text = `pass2: ${err?.message ?? String(err)}`;
    console.error('[compose-gift-profile] pass2 error:', err);
    // Fall through with confidence = 'low' — pass1 succeeded, we just don't
    // have a verifier verdict. Better to ship pass1's draft (which the user
    // edits anyway) than to return empty.
  }

  // Build final response. Confidence rules:
  //   pass2 ok       → 'high'
  //   pass2 needs-rework or unparseable or thrown → 'medium' (only if pass1 had rich output)
  //   pass1 had thin output → 'low'
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (pass2?.parsed?.overall === 'pass') {
    confidence = 'high';
    state.pass2_status = 'success-ok';
  } else if (pass2?.parsed?.overall === 'fail') {
    confidence = 'medium';
    state.pass2_status = 'success-needs-rework';
  } else if (pass2 && !pass2.parsed) {
    confidence = 'medium';
    state.pass2_status = 'fallback-parse';
  }
  // Sparse output check — if Opus barely populated anything, downgrade to
  // 'low' regardless of pass2 verdict so the UI can hint "hand-edit recommended."
  const populatedCount =
    (proposed.job ? 1 : 0) +
    (proposed.heritage ? 1 : 0) +
    (proposed.background_text ? 1 : 0) +
    (proposed.interests.length > 0 ? 1 : 0) +
    (proposed.roles.length > 0 ? 1 : 0);
  if (populatedCount <= 1) confidence = 'low';

  // Sanitize the proposed profile through the shared sanitizer so the wire
  // contract matches every other gift handoff. The sanitizer also length-
  // caps every text field (matches DB CHECK constraints).
  const sanitized = sanitizeProfileShape({
    goals_extended: proposed.goals_extended,
    goals_freeform: proposed.goals_freeform,
    job: proposed.job,
    encounter_contexts: proposed.encounter_contexts,
    interests: proposed.interests,
    heritage: proposed.heritage,
    roles: proposed.roles,
    background_text: proposed.background_text,
    display_name: proposed.display_name,
    relationship,  // sender's relationship-to-recipient passes through verbatim
  });

  // sanitizeProfileShape returns null only on null input; we know the input
  // is non-null, but TS doesn't. Defensive empty fallback.
  const finalProfile: ProfileShape = sanitized ?? {
    goals_extended: [],
    goals_freeform: null,
    job: null,
    encounter_contexts: [],
    interests: [],
    heritage: null,
    roles: [],
    background_text: null,
    display_name: null,
    relationship: null,
  };

  // Final status for the audit log derives from our confidence verdict.
  const finalStatus: FinalStatus =
    confidence === 'high' ? 'success-high' :
    confidence === 'medium' ? 'success-medium' :
    'success-low';

  await writeLog(serviceClient, state, finalStatus);

  const response: ComposeResponse = {
    proposed_profile: finalProfile,
    custom_message_draft: proposed.custom_message_draft.slice(0, 280),
    private_reasoning_draft: proposed.private_reasoning_draft.slice(0, 500),
    lived_icons: proposed.lived_icons,
    confidence,
  };

  return jsonResponse(req, response, 200);
});
