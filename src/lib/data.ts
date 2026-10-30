// Data access layer — thin wrappers around Supabase queries used across screens.

import { supabase } from './supabase';
import { updateMastery, nextSrs, justMastered, isMastered, DEFAULT_EASE } from './lesson-engine';
import { todayLocalDate } from './streak-engine';
import { XP } from './xp';
import { getOrFetchTerms, invalidateTermsCache, fetchTermIndex, type TermIndexItem } from './terms-cache';
import { asGuidedProgramId, type GuidedProgramId } from './guided-programs';
import type {
  TermRow,
  UserProgressRow,
  PathId,
  StreakLogRow,
  UserProfileRow,
  UserTermRenderingRow,
  SpottedScanLogRow,
} from './database.types';
import type { RecentSpottedScan } from './spotted-recent';

export { invalidateTermsCache, fetchTermIndex, type TermIndexItem };

// ────────────────────────────────────────────────────────────
// Stage B+1.19 — robust data layer validation & custom errors
// ────────────────────────────────────────────────────────────

export class DataLayerError extends Error {
  constructor(
    message: string,
    public code: 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'NETWORK_ERROR' | 'UNAUTHORIZED' | 'NOT_FOUND',
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'DataLayerError';
    Object.setPrototypeOf(this, DataLayerError.prototype);
  }
}

function validateNonEmptyString(val: unknown, fieldName: string): string {
  if (typeof val !== 'string' || !val.trim()) {
    throw new DataLayerError(`${fieldName} must be a non-empty string`, 'VALIDATION_ERROR');
  }
  return val;
}

function validateEmail(val: unknown, fieldName: string): string {
  const str = validateNonEmptyString(val, fieldName);
  if (!str.includes('@')) {
    throw new DataLayerError(`${fieldName} must be a valid email`, 'VALIDATION_ERROR');
  }
  return str;
}

function validateBoolean(val: unknown, fieldName: string): boolean {
  if (typeof val !== 'boolean') {
    throw new DataLayerError(`${fieldName} must be a boolean`, 'VALIDATION_ERROR');
  }
  return val;
}

function validateNumber(val: unknown, fieldName: string): number {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new DataLayerError(`${fieldName} must be a valid number`, 'VALIDATION_ERROR');
  }
  return val;
}

function validateObject(val: unknown, fieldName: string): Record<string, unknown> {
  if (val == null || typeof val !== 'object' || Array.isArray(val)) {
    throw new DataLayerError(`${fieldName} must be a non-null object`, 'VALIDATION_ERROR');
  }
  return val as Record<string, unknown>;
}

export function validatePrefilledProfile(profile: unknown): PrefilledProfile {
  if (profile == null || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new DataLayerError('prefilled_profile must be an object', 'VALIDATION_ERROR');
  }
  const prof = profile as Record<string, unknown>;

  const getString = (val: unknown): string | null => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') return val;
    throw new DataLayerError('Expected string or null', 'VALIDATION_ERROR');
  };

  const getStringArray = (val: unknown): string[] => {
    if (val === undefined || val === null) return [];
    if (Array.isArray(val) && val.every(item => typeof item === 'string')) {
      return val;
    }
    throw new DataLayerError('Expected array of strings', 'VALIDATION_ERROR');
  };

  return {
    goals_extended: getStringArray(prof.goals_extended),
    goals_freeform: getString(prof.goals_freeform),
    job: getString(prof.job),
    encounter_contexts: getStringArray(prof.encounter_contexts),
    interests: getStringArray(prof.interests),
    heritage: getString(prof.heritage),
    roles: getStringArray(prof.roles),
    background_text: getString(prof.background_text),
    active_domain: getString(prof.active_domain),
    display_name: getString(prof.display_name),
    relationship: getString(prof.relationship),
    lived_icons: getStringArray(prof.lived_icons),
    lived_icon_url: getString(prof.lived_icon_url),
  };
}


// ────────────────────────────────────────────────────────────
// Stage B+1 — personalized translator
// ────────────────────────────────────────────────────────────

/**
 * Bumped if the personalize-term Edge Function's prompt or output schema changes
 * in a way that should invalidate every existing cached rendering. MUST match
 * the `PROMPT_VERSION` constant in supabase/functions/personalize-term/index.ts.
 * Bump no more than ~quarterly per spec §10.5.
 *
 * Stage B+1.1: bumped 1 → 2. The onboarding wizard adds two new profile fields
 * (`goals_extended`, `encounter_contexts`) and the system-prompt template now
 * passes them in. Existing cached renderings re-render lazily on next encounter.
 *
 * Stage B+1.2: bumped 2 → 3. The wizard grew from 5 → 7 steps and the profile
 * gained `heritage` (text) + `roles` (text[]). The system-prompt template now
 * passes both, and the prompt's RULES paragraph references heritage + roles
 * as analogy-domain widening signals. Existing v2 renderings re-render lazily
 * on next encounter, picking up the richer profile.
 *
 * Stage B+1.3: bumped 3 → 4. Multi-pass personalization (generate → verify →
 * regenerate). Cached single-pass renderings (v3) are stale and re-render
 * lazily on next encounter — they pick up a verifier-approved version, not
 * a first-shot one. Per-pass instrumentation lives server-side in
 * `personalize_log`; the client response shape is unchanged.
 *
 * Stage B+1.5: bumped 4 → 5. Pass 1 prompt now permits no-analogy writes
 * for plain terms (README, branch, copy, etc.) AND demands bidirectional
 * accuracy when an analogy IS used (the analogy-domain claims must be
 * factually correct, not just structurally aligned). Pass 2 verifier
 * gained two new criteria (analogy_target_accurate + analogy_is_warranted)
 * plus a uses_analogy classifier flag. Cached B+1.3 renderings (v4) are
 * stale and re-render lazily under the stricter rubric. Spec §7 is canonical.
 *
 * Stage B+1.5.1: bumped 5 → 6. Pass 1/Pass 3 system prompts are now
 * TEMPLATED — the literal "dev/AI/enterprise software vocabulary" is
 * substituted at call time via `vocabularyDescription(term.domain)`.
 * Today the substitution is the identity (only domain is 'coding'), but
 * the prompt structure changed → cache key invalidates → B+1.5 v5
 * renderings re-render lazily. The prompt-template extraction is the
 * prerequisite for shipping any second domain (per
 * MULTI-DOMAIN-EXTENSION.md §3 + §5).
 *
 * Stage B+1.6: bumped 6 → 7. Verifier credibility upgrade. The Pass 2
 * prompt now ships 5 worked PASS/FAIL examples for criterion 5
 * (`analogy_target_accurate`) so the verifier learns what a real
 * domain expert would catch (a salt-marsh tide cycle PASSES; "peer-
 * reviewing a manuscript" for `rebase` FAILS). A new 7th criterion
 * `analogy_target_accurate_specific` extends the rubric: when the
 * analogy domain is the user's own area of expertise, the wording
 * must use the TERMINOLOGY THE EXPERT WOULD USE — not simplified or
 * amateur vocabulary an expert would catch. Cached B+1.5.1 v6
 * renderings re-render lazily under the stricter rubric.
 *
 * v8 (B+1.16) — vocabulary discipline pass. The user's KNOWN vocabulary
 * (every term they've answered correctly at least once) flows into Pass 1
 * + Pass 2 prompts; a new 8th criterion `vocabulary_within_reach` fails
 * any candidate that uses in-domain jargon the user hasn't been taught
 * without inline definition. Closes the "uses 'branch' to teach 'merge'
 * before the user has ever seen 'branch'" gap. v7 cached renderings
 * re-render lazily on next encounter under v8.
 */
export const CURRENT_PROMPT_VERSION = 9;

/** Must match the model name written by the Edge Function. */
export const PERSONALIZE_MODEL = 'claude-opus-4-7';

/**
 * Result shape returned by `fetchPersonalizedRendering`. Drives the term-detail
 * mount logic — see the design spec §5.1.
 *
 * - `disabled`: no profile row OR personalization_enabled = false. Render canonical, no LLM.
 * - `missing` : profile exists + on, but no cache row yet. Render canonical, fire generation.
 * - `stale`   : cache row exists but version drift. Render cached personalized, fire generation.
 * - `fresh`   : cache row exists and current. Render personalized immediately.
 */
export type RenderingResult =
  | { status: 'disabled' }
  | { status: 'missing' }
  | { status: 'stale'; rendering: UserTermRenderingRow }
  | { status: 'fresh'; rendering: UserTermRenderingRow };

/**
 * Edge Function response shape. Mirrors PersonalizeResponse in
 * supabase/functions/personalize-term/index.ts.
 */
export interface PersonalizationResponse {
  long_definition: string;
  why_it_matters: string;
  example_in_sentence: string;
  fromCache: boolean;
  isFallback: boolean;
}

/**
 * Look up the cached personalized rendering for the current user + given term.
 * Returns a status discriminator so the caller can branch without re-querying
 * the profile separately. Read-only — no LLM, no writes.
 */
export async function fetchPersonalizedRendering(termId: string): Promise<RenderingResult> {
  validateNonEmptyString(termId, 'termId');
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    throw new DataLayerError(`Auth error in fetchPersonalizedRendering: ${sessionErr.message}`, 'UNAUTHORIZED', sessionErr);
  }
  const userId = sessionData?.session?.user?.id;
  if (!userId) return { status: 'disabled' };

  const [profileResult, cacheResult] = await Promise.all([
    supabase
      .from('user_profile')
      .select('user_id, personalization_enabled, profile_version')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_term_renderings')
      .select('*')
      .eq('user_id', userId)
      .eq('term_id', termId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw new DataLayerError(`Database error fetching user profile: ${profileResult.error.message}`, 'DATABASE_ERROR', profileResult.error);
  }
  if (cacheResult.error) {
    throw new DataLayerError(`Database error fetching cached rendering: ${cacheResult.error.message}`, 'DATABASE_ERROR', cacheResult.error);
  }

  const profile = profileResult.data;
  const cache = cacheResult.data;

  if (!profile || !(profile as Pick<UserProfileRow, 'personalization_enabled' | 'profile_version'>).personalization_enabled) {
    return { status: 'disabled' };
  }
  const typedProfile = profile as Pick<UserProfileRow, 'personalization_enabled' | 'profile_version'>;

  if (!cache) return { status: 'missing' };
  const typedCache = cache as UserTermRenderingRow;

  if (
    typeof typedCache.long_definition !== 'string' ||
    typeof typedCache.why_it_matters !== 'string' ||
    typeof typedCache.example_in_sentence !== 'string'
  ) {
    throw new DataLayerError('Malformed cached rendering in database', 'DATABASE_ERROR');
  }

  const isStale =
    typedCache.profile_version_at_render < typedProfile.profile_version ||
    typedCache.prompt_version < CURRENT_PROMPT_VERSION ||
    typedCache.model_used !== PERSONALIZE_MODEL ||
    typedCache.reported_at !== null;

  return isStale
    ? { status: 'stale', rendering: typedCache }
    : { status: 'fresh', rendering: typedCache };
}

// ────────────────────────────────────────────────────────────
// Stage B+1.18 — per-term translator-state badge
// ────────────────────────────────────────────────────────────

/**
 * Result shape for `fetchLatestPersonalizationStatus`. The badge above the
 * term name needs to know whether THIS term's most recent successful
 * personalization used an analogy or wrote in plain English. The data lives
 * in `personalize_log.pass2_result.uses_analogy` (or
 * `pass2_retry_result.uses_analogy` on the retry path).
 *
 * Returns `null` when no personalization status is available for this user
 * + term — which the caller treats as "render no badge." Specifically:
 *   - no successful row in personalize_log (canonical-only or all attempts
 *     fell back)
 *   - the most recent successful row is missing the verifier verdict
 *     (parser miss, transport failure mid-flow, legacy schema)
 *   - any query failure (RLS, transport, etc.)
 *
 * The badge is decorative-honest. A null return is a valid render state
 * (no badge), not an error to surface.
 */
export interface PersonalizationStatus {
  uses_analogy: boolean;
}

/**
 * Look up whether the user's most recent successful personalization for the
 * given term used an analogy or wrote plain English. Reads
 * `personalize_log` (RLS already gates by user_id per cloud-migration-023)
 * and walks the verifier verdicts.
 *
 * "Successful" = `final_status = 'cached'`. Fallback rows
 * (`fallback-no-profile`, `fallback-pass2-fail`, `fallback-timeout`, etc.)
 * are skipped — the user saw canonical content for those, so the badge
 * shouldn't claim anything about analogy-vs-plain.
 *
 * Reads the latest cached row (ordered by `created_at desc`), prefers
 * `pass2_retry_result.uses_analogy` when present (regen path written that
 * candidate), falls back to `pass2_result.uses_analogy` (happy path).
 * Returns null if neither verdict carries the boolean.
 *
 * Failure path: returns null on any error. Never throws — the badge is
 * non-load-bearing.
 */
export async function fetchLatestPersonalizationStatus(
  userId: string,
  termId: string,
): Promise<PersonalizationStatus | null> {
  try {
    if (typeof userId !== 'string' || !userId.trim() || typeof termId !== 'string' || !termId.trim()) {
      return null;
    }
    const { data, error } = await supabase
      .from('personalize_log')
      .select('pass2_result, pass2_retry_result')
      .eq('user_id', userId)
      .eq('term_id', termId)
      .eq('final_status', 'cached')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new DataLayerError(`Database error in fetchLatestPersonalizationStatus: ${error.message}`, 'DATABASE_ERROR', error);
    }
    if (!data) return null;
    const row = data as {
      pass2_result: { uses_analogy?: unknown } | null;
      pass2_retry_result: { uses_analogy?: unknown } | null;
    };
    const retryAnalogy = row.pass2_retry_result?.uses_analogy;
    if (typeof retryAnalogy === 'boolean') {
      return { uses_analogy: retryAnalogy };
    }
    const firstAnalogy = row.pass2_result?.uses_analogy;
    if (typeof firstAnalogy === 'boolean') {
      return { uses_analogy: firstAnalogy };
    }
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[fetchLatestPersonalizationStatus] failed:', err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Stage B+1.4-B — gift-profile mode
// ────────────────────────────────────────────────────────────

/**
 * The 7 wizard fields that get pre-filled by the sender and confirmed by the
 * recipient. Mirrors the WizardAnswers type in the onboarding-profile route.
 * Kept here so /gift/send and /gift/accept share a single source of truth.
 */
export interface PrefilledProfile {
  goals_extended: string[];
  goals_freeform?: string | null;
  job: string | null;
  encounter_contexts: string[];
  interests: string[];
  heritage: string | null;
  roles: string[];
  background_text: string | null;
  active_domain?: string | null;
  /**
   * Stage B+1.10 — preferred display name for greetings + toasts. Sender
   * captures it via gift-send wizard ("what should we call them?"); recipient
   * confirms it via gift-accept wizard. Capitalization preserved verbatim.
   */
  display_name?: string | null;
  /**
   * Stage B+1.11 — sender's self-described relationship to the recipient
   * ("father-in-law", "mentor", "adult child", or any "other" freeform up to
   * 60 chars). Read-only on the recipient side — inherited from the gift at
   * accept time. Editable post-accept from Settings → edit profile.
   */
  relationship?: string | null;
  /**
   * Stage B+1.12 — 0-3 Phosphor icon slugs from the LIVED_ICONS_ALLOWLIST
   * (see supabase/functions/_shared/lived-icons.ts). Picked by Opus during
   * AI compose; can be edited / regenerated on the review screen. Persists
   * to user_profile.lived_icons (cloud-migration-033) and renders as the
   * fallback strip when lived_icon_url is null.
   */
  lived_icons?: string[];
  /**
   * Stage B+1.14 — public Supabase Storage URL of the AI-generated badge
   * PNG. Pre-fired by the sender during /gift/send finish() (background
   * task — does not block sending the invite); recipient inherits it via
   * `accept_gift_invite_atomic` sparse-merge. Null = generation hadn't
   * completed (or failed) at send time; recipient's first home-screen
   * mount will trigger another generation against their accepted profile.
   */
  lived_icon_url?: string | null;
}

/** Empty default — used for the recipient's "nope, change it" reset. */
export const EMPTY_PREFILLED_PROFILE: PrefilledProfile = {
  goals_extended: [],
  goals_freeform: null,
  job: null,
  encounter_contexts: [],
  interests: [],
  heritage: null,
  roles: [],
  background_text: null,
  active_domain: null,
  display_name: null,
  relationship: null,
  lived_icons: [],
  lived_icon_url: null,
};

export interface GiftPreviewResponse {
  invite_id: string;
  /** Optional guided curriculum attached by the sender. */
  guided_program_id: GuidedProgramId | null;
  /**
   * Email-derived legal/full name the sender entered (stays as-is — used
   * as a fallback when display_name is null).
   */
  recipient_name: string;
  /**
   * Stage B+1.10 — what the sender said to call the recipient. Preferred over
   * recipient_name in the splash greeting + welcome toast. Null when the
   * sender skipped the step (legacy invites pre-deploy will also be null).
   */
  display_name: string | null;
  custom_message: string | null;
  prefilled_profile: PrefilledProfile;
  sender_display: string;
  accepted: boolean;
  declined: boolean;
  expired: boolean;
  expires_at: string;
}

export interface AllowlistCheckResponse {
  allowed: boolean;
  allowed_via: 'seed' | 'gift_invite_accepted' | null;
}

function edgeUrl(name: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/functions/v1/${name}`;
}

async function authedJwt(): Promise<string> {
  try {
    const { data: sessionData, error } = await supabase.auth.getSession();
    if (error) throw error;
    const jwt = sessionData?.session?.access_token;
    if (!jwt) throw new DataLayerError('no session', 'UNAUTHORIZED');
    return jwt;
  } catch (err) {
    if (err instanceof DataLayerError) throw err;
    throw new DataLayerError(
      err instanceof Error ? err.message : 'no session',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Check whether the currently signed-in user is on the allowlist. Returns the
 * `added_via` discriminator so the splash can differentiate "seed" (Kevin) from
 * "gift_invite_accepted" (someone who landed via a magic link). Throws on
 * transport failure — the caller treats that as "not allowed" for safety.
 */
export async function checkAllowlist(): Promise<AllowlistCheckResponse> {
  const jwt = await authedJwt();
  let res: Response;
  try {
    res = await fetch(edgeUrl('check-allowlist'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: '{}',
    });
  } catch (err) {
    throw new DataLayerError(
      err instanceof Error ? err.message : 'Failed to fetch check-allowlist',
      'NETWORK_ERROR',
      err
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DataLayerError(`check-allowlist ${res.status}: ${text}`, 'DATABASE_ERROR');
  }
  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    throw new DataLayerError('Malformed JSON response from check-allowlist', 'DATABASE_ERROR', err);
  }

  if (!json || typeof json.allowed !== 'boolean') {
    throw new DataLayerError('Invalid response shape from check-allowlist', 'DATABASE_ERROR');
  }
  // `allowed` (boolean, validated above) is the sole authority on access.
  // `allowed_via` is only a cosmetic discriminator for splash copy, so DON'T
  // lock out a legitimately-allowed user just because the server added a new
  // `allowed_via` reason we don't recognize yet — coerce anything unexpected to
  // null (the splash falls back to its generic allowed copy).
  const rawVia = json.allowed_via;
  const allowedVia: AllowlistCheckResponse['allowed_via'] =
    rawVia === 'seed' || rawVia === 'gift_invite_accepted' ? rawVia : null;

  return {
    allowed: json.allowed,
    allowed_via: allowedVia,
  };
}

/**
 * Send a gift invite. Sender must be allowlisted (Edge Function enforces).
 * Throws on validation failure or rate-limit hit so the caller can surface a
 * toast with the server's error message.
 *
 * B+1.11: `relationship` and `private_reasoning` are stored as their own
 * columns on `gift_invites` (NOT inside `prefilled_profile`):
 *   - `relationship` is copied to `user_profile.relationship` at accept time
 *     by `accept_gift_invite_atomic` (sender's framing of the recipient).
 *   - `private_reasoning` lives ONLY on the gift_invites row. It NEVER flows
 *     to user_profile (which is RLS-gated to the user — copying it would let
 *     the recipient read it). The personalize-term Edge Function can read it
 *     via service-role JOIN to enrich the prompt without exposing it client-
 *     side.
 */
export async function sendGiftInvite(input: {
  recipient_email: string;
  recipient_name: string;
  custom_message: string | null;
  prefilled_profile: PrefilledProfile;
  guided_program_id?: GuidedProgramId | null;
  relationship?: string | null;
  private_reasoning?: string | null;
}): Promise<{ invite_id: string; sent: true }> {
  if (!input) {
    throw new DataLayerError('input is required', 'VALIDATION_ERROR');
  }
  validateEmail(input.recipient_email, 'recipient_email');
  validateNonEmptyString(input.recipient_name, 'recipient_name');
  validatePrefilledProfile(input.prefilled_profile);
  if (
    input.guided_program_id !== undefined &&
    input.guided_program_id !== null &&
    asGuidedProgramId(input.guided_program_id) === null
  ) {
    throw new DataLayerError('guided_program_id is not registered', 'VALIDATION_ERROR');
  }
  if (input.relationship !== undefined && input.relationship !== null) {
    validateNonEmptyString(input.relationship, 'relationship');
  }
  if (input.private_reasoning !== undefined && input.private_reasoning !== null) {
    validateNonEmptyString(input.private_reasoning, 'private_reasoning');
  }

  const jwt = await authedJwt();
  let res: Response;
  try {
    res = await fetch(edgeUrl('send-gift-invite'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw new DataLayerError(
      err instanceof Error ? err.message : 'Network failure during send-gift-invite',
      'NETWORK_ERROR',
      err
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DataLayerError(`send-gift-invite ${res.status}: ${text}`, 'DATABASE_ERROR');
  }
  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    throw new DataLayerError('Malformed JSON response from send-gift-invite', 'DATABASE_ERROR', err);
  }
  if (!data || typeof data.invite_id !== 'string' || data.sent !== true) {
    throw new DataLayerError('Invalid response shape from send-gift-invite', 'DATABASE_ERROR');
  }
  return data as { invite_id: string; sent: true };
}

/**
 * Fetch a recipient-safe preview of a gift invite. Recipient JWT email must
 * match invite.recipient_email — Edge Function enforces. Throws on 404
 * (invite missing), 403 (wrong recipient), or transport failure.
 */
export async function previewGiftInvite(inviteId: string): Promise<GiftPreviewResponse> {
  validateNonEmptyString(inviteId, 'inviteId');
  const jwt = await authedJwt();
  let res: Response;
  try {
    res = await fetch(edgeUrl('preview-gift-invite'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId }),
    });
  } catch (err) {
    throw new DataLayerError(
      err instanceof Error ? err.message : 'Network failure during preview-gift-invite',
      'NETWORK_ERROR',
      err
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DataLayerError(`preview-gift-invite ${res.status}: ${text}`, 'DATABASE_ERROR');
  }
  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    throw new DataLayerError('Malformed JSON response from preview-gift-invite', 'DATABASE_ERROR', err);
  }
  // Hard-require only the load-bearing fields the accept flow depends on.
  // `display_name` and `custom_message` are cosmetic — a bad value shouldn't
  // nuke the whole gift-accept surface (see below: they degrade to null).
  if (
    !data ||
    typeof data.invite_id !== 'string' ||
    typeof data.recipient_name !== 'string' ||
    typeof data.prefilled_profile !== 'object' ||
    typeof data.sender_display !== 'string' ||
    typeof data.accepted !== 'boolean' ||
    typeof data.declined !== 'boolean' ||
    typeof data.expired !== 'boolean' ||
    typeof data.expires_at !== 'string'
  ) {
    throw new DataLayerError('Invalid response shape from preview-gift-invite', 'DATABASE_ERROR');
  }
  try {
    validatePrefilledProfile(data.prefilled_profile);
  } catch (err) {
    throw new DataLayerError('Malformed prefilled_profile in preview-gift-invite response', 'DATABASE_ERROR', err);
  }
  // Cosmetic fields degrade gracefully — coerce anything non-string to null
  // rather than throwing.
  const normalized = {
    ...data,
    display_name: typeof data.display_name === 'string' ? data.display_name : null,
    custom_message: typeof data.custom_message === 'string' ? data.custom_message : null,
    guided_program_id: asGuidedProgramId(data.guided_program_id),
  };
  return normalized as GiftPreviewResponse;
}

/**
 * Accept (or decline) a gift invite. Atomic on the server: allowlists the
 * recipient, optionally upserts user_profile with the final_profile + sets
 * gifted_by_user_id, marks invite accepted_at/declined_at.
 *
 * Pass `declined: true` for the "maybe later" path — we still allowlist so
 * the recipient can use the app, but DO NOT write a profile row. They land
 * in canonical-only mode and can fill their profile later via Settings.
 */
export async function acceptGiftInvite(input: {
  invite_id: string;
  final_profile?: PrefilledProfile | null;
  declined?: boolean;
}): Promise<{ accepted: boolean; declined: boolean; alreadyResolved?: boolean }> {
  if (!input) {
    throw new DataLayerError('input is required', 'VALIDATION_ERROR');
  }
  validateNonEmptyString(input.invite_id, 'invite_id');
  if (input.final_profile !== undefined && input.final_profile !== null) {
    validatePrefilledProfile(input.final_profile);
  }
  if (input.declined !== undefined) {
    validateBoolean(input.declined, 'declined');
  }
  const jwt = await authedJwt();
  let res: Response;
  try {
    res = await fetch(edgeUrl('accept-gift-invite'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw new DataLayerError(
      err instanceof Error ? err.message : 'Network failure during accept-gift-invite',
      'NETWORK_ERROR',
      err
    );
  }
  if (res.status === 409) {
    const declined = input.declined === true;
    return { accepted: !declined, declined, alreadyResolved: true };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DataLayerError(`accept-gift-invite ${res.status}: ${text}`, 'DATABASE_ERROR');
  }
  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    throw new DataLayerError('Malformed JSON response from accept-gift-invite', 'DATABASE_ERROR', err);
  }
  if (!data || typeof data.accepted !== 'boolean' || typeof data.declined !== 'boolean') {
    throw new DataLayerError('Invalid response shape from accept-gift-invite', 'DATABASE_ERROR');
  }
  return data as { accepted: boolean; declined: boolean };
}

// ────────────────────────────────────────────────────────────
// Stage B+1.4-C — onboarding job-step follow-up question
// ────────────────────────────────────────────────────────────

/**
 * Result shape for `generateJobFollowup`. Empty `question` means "Opus
 * decided no follow-up is needed" (input already specific OR gibberish);
 * the caller treats that the same as `isFallback: true` — advance the
 * wizard without surfacing chips. `chips` already includes the server-
 * appended "other" sentinel when non-empty.
 */
export interface JobFollowup {
  question: string;
  chips: string[];
  isFallback?: boolean;
}

/**
 * POST to the generate-job-followup Edge Function. Returns Opus's tailored
 * question + chip options for the job step. Failure path: returns the
 * `{ question: '', chips: [], isFallback: true }` shape so the caller can
 * silently fall through to the next wizard step. Never throws — the wizard
 * shouldn't surface infrastructure failures mid-flow.
 */
export async function generateJobFollowup(job: string): Promise<JobFollowup> {
  try {
    if (typeof job !== 'string') {
      return { question: '', chips: [], isFallback: true };
    }
    const jwt = await authedJwt();
    const res = await fetch(edgeUrl('generate-job-followup'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ job }),
    });
    if (!res.ok) {
      return { question: '', chips: [], isFallback: true };
    }
    const data = (await res.json()) as JobFollowup;
    if (
      typeof data?.question !== 'string' ||
      !Array.isArray(data?.chips) ||
      !data.chips.every(c => typeof c === 'string')
    ) {
      return { question: '', chips: [], isFallback: true };
    }
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[generateJobFollowup] failed:', err);
    return { question: '', chips: [], isFallback: true };
  }
}

// ────────────────────────────────────────────────────────────
// Stage B+1.12 — AI gift-profile composer
// ────────────────────────────────────────────────────────────

/** Confidence verdict from the compose-gift-profile Edge Function's verifier. */
export type ComposeConfidence = 'high' | 'medium' | 'low';

/**
 * Result shape from `composeGiftProfile`. Mirrors ComposeResponse in
 * supabase/functions/compose-gift-profile/index.ts.
 *
 * Never thrown — every failure path returns `isFallback: true` with empty
 * fields so the client can silently drop into the manual 13-step wizard
 * with the recipient's name + email pre-filled.
 *
 * `lived_icons` is a subset of LIVED_ICONS_ALLOWLIST validated server-side;
 * the client can assume every slug renders against `https://api.iconify.design/ph/<slug>.svg`
 * without further filtering.
 */
export interface ComposeGiftProfileResponse {
  proposed_profile: PrefilledProfile;
  custom_message_draft: string;
  private_reasoning_draft: string;
  lived_icons: string[];
  confidence: ComposeConfidence;
  isFallback?: boolean;
}

const EMPTY_COMPOSE_RESPONSE: ComposeGiftProfileResponse = {
  proposed_profile: EMPTY_PREFILLED_PROFILE,
  custom_message_draft: '',
  private_reasoning_draft: '',
  lived_icons: [],
  confidence: 'low',
  isFallback: true,
};

/**
 * POST to the compose-gift-profile Edge Function. Returns Opus's drafted
 * full profile + custom_message + private_reasoning + lived_icons + a
 * confidence verdict from the verifier pass.
 *
 * Failure path: returns `{ ...empty, isFallback: true }` so the caller can
 * fall through to the manual 13-step wizard. Never throws — gift composition
 * is a high-stakes UX moment and infrastructure noise has no place there.
 */
export async function composeGiftProfile(input: {
  recipient_name: string;
  recipient_email: string;
  freeform_describe: string;
  sender_name: string;
  relationship?: string | null;
  voice_was_used?: boolean;
}): Promise<ComposeGiftProfileResponse> {
  try {
    if (
      !input ||
      typeof input.recipient_name !== 'string' ||
      typeof input.recipient_email !== 'string' ||
      typeof input.freeform_describe !== 'string' ||
      typeof input.sender_name !== 'string'
    ) {
      return { ...EMPTY_COMPOSE_RESPONSE };
    }
    const jwt = await authedJwt();
    const res = await fetch(edgeUrl('compose-gift-profile'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      return { ...EMPTY_COMPOSE_RESPONSE };
    }
    const data = (await res.json()) as ComposeGiftProfileResponse;
    if (
      !data ||
      typeof data !== 'object' ||
      typeof data.proposed_profile !== 'object' ||
      data.proposed_profile === null ||
      typeof data.custom_message_draft !== 'string' ||
      typeof data.private_reasoning_draft !== 'string' ||
      !Array.isArray(data.lived_icons) ||
      !data.lived_icons.every(li => typeof li === 'string') ||
      (data.confidence !== 'high' && data.confidence !== 'medium' && data.confidence !== 'low')
    ) {
      return { ...EMPTY_COMPOSE_RESPONSE };
    }
    validatePrefilledProfile(data.proposed_profile);
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[composeGiftProfile] failed:', err);
    return { ...EMPTY_COMPOSE_RESPONSE };
  }
}

// ────────────────────────────────────────────────────────────
// Stage B+1.11 — pick-lived-icons (Opus picks 1-3 Phosphor slugs from
// the LIVED_ICONS_ALLOWLIST that visually represent the user's world)
// ────────────────────────────────────────────────────────────

/**
 * POST to the pick-lived-icons Edge Function. Returns a 0-3 array of
 * Phosphor slugs (already validated against the allowlist server-side).
 *
 * Failure path: returns empty array on ANY error (transport, auth, parse,
 * timeout). Never throws — the lived-icons strip is decorative; an empty
 * strip is a valid render state. Mirrors the silent-fallback discipline
 * of `generateJobFollowup`.
 *
 * The profile is passed inline so the function works for BOTH:
 *   1. Self-onboarding finish — caller's local upsert is fresher than DB
 *   2. Gift-send finish — recipient's user_profile row doesn't exist yet
 */
export async function pickLivedIcons(profile: {
  job?: string | null;
  goals_freeform?: string | null;
  encounter_contexts?: string[];
  interests?: string[];
  heritage?: string | null;
  roles?: string[];
  background_text?: string | null;
  display_name?: string | null;
  relationship?: string | null;
  active_domain?: string | null;
}): Promise<string[]> {
  try {
    if (profile == null || typeof profile !== 'object') {
      return [];
    }
    const jwt = await authedJwt();
    const res = await fetch(edgeUrl('pick-lived-icons'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { slugs?: unknown };
    if (!Array.isArray(data?.slugs)) return [];
    return data.slugs.filter((s): s is string => typeof s === 'string');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[pickLivedIcons] failed:', err);
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// Stage B+1.14 — generate-lived-icon-image (AI badge generation)
// ────────────────────────────────────────────────────────────

/**
 * Result shape from `generateLivedIconImage` and the from-prompt variant.
 *
 * - `url`: public Supabase Storage URL of the generated PNG, or null on
 *   any failure path. Includes a `?t=<timestamp>` cache-buster so a fresh
 *   regeneration paints over the prior badge in the renderer immediately.
 * - `motifs`: 2-3 short motif strings Opus picked (e.g. ["soccer ball",
 *   "palm tree", "book"]). Even on Gemini failure / storage failure, the
 *   motifs may be populated from a successful Pass 1 — the client can
 *   surface them as text under the fallback strip while waiting for a
 *   retry.
 * - `isFallback`: true when generation didn't complete and url is null.
 *   Caller should fall back to the legacy LivedIconStrip render path.
 */
export interface LivedIconImageResult {
  url: string | null;
  motifs: string[];
  isFallback?: boolean;
}

const LIVED_ICON_FALLBACK: LivedIconImageResult = {
  url: null,
  motifs: [],
  isFallback: true,
};

/**
 * The minimum profile shape the lived-icon Edge Functions need. Mirrors
 * the field set the sanitizer reads in supabase/functions/_shared/profile-shape.ts.
 * Kept loose (all-optional) so onboarding + gift-send can pass their local
 * patch shapes without a re-build of the type contract.
 */
export interface LivedIconProfileInput {
  job?: string | null;
  goals_freeform?: string | null;
  encounter_contexts?: string[];
  interests?: string[];
  heritage?: string | null;
  roles?: string[];
  background_text?: string | null;
  display_name?: string | null;
  relationship?: string | null;
  active_domain?: string | null;
}

/**
 * POST to the generate-lived-icon-image Edge Function. Triggers the full
 * Pass 1 (Opus motif pick) → Pass 2 (Gemini image gen) → Pass 3 (storage
 * upload) pipeline and returns the resulting public URL plus the picked
 * motifs.
 *
 * Failure path: returns `{ url: null, motifs: [], isFallback: true }` on
 * ANY error (transport, auth, parse, timeout, rate-limit). NEVER throws —
 * the lived-icon badge is decorative; an empty/legacy-strip render state
 * is valid. Mirrors the silent-fallback discipline of `pickLivedIcons`
 * and `generateJobFollowup`.
 *
 * Generation takes 5-15s typically (Opus + Gemini). Callers should fire
 * fire-and-forget after profile save — do NOT block navigation on the
 * Promise resolution.
 */
export async function generateLivedIconImage(
  profile: LivedIconProfileInput,
  options?: {
    /**
     * When set, the badge generates for a not-yet-signed-up gift
     * recipient. Storage path goes to `gift/<hash(email)>.png` and the
     * URL does NOT auto-persist to the caller's profile. Used by
     * gift-send finish() so the recipient sees a generated badge on
     * their first /gift/accept open.
     */
    forRecipientEmail?: string;
  },
): Promise<LivedIconImageResult> {
  try {
    const jwt = await authedJwt();
    const body: Record<string, unknown> = { profile };
    if (options?.forRecipientEmail && options.forRecipientEmail.trim().length > 0) {
      body.for_recipient_email = options.forRecipientEmail.trim().toLowerCase();
    }
    const res = await fetch(edgeUrl('generate-lived-icon-image'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ...LIVED_ICON_FALLBACK };
    const data = (await res.json()) as Partial<LivedIconImageResult>;
    if (data == null || typeof data !== 'object') return { ...LIVED_ICON_FALLBACK };
    const url = typeof data.url === 'string' && data.url.length > 0 ? data.url : null;
    const motifs = Array.isArray(data.motifs)
      ? data.motifs.filter((m): m is string => typeof m === 'string')
      : [];
    return {
      url,
      motifs,
      // Server may set isFallback explicitly when motifs were picked but
      // the Gemini / storage step failed. Compute defensively too — any
      // null URL is a fallback regardless of what the server said.
      isFallback: url === null ? true : Boolean(data.isFallback),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[generateLivedIconImage] failed:', err);
    return { ...LIVED_ICON_FALLBACK };
  }
}

/**
 * Companion to `generateLivedIconImage` that threads a freeform user
 * request into Pass 1's motif picker (e.g. "make it more about birds").
 * Same failure semantics: never throws, returns fallback on any error.
 *
 * Used by Settings → "your jargon badge" → "describe what you'd rather"
 * textarea + voice button. The user's request biases motif selection
 * without overriding the profile's other signals.
 */
export async function generateLivedIconImageFromPrompt(
  profile: LivedIconProfileInput,
  userRequest: string,
): Promise<LivedIconImageResult> {
  // Trim + empty-collapse client-side so we don't waste a roundtrip on
  // an empty string. The server also rejects empty requests with 400.
  const cleaned = (userRequest ?? '').trim();
  if (cleaned.length === 0) {
    return { ...LIVED_ICON_FALLBACK };
  }
  try {
    const jwt = await authedJwt();
    const res = await fetch(edgeUrl('generate-lived-icon-image-from-prompt'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ profile, user_request: cleaned }),
    });
    if (!res.ok) return { ...LIVED_ICON_FALLBACK };
    const data = (await res.json()) as Partial<LivedIconImageResult>;
    if (data == null || typeof data !== 'object') return { ...LIVED_ICON_FALLBACK };
    const url = typeof data.url === 'string' && data.url.length > 0 ? data.url : null;
    const motifs = Array.isArray(data.motifs)
      ? data.motifs.filter((m): m is string => typeof m === 'string')
      : [];
    return {
      url,
      motifs,
      isFallback: url === null ? true : Boolean(data.isFallback),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[generateLivedIconImageFromPrompt] failed:', err);
    return { ...LIVED_ICON_FALLBACK };
  }
}

// ────────────────────────────────────────────────────────────
// Stage B+1.6 — report-analogy-issue (credibility upgrade)
// ────────────────────────────────────────────────────────────

/**
 * Inputs for `reportAnalogyIssue`. The full rendering snapshot is sent so the
 * Edge Function can write it to `analogy_reports` — Kevin needs to see WHAT
 * THE USER SAW, not just "this term's rendering had a problem at time T."
 */
export interface ReportAnalogyIssueInput {
  term_id: string;
  rendering: {
    long_definition: string;
    why_it_matters: string;
    example_in_sentence: string;
  };
  complaint: string;
}

/**
 * POST to the report-analogy-issue Edge Function. Logs a row into
 * `analogy_reports` (Kevin's audit trail) AND marks the user's cached
 * rendering as reported (`user_term_renderings.reported_at = now()`)
 * so the next personalize call regenerates it under the stricter B+1.6
 * rubric.
 *
 * Returns true on a 200 success, false on any non-2xx OR transport error.
 * Never throws — the report-this UX is incidental to learning, not
 * load-bearing; surface a polite error toast and let the user move on.
 */
export async function reportAnalogyIssue(
  input: ReportAnalogyIssueInput,
): Promise<boolean> {
  try {
    if (
      !input ||
      typeof input.term_id !== 'string' ||
      !input.term_id.trim() ||
      typeof input.rendering !== 'object' ||
      input.rendering === null ||
      typeof input.rendering.long_definition !== 'string' ||
      typeof input.rendering.why_it_matters !== 'string' ||
      typeof input.rendering.example_in_sentence !== 'string' ||
      typeof input.complaint !== 'string'
    ) {
      return false;
    }
    const jwt = await authedJwt();
    const res = await fetch(edgeUrl('report-analogy-issue'), {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        term_id: input.term_id,
        rendering_long_definition: input.rendering.long_definition,
        rendering_why_it_matters: input.rendering.why_it_matters,
        rendering_example: input.rendering.example_in_sentence,
        user_complaint: input.complaint,
      }),
    });
    return res.ok;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[reportAnalogyIssue] failed:', err);
    return false;
  }
}

/**
 * POST to the personalize-term Edge Function. Returns the personalized rendering
 * (or canonical fallback if the function decides to fall back). Throws on
 * transport / auth failure so the caller can swallow it silently.
 */
export async function requestPersonalization(termId: string): Promise<PersonalizationResponse> {
  validateNonEmptyString(termId, 'termId');
  const jwt = await authedJwt();
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const url = `${base}/functions/v1/personalize-term`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ termId }),
    });
  } catch (err) {
    throw new DataLayerError(
      err instanceof Error ? err.message : 'Network failure during requestPersonalization',
      'NETWORK_ERROR',
      err
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DataLayerError(`personalize-term ${res.status}: ${text}`, 'DATABASE_ERROR');
  }
  let data: any;
  try {
    data = await res.json();
  } catch (err) {
    throw new DataLayerError('Malformed JSON response from requestPersonalization', 'DATABASE_ERROR', err);
  }
  if (
    !data ||
    typeof data.long_definition !== 'string' ||
    typeof data.why_it_matters !== 'string' ||
    typeof data.example_in_sentence !== 'string' ||
    typeof data.fromCache !== 'boolean' ||
    typeof data.isFallback !== 'boolean'
  ) {
    throw new DataLayerError('Invalid response shape from requestPersonalization', 'DATABASE_ERROR');
  }
  return data as PersonalizationResponse;
}

/**
 * Read the user's profile row. Returns null if no row exists (canonical-only
 * mode — the user skipped onboarding step 3 OR never opened the form).
 */
export async function fetchUserProfile(userId: string): Promise<UserProfileRow | null> {
  validateNonEmptyString(userId, 'userId');
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new DataLayerError(`Database error in fetchUserProfile: ${error.message}`, 'DATABASE_ERROR', error);
  }
  if (data && (typeof data !== 'object' || data.user_id !== userId)) {
    throw new DataLayerError('Malformed user profile returned from database', 'DATABASE_ERROR');
  }
  return (data as UserProfileRow | null) ?? null;
}

/**
 * INSERT-or-UPDATE the user's profile. The DB trigger
 * `bump_profile_version_if_changed` handles version bumping on UPDATE — we
 * never touch profile_version client-side. The caller passes only the fields
 * they want to change (interests/job/education_level/background_text/personalization_enabled).
 */
export async function upsertUserProfile(
  userId: string,
  patch: Partial<Omit<UserProfileRow, 'user_id' | 'profile_version' | 'created_at' | 'updated_at'>>,
): Promise<UserProfileRow> {
  validateNonEmptyString(userId, 'userId');
  validateObject(patch, 'patch');
  const { data, error } = await supabase.rpc('upsert_user_profile_atomic', {
    p_user_id: userId,
    p_patch: patch,
  });
  if (error) {
    throw new DataLayerError(`Database error in upsertUserProfile: ${error.message}`, 'DATABASE_ERROR', error);
  }
  if (!data) {
    throw new DataLayerError('upsert_user_profile_atomic returned no row', 'DATABASE_ERROR');
  }
  if (typeof data !== 'object' || data.user_id !== userId) {
    throw new DataLayerError('Malformed user profile returned from upsertUserProfile', 'DATABASE_ERROR');
  }
  return data as UserProfileRow;
}

async function fetchAllTermsFromDb(): Promise<TermRow[]> {
  const { data, error } = await supabase.from('terms').select('*').order('id');
  if (error) {
    throw new DataLayerError(`Database error in fetchAllTerms: ${error.message}`, 'DATABASE_ERROR', error);
  }
  const rows = data ?? [];
  if (!Array.isArray(rows) || rows.some(row => row == null || typeof row !== 'object' || typeof row.id !== 'string')) {
    throw new DataLayerError('Malformed terms returned from fetchAllTerms', 'DATABASE_ERROR');
  }
  return rows as TermRow[];
}

export async function fetchAllTerms(): Promise<TermRow[]> {
  return getOrFetchTerms(fetchAllTermsFromDb);
}

export async function fetchPathTerms(pathId: PathId): Promise<TermRow[]> {
  validateNonEmptyString(pathId, 'pathId');
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .eq('path', pathId)
    .order('difficulty')
    .order('id');
  if (error) {
    throw new DataLayerError(`Database error in fetchPathTerms: ${error.message}`, 'DATABASE_ERROR', error);
  }
  const rows = data ?? [];
  if (!Array.isArray(rows) || rows.some(row => row == null || typeof row !== 'object' || typeof row.id !== 'string')) {
    throw new DataLayerError('Malformed terms returned from fetchPathTerms', 'DATABASE_ERROR');
  }
  return rows as TermRow[];
}

export async function fetchUserProgress(userId: string): Promise<Record<string, UserProgressRow>> {
  validateNonEmptyString(userId, 'userId');
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    throw new DataLayerError(`Database error in fetchUserProgress: ${error.message}`, 'DATABASE_ERROR', error);
  }
  const rows = data ?? [];
  if (!Array.isArray(rows)) {
    throw new DataLayerError('Malformed user progress returned from fetchUserProgress', 'DATABASE_ERROR');
  }
  const map: Record<string, UserProgressRow> = {};
  for (const row of rows) {
    if (row == null || typeof row !== 'object' || typeof row.term_id !== 'string') {
      throw new DataLayerError('Malformed progress row in fetchUserProgress', 'DATABASE_ERROR');
    }
    map[row.term_id] = row;
  }
  return map;
}

export async function fetchStreakLog(userId: string): Promise<StreakLogRow[]> {
  validateNonEmptyString(userId, 'userId');
  const { data, error } = await supabase
    .from('streak_log')
    .select('*')
    .eq('user_id', userId)
    .order('local_date', { ascending: false });
  if (error) {
    throw new DataLayerError(`Database error in fetchStreakLog: ${error.message}`, 'DATABASE_ERROR', error);
  }
  const rows = data ?? [];
  if (!Array.isArray(rows) || rows.some(row => row == null || typeof row !== 'object' || (row.id !== undefined && typeof row.id !== 'string'))) {
    throw new DataLayerError('Malformed streak logs returned from fetchStreakLog', 'DATABASE_ERROR');
  }
  return rows as StreakLogRow[];
}

// ────────────────────────────────────────────────────────────
// Stage B+1.5.5 — diagnostic panel: personalize_log stats
// ────────────────────────────────────────────────────────────

/**
 * One row from `personalize_log` reduced to what the diagnostic panel
 * actually renders. Full audit columns (pass1_candidate, pass2_result,
 * tokens, etc.) stay in the DB — exposing them in the UI would be
 * technical noise for Kevin.
 */
export interface PersonalizeLogSummary {
  id: string;
  term_id: string;
  final_status: string;
  total_cost_usd: number | null;
  total_latency_ms: number | null;
  created_at: string;
}

export interface PersonalizeStats {
  /** Last N rows in reverse-chrono order (default N = 5). */
  recent: PersonalizeLogSummary[];
  /** Status -> count for the trailing 7 days. */
  histogram7d: Record<string, number>;
  /** Sum of total_cost_usd over the trailing 7 days. */
  totalCost7dUsd: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Pulls last N rows + computes the trailing-7d status histogram + cost
 * for the diagnostic panel. RLS (cloud-migration-023) restricts visible
 * rows to `auth.uid() = user_id`, so passing the wrong userId at the
 * call site fails closed (returns empty). Errors throw — the panel
 * surfaces them as a failure tile.
 */
export async function fetchRecentPersonalizeStats(
  userId: string,
  recentLimit = 5,
): Promise<PersonalizeStats> {
  validateNonEmptyString(userId, 'userId');
  validateNumber(recentLimit, 'recentLimit');
  if (recentLimit <= 0) {
    throw new DataLayerError('recentLimit must be positive', 'VALIDATION_ERROR');
  }
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  const [recentRes, windowRes] = await Promise.all([
    supabase
      .from('personalize_log')
      .select('id, term_id, final_status, total_cost_usd, total_latency_ms, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(recentLimit),
    supabase
      .from('personalize_log')
      .select('final_status, total_cost_usd')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo),
  ]);

  if (recentRes.error) {
    throw new DataLayerError(`Database error in fetchRecentPersonalizeStats (recent): ${recentRes.error.message}`, 'DATABASE_ERROR', recentRes.error);
  }
  if (windowRes.error) {
    throw new DataLayerError(`Database error in fetchRecentPersonalizeStats (window): ${windowRes.error.message}`, 'DATABASE_ERROR', windowRes.error);
  }

  const recentData = recentRes.data ?? [];
  const windowData = windowRes.data ?? [];

  if (!Array.isArray(recentData) || recentData.some(row => row == null || typeof row !== 'object' || (row.id !== undefined && typeof row.id !== 'string'))) {
    throw new DataLayerError('Malformed personalize log summaries in fetchRecentPersonalizeStats', 'DATABASE_ERROR');
  }

  const histogram7d: Record<string, number> = {};
  let totalCost7dUsd = 0;
  for (const row of windowData) {
    if (row == null || typeof row !== 'object') {
      throw new DataLayerError('Malformed log row in fetchRecentPersonalizeStats window', 'DATABASE_ERROR');
    }
    const status = row.final_status;
    if (status !== undefined && status !== null) {
      if (typeof status !== 'string') {
        throw new DataLayerError('Malformed status field in fetchRecentPersonalizeStats window', 'DATABASE_ERROR');
      }
      histogram7d[status] = (histogram7d[status] ?? 0) + 1;
    }
    const cost = row.total_cost_usd;
    if (cost !== null && cost !== undefined) {
      if (typeof cost !== 'number') {
        throw new DataLayerError('Malformed cost field in fetchRecentPersonalizeStats window', 'DATABASE_ERROR');
      }
      totalCost7dUsd += cost;
    }
  }

  return {
    recent: recentData as PersonalizeLogSummary[],
    histogram7d,
    totalCost7dUsd: Number(totalCost7dUsd.toFixed(4)),
  };
}

// ────────────────────────────────────────────────────────────
// Stage B+1.5.6 — diagnostic panel: ingestion health + 30d spend
// ────────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface IngestionLogSummary {
  id: string;
  cycle_id: string;
  final_status: string;
  failure_pass: string | null;
  total_cost_usd: number | null;
  total_latency_ms: number | null;
  created_at: string;
}

export interface IngestionStats {
  /** Last N rows in reverse-chrono order (default N = 10). */
  recent: IngestionLogSummary[];
  /** Status -> count for the trailing 7 days. */
  histogram7d: Record<string, number>;
  /** Sum of total_cost_usd over the trailing 7 days. */
  totalCost7dUsd: number;
}

/**
 * Pulls last N ingestion-log rows + computes the trailing-7d status
 * histogram + cost. RLS (cloud-migration-024) restricts visibility to
 * seed-allowlist users (Kevin today). Gift recipients get an empty
 * result + no error — the policy filters silently per Postgres semantics.
 */
export async function fetchRecentIngestionStats(
  recentLimit = 10,
): Promise<IngestionStats> {
  validateNumber(recentLimit, 'recentLimit');
  if (recentLimit <= 0) {
    throw new DataLayerError('recentLimit must be positive', 'VALIDATION_ERROR');
  }
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const [recentRes, windowRes] = await Promise.all([
    supabase
      .from('ingestion_log')
      .select('id, cycle_id, final_status, failure_pass, total_cost_usd, total_latency_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(recentLimit),
    supabase
      .from('ingestion_log')
      .select('final_status, total_cost_usd')
      .gte('created_at', sevenDaysAgo),
  ]);
  if (recentRes.error) {
    throw new DataLayerError(`Database error in fetchRecentIngestionStats (recent): ${recentRes.error.message}`, 'DATABASE_ERROR', recentRes.error);
  }
  if (windowRes.error) {
    throw new DataLayerError(`Database error in fetchRecentIngestionStats (window): ${windowRes.error.message}`, 'DATABASE_ERROR', windowRes.error);
  }

  const recentData = recentRes.data ?? [];
  const windowData = windowRes.data ?? [];

  if (!Array.isArray(recentData) || recentData.some(row => row == null || typeof row !== 'object' || (row.id !== undefined && typeof row.id !== 'string'))) {
    throw new DataLayerError('Malformed ingestion log summaries in fetchRecentIngestionStats', 'DATABASE_ERROR');
  }

  const histogram7d: Record<string, number> = {};
  let totalCost7dUsd = 0;
  for (const row of windowData) {
    if (row == null || typeof row !== 'object') {
      throw new DataLayerError('Malformed log row in fetchRecentIngestionStats window', 'DATABASE_ERROR');
    }
    const status = row.final_status;
    if (status !== undefined && status !== null) {
      if (typeof status !== 'string') {
        throw new DataLayerError('Malformed status field in fetchRecentIngestionStats window', 'DATABASE_ERROR');
      }
      histogram7d[status] = (histogram7d[status] ?? 0) + 1;
    }
    const cost = row.total_cost_usd;
    if (cost !== null && cost !== undefined) {
      if (typeof cost !== 'number') {
        throw new DataLayerError('Malformed cost field in fetchRecentIngestionStats window', 'DATABASE_ERROR');
      }
      totalCost7dUsd += cost;
    }
  }
  return {
    recent: recentData as IngestionLogSummary[],
    histogram7d,
    totalCost7dUsd: Number(totalCost7dUsd.toFixed(4)),
  };
}

export interface SpendBreakdown30d {
  /** Per-source 30-day spend in USD (rounded to 4dp). */
  personalizeUsd: number;
  jobFollowupUsd: number;
  ingestionUsd: number;
  /** Sum of all three. */
  totalUsd: number;
}

/**
 * 30-day Anthropic spend across all three audit tables. Used by the
 * diagnostic panel's "Spending (last 30d)" tile — the threshold metric
 * for the multi-pass-economics revisit per spec §10.1 (re-evaluate when
 * monthly Anthropic spend > $50).
 *
 * Each source is queried independently. RLS gates per-source visibility:
 *   - personalize_log + job_followup_log: user-scoped (the user's own rows)
 *   - ingestion_log: seed-only (Kevin sees system-wide ingest spend;
 *     gift recipients see 0 for ingestion, which is operationally correct)
 *
 * Errors throw — the panel surfaces them as a failure tile rather than
 * showing a misleading partial total.
 */
export async function fetchSpend30d(userId: string): Promise<SpendBreakdown30d> {
  validateNonEmptyString(userId, 'userId');
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const [personalizeRes, jobFollowupRes, ingestRes] = await Promise.all([
    supabase
      .from('personalize_log')
      .select('total_cost_usd')
      .eq('user_id', userId)
      .gte('created_at', since),
    supabase
      .from('job_followup_log')
      .select('total_cost_usd')
      .eq('user_id', userId)
      .gte('created_at', since),
    supabase
      .from('ingestion_log')
      .select('total_cost_usd')
      .gte('created_at', since),
  ]);
  if (personalizeRes.error) {
    throw new DataLayerError(`Database error in fetchSpend30d (personalize): ${personalizeRes.error.message}`, 'DATABASE_ERROR', personalizeRes.error);
  }
  if (jobFollowupRes.error) {
    throw new DataLayerError(`Database error in fetchSpend30d (jobFollowup): ${jobFollowupRes.error.message}`, 'DATABASE_ERROR', jobFollowupRes.error);
  }
  if (ingestRes.error) {
    throw new DataLayerError(`Database error in fetchSpend30d (ingest): ${ingestRes.error.message}`, 'DATABASE_ERROR', ingestRes.error);
  }
  const sumCol = (rows: unknown[]): number => {
    let s = 0;
    for (const r of rows) {
      if (r == null || typeof r !== 'object') {
        throw new DataLayerError('Malformed row in fetchSpend30d cost aggregation', 'DATABASE_ERROR');
      }
      const cost = (r as { total_cost_usd: number | null }).total_cost_usd;
      if (cost !== null && cost !== undefined) {
        if (typeof cost !== 'number') {
          throw new DataLayerError('Malformed cost field in fetchSpend30d', 'DATABASE_ERROR');
        }
        s += cost;
      }
    }
    return s;
  };
  const personalizeUsd = Number(sumCol(personalizeRes.data ?? []).toFixed(4));
  const jobFollowupUsd = Number(sumCol(jobFollowupRes.data ?? []).toFixed(4));
  const ingestionUsd = Number(sumCol(ingestRes.data ?? []).toFixed(4));
  return {
    personalizeUsd,
    jobFollowupUsd,
    ingestionUsd,
    totalUsd: Number((personalizeUsd + jobFollowupUsd + ingestionUsd).toFixed(4)),
  };
}

interface RecordAnswerArgs {
  userId: string;
  term: TermRow;
  outcome: 'correct' | 'wrong' | 'partial';
  prev: UserProgressRow | undefined;
}

/** Persist a single quiz answer. Returns the resulting row + whether the term just mastered. */
export async function recordAnswer({
  userId,
  term,
  outcome,
  prev,
}: RecordAnswerArgs): Promise<{ row: UserProgressRow; mastered: boolean }> {
  validateNonEmptyString(userId, 'userId');
  validateObject(term, 'term');
  validateNonEmptyString(term.id, 'term.id');
  if (outcome !== 'correct' && outcome !== 'wrong' && outcome !== 'partial') {
    throw new DataLayerError('outcome must be correct, wrong, or partial', 'VALIDATION_ERROR');
  }
  if (prev !== undefined && prev !== null) {
    validateObject(prev, 'prev');
  }

  const now = new Date();
  const correctNow = outcome === 'correct' || outcome === 'partial';
  const score = updateMastery(prev?.mastery_score ?? 0, outcome);
  const correctCount = (prev?.correct_count ?? 0) + (correctNow ? 1 : 0);
  const incorrectCount = (prev?.incorrect_count ?? 0) + (correctNow ? 0 : 1);
  const srs = nextSrs(prev?.srs_interval_days ?? 1, outcome, prev?.ease_factor ?? DEFAULT_EASE, now);
  const lapseCount = (prev?.lapse_count ?? 0) + (outcome === 'wrong' ? 1 : 0);

  const insertOrUpdate = {
    user_id: userId,
    term_id: term.id,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    last_seen_at: now.toISOString(),
    last_correct_at: correctNow ? now.toISOString() : prev?.last_correct_at ?? null,
    mastery_score: score,
    next_review_at: srs.nextReviewAt,
    srs_interval_days: srs.intervalDays,
    ease_factor: srs.ease,
    lapse_count: lapseCount,
  };

  const { data, error } = await supabase
    .from('user_progress')
    .upsert(insertOrUpdate, { onConflict: 'user_id,term_id' })
    .select()
    .single();
  if (error) {
    throw new DataLayerError(`Database error in recordAnswer: ${error.message}`, 'DATABASE_ERROR', error);
  }
  if (!data || typeof data !== 'object' || data.term_id !== term.id) {
    throw new DataLayerError('Malformed user progress returned from recordAnswer', 'DATABASE_ERROR');
  }

  const mastered = prev
    ? justMastered(prev, score, correctCount)
    : isMastered({ mastery_score: score, correct_count: correctCount });
  return { row: data as UserProgressRow, mastered };
}

/**
 * Module-level set of lesson sessionIds that have already been counted toward the
 * `lessons_completed` increment in this browser session. The unique `(user_id, local_date)`
 * constraint already prevents duplicate inserts, but in React StrictMode the lesson-summary
 * useEffect runs twice and would otherwise double-bump the lessons_completed counter on the
 * UPDATE branch. Idempotency at this layer keeps the data layer the single source of truth
 * and lets the UI effect stay simple.
 */
const bumpedLessonSessions = new Set<string>();

/** Bump the streak log for today. Returns whether this was the first lesson of the day. */
export async function bumpStreakDay(
  userId: string,
  xpEarned: number,
  sessionId: string,
): Promise<{ firstOfDay: boolean; row: StreakLogRow; alreadyCounted: boolean }> {
  validateNonEmptyString(userId, 'userId');
  validateNumber(xpEarned, 'xpEarned');
  if (typeof sessionId !== 'string') {
    throw new DataLayerError('sessionId must be a string', 'VALIDATION_ERROR');
  }
  const today = todayLocalDate();
  const { data: existing, error: fetchErr } = await supabase
    .from('streak_log')
    .select('*')
    .eq('user_id', userId)
    .eq('local_date', today)
    .maybeSingle();

  if (fetchErr) {
    throw new DataLayerError(`Database error in bumpStreakDay (fetch): ${fetchErr.message}`, 'DATABASE_ERROR', fetchErr);
  }

  // Has this exact lesson already incremented today's row in this session?
  const alreadyCounted = sessionId !== '' && bumpedLessonSessions.has(sessionId);

  if (existing) {
    if (alreadyCounted) {
      // Effect re-ran for the same lesson in StrictMode — return the row as-is rather
      // than double-counting. We deliberately do not even add the XP a second time.
      return { firstOfDay: false, row: existing, alreadyCounted: true };
    }
    const { data, error } = await supabase
      .from('streak_log')
      .update({
        lessons_completed: existing.lessons_completed + 1,
        xp_earned: existing.xp_earned + xpEarned,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      throw new DataLayerError(`Database error in bumpStreakDay (update): ${error.message}`, 'DATABASE_ERROR', error);
    }
    if (!data || typeof data !== 'object' || (data.user_id !== undefined && data.user_id !== userId)) {
      throw new DataLayerError('Malformed streak log row returned from bumpStreakDay update', 'DATABASE_ERROR');
    }
    if (sessionId !== '') bumpedLessonSessions.add(sessionId);
    return { firstOfDay: false, row: data as StreakLogRow, alreadyCounted: false };
  } else {
    if (alreadyCounted) {
      // Defensive: shouldn't normally hit this — the existing row should have been
      // returned above. But if local clocks roll past midnight between renders, we
      // bail rather than insert a phantom second row.
      return { firstOfDay: false, row: existing as never, alreadyCounted: true };
    }
    const { data, error } = await supabase
      .from('streak_log')
      .insert({
        user_id: userId,
        local_date: today,
        lessons_completed: 1,
        xp_earned: xpEarned + XP.FIRST_LESSON_OF_DAY_BONUS,
      })
      .select()
      .single();
    if (error) {
      throw new DataLayerError(`Database error in bumpStreakDay (insert): ${error.message}`, 'DATABASE_ERROR', error);
    }
    if (!data || typeof data !== 'object' || (data.user_id !== undefined && data.user_id !== userId)) {
      throw new DataLayerError('Malformed streak log row returned from bumpStreakDay insert', 'DATABASE_ERROR');
    }
    if (sessionId !== '') bumpedLessonSessions.add(sessionId);
    return { firstOfDay: true, row: data as StreakLogRow, alreadyCounted: false };
  }
}

/**
 * Fetch terms inserted since `sinceIso`. Used by the home "+N new" badge and
 * the what's-new screen. `sinceIso` is the user's `settings.last_seen_whats_new_at`.
 */
export async function fetchNewTermsSince(sinceIso: string): Promise<TermRow[]> {
  validateNonEmptyString(sinceIso, 'sinceIso');
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false });
  if (error) {
    throw new DataLayerError(`Database error in fetchNewTermsSince: ${error.message}`, 'DATABASE_ERROR', error);
  }
  const rows = data ?? [];
  if (!Array.isArray(rows) || rows.some(row => row == null || typeof row !== 'object' || typeof row.id !== 'string')) {
    throw new DataLayerError('Malformed terms returned from fetchNewTermsSince', 'DATABASE_ERROR');
  }
  return rows as TermRow[];
}

/** Total XP across all of a user's streak_log rows. */
export async function fetchTotalXp(userId: string): Promise<number> {
  validateNonEmptyString(userId, 'userId');
  const { data, error } = await supabase
    .from('streak_log')
    .select('xp_earned')
    .eq('user_id', userId);
  if (error) {
    throw new DataLayerError(`Database error in fetchTotalXp: ${error.message}`, 'DATABASE_ERROR', error);
  }
  const rows = data ?? [];
  if (!Array.isArray(rows)) {
    throw new DataLayerError('Malformed data returned from fetchTotalXp', 'DATABASE_ERROR');
  }
  let total = 0;
  for (const r of rows) {
    if (r == null || typeof r !== 'object') {
      throw new DataLayerError('Malformed row in fetchTotalXp', 'DATABASE_ERROR');
    }
    const val = (r as { xp_earned: number | null }).xp_earned;
    if (val !== null && val !== undefined) {
      if (typeof val !== 'number') {
        throw new DataLayerError('Malformed xp_earned value in fetchTotalXp', 'DATABASE_ERROR');
      }
      total += val;
    }
  }
  return total;
}

// ────────────────────────────────────────────────────────────
// Stage B+1.18 — weekly self-portrait panel
// (cloud-migration-056 adds the dismissal timestamp; this helper
// computes the panel's body stats from personalize_log)
// ────────────────────────────────────────────────────────────

/**
 * Aggregates the home-page weekly "self-portrait" panel reads from
 * `personalize_log`. Every number here is computable from a real row —
 * `null` / `0` paths are returned literally so the renderer can suppress
 * lines whose stat is zero rather than fabricate a figure.
 *
 * - `newTerms`: distinct `term_id`s with at least one successful
 *   personalization (`final_status = 'cached'`) this week.
 * - `usedAnalogy`: subset of `newTerms` where the most-recent successful
 *   row's verifier classified `uses_analogy: true`. Reads from
 *   `pass2_retry_result.uses_analogy` when the retry path was taken,
 *   else `pass2_result.uses_analogy`.
 * - `plainEnglish`: `newTerms - usedAnalogy`. Stored explicitly so the
 *   renderer doesn't re-derive it (and so a future "indeterminate"
 *   bucket can land here without changing the type).
 *
 * NOTE on domain attribution: today, `personalize_log` does NOT store
 * which user-profile domain the analogy was drawn from (job vs interest
 * vs heritage etc.). If/when that lands as a Pass 1 / Pass 2 output
 * field, this helper will gain a `byDomain: { job, interest, heritage }`
 * sub-shape. Until then the panel surfaces only the analogy/plain-
 * english split — domain breakdown is omitted rather than fabricated.
 *
 * Returns `null`-when-zero discipline: if `newTerms` is 0, every other
 * field is 0. The home renderer uses that as the suppress-the-panel
 * signal (zero rows = don't show a sad-empty state).
 */
export interface WeeklyPortraitData {
  /** ISO timestamp of the start of this week (Mon 00:00 in America/New_York). */
  weekStart: string;
  /** Distinct term_ids personalized successfully this week. */
  newTerms: number;
  /** Subset where the verifier said `uses_analogy: true`. */
  usedAnalogy: number;
  /** Subset where the verifier said `uses_analogy: false`. */
  plainEnglish: number;
}

/**
 * Pull the user's `personalize_log` rows for this week and fold them into
 * the panel-ready shape. Service-role-only RLS was relaxed for SELECT in
 * cloud-migration-023 — the user reads their own rows directly.
 *
 * Failure path: returns `{ newTerms: 0, ... }` on any transport error so
 * the panel silently suppresses (better than a render crash for an
 * incidental UX surface).
 */
export async function fetchWeeklyPortraitData(userId: string): Promise<WeeklyPortraitData> {
  validateNonEmptyString(userId, 'userId');
  const weekStart = startOfWeekIso();
  try {
    const { data, error } = await supabase
      .from('personalize_log')
      .select('term_id, pass2_result, pass2_retry_result, created_at')
      .eq('user_id', userId)
      .eq('final_status', 'cached')
      .gte('created_at', weekStart)
      .order('created_at', { ascending: false });
    if (error) {
      throw new DataLayerError(`Database error in fetchWeeklyPortraitData: ${error.message}`, 'DATABASE_ERROR', error);
    }

    const seen = new Set<string>();
    let usedAnalogy = 0;
    let plainEnglish = 0;
    const rows = data ?? [];
    if (!Array.isArray(rows)) {
      throw new DataLayerError('Malformed personalize logs returned from fetchWeeklyPortraitData', 'DATABASE_ERROR');
    }
    for (const row of rows as Array<{
      term_id: string;
      pass2_result: { uses_analogy?: boolean } | null;
      pass2_retry_result: { uses_analogy?: boolean } | null;
    }>) {
      if (row == null || typeof row !== 'object' || typeof row.term_id !== 'string') {
        throw new DataLayerError('Malformed log row in fetchWeeklyPortraitData', 'DATABASE_ERROR');
      }
      if (seen.has(row.term_id)) continue;
      seen.add(row.term_id);
      const finalVerdict =
        row.pass2_retry_result?.uses_analogy ??
        row.pass2_result?.uses_analogy ??
        null;
      if (finalVerdict === true) {
        usedAnalogy += 1;
      } else {
        plainEnglish += 1;
      }
    }

    return {
      weekStart,
      newTerms: seen.size,
      usedAnalogy,
      plainEnglish,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[fetchWeeklyPortraitData] threw:', err);
    return { weekStart, newTerms: 0, usedAnalogy: 0, plainEnglish: 0 };
  }
}

// ────────────────────────────────────────────────────────────
// Stage B+1.18 — "spotted in the wild" recognition counter
// (cloud-migration-055)
// ────────────────────────────────────────────────────────────

export interface SpottedScanLogInput {
  userId: string;
  totalWords: number;
  masteredCount: number;
  learningCount: number;
  unseenCount: number;
  termIds: string[];
}

/**
 * Insert one row into `spotted_scan_log` after a /spotted scan finishes.
 * Fire-and-forget — the caller does NOT await this. RLS gates the write
 * to `auth.uid() = userId` so a misuse can't leak across users.
 *
 * Errors are swallowed (console.error only) — the user's scan is the
 * load-bearing operation; the log row is incidental analytics. Mirrors
 * the silent-fallback discipline of `pickLivedIcons` and friends.
 */
export async function logSpottedScan(input: SpottedScanLogInput): Promise<void> {
  try {
    if (
      !input ||
      typeof input.userId !== 'string' ||
      !input.userId.trim() ||
      typeof input.totalWords !== 'number' ||
      typeof input.masteredCount !== 'number' ||
      typeof input.learningCount !== 'number' ||
      typeof input.unseenCount !== 'number' ||
      !Array.isArray(input.termIds) ||
      !input.termIds.every(t => typeof t === 'string')
    ) {
      // eslint-disable-next-line no-console
      console.warn('[logSpottedScan] ignored due to invalid input validation');
      return;
    }
    const { error } = await supabase.from('spotted_scan_log').insert({
      user_id: input.userId,
      total_words: input.totalWords,
      mastered_count: input.masteredCount,
      learning_count: input.learningCount,
      unseen_count: input.unseenCount,
      term_ids: input.termIds,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[logSpottedScan] insert failed:', error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[logSpottedScan] threw:', err);
  }
}

export async function fetchRecentSpottedScans(
  userId: string,
  limit = 3,
): Promise<RecentSpottedScan[]> {
  const { data, error } = await supabase
    .from('spotted_scan_log')
    .select('id, scan_at, total_words, mastered_count, learning_count, unseen_count, term_ids')
    .eq('user_id', userId)
    .order('scan_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecentSpottedScan[];
}

export interface SpottedStatsWindow {
  /** Number of distinct scans (= transcripts pasted) in the window. */
  transcripts: number;
  /**
   * Distinct term IDs across the window where the term was either
   * mastered OR learning at scan time. Counts each term once even if it
   * appeared in multiple transcripts.
   */
  recognized: number;
  /** Distinct mastered term IDs across the window. Subset of `recognized`. */
  mastered: number;
}

export interface SpottedStats {
  thisWeek: SpottedStatsWindow;
  allTime: SpottedStatsWindow;
}

/**
 * Compute the start-of-Monday boundary for the user's "this week" window
 * in America/New_York (matches the streak engine's tz). Returns an ISO
 * timestamp suitable for a Supabase `gte` filter on `scan_at`.
 *
 * Logic: take "now" expressed as YMD in NY, walk back to the most recent
 * Monday (Sunday counts as 6 days back, Monday counts as 0), and return
 * 00:00:00 of that NY-local day converted to UTC for the query.
 */
export function startOfWeekIso(now: Date = new Date()): string {
  if (!(now instanceof Date) || isNaN(now.getTime())) {
    throw new DataLayerError('now must be a valid Date instance', 'VALIDATION_ERROR');
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const weekdayShort = get('weekday');
  const weekdayMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  const daysSinceMon = weekdayMap[weekdayShort] ?? 0;

  const utcCandidate = new Date(Date.UTC(year, month - 1, day));
  utcCandidate.setUTCDate(utcCandidate.getUTCDate() - daysSinceMon);

  const nyMidnightProbe = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const probeParts = nyMidnightProbe.formatToParts(utcCandidate);
  const probeHour = Number(probeParts.find((p) => p.type === 'hour')?.value ?? '0');
  const offsetHours = probeHour === 0 ? 0 : 24 - probeHour;
  const result = new Date(utcCandidate.getTime() + offsetHours * 60 * 60 * 1000);
  return result.toISOString();
}

/**
 * Aggregate "spotted in the wild" stats for the profile page. Pulls the
 * user's scan-log rows in two windows (this week + all time) and folds
 * them into distinct-term recognized + mastered counts plus a transcript
 * (= scan) count.
 *
 * "Recognized" counts a term as recognized if it was mastered OR learning
 * at scan time (mirrors the SummaryLine "you knew X" framing — unseen
 * terms don't count toward growth). Distinct across the window: the same
 * term seen in 5 transcripts counts once.
 */
export async function fetchSpottedStats(userId: string): Promise<SpottedStats> {
  validateNonEmptyString(userId, 'userId');
  const weekStart = startOfWeekIso();

  const [allRes, weekRes] = await Promise.all([
    supabase
      .from('spotted_scan_log')
      .select('id, mastered_count, learning_count, term_ids')
      .eq('user_id', userId),
    supabase
      .from('spotted_scan_log')
      .select('id, mastered_count, learning_count, term_ids')
      .eq('user_id', userId)
      .gte('scan_at', weekStart),
  ]);
  if (allRes.error) {
    throw new DataLayerError(`Database error in fetchSpottedStats (all-time): ${allRes.error.message}`, 'DATABASE_ERROR', allRes.error);
  }
  if (weekRes.error) {
    throw new DataLayerError(`Database error in fetchSpottedStats (this-week): ${weekRes.error.message}`, 'DATABASE_ERROR', weekRes.error);
  }

  const allData = allRes.data ?? [];
  const weekData = weekRes.data ?? [];

  if (!Array.isArray(allData) || allData.some(row => row == null || typeof row !== 'object' || typeof row.id !== 'string')) {
    throw new DataLayerError('Malformed spotted scan logs returned from fetchSpottedStats (all-time)', 'DATABASE_ERROR');
  }
  if (!Array.isArray(weekData) || weekData.some(row => row == null || typeof row !== 'object' || typeof row.id !== 'string')) {
    throw new DataLayerError('Malformed spotted scan logs returned from fetchSpottedStats (this-week)', 'DATABASE_ERROR');
  }

  return {
    thisWeek: foldStats(weekData as Array<Pick<SpottedScanLogRow, 'id' | 'mastered_count' | 'learning_count' | 'term_ids'>>),
    allTime: foldStats(allData as Array<Pick<SpottedScanLogRow, 'id' | 'mastered_count' | 'learning_count' | 'term_ids'>>),
  };
}

/**
 * Fold a slice of scan-log rows into a single window aggregate. Distinct
 * term IDs are accumulated across rows so the same term seen in multiple
 * scans counts once toward `recognized` / `mastered`.
 *
 * NOTE: `term_ids` only carries the recognized (mastered + learning) IDs
 * by convention of the writer in spotted.tsx — unseen terms aren't stored
 * because they don't count toward growth. So `recognized` = distinct size
 * of the union of all term_ids arrays.
 *
 * For `mastered` we sum per-row mastered_count (lossy — over-reports if
 * the same term is mastered in 2 scans), then cap at the recognized total
 * so the number stays internally consistent. Acceptable trade-off today;
 * the schema can grow a `mastered_term_ids text[]` column if exact
 * dedupe-across-window matters later.
 */
function foldStats(
  rows: Array<Pick<SpottedScanLogRow, 'id' | 'mastered_count' | 'learning_count' | 'term_ids'>>,
): SpottedStatsWindow {
  const recognizedSet = new Set<string>();
  let masteredSum = 0;
  for (const row of rows) {
    masteredSum += row.mastered_count ?? 0;
    for (const id of row.term_ids ?? []) {
      recognizedSet.add(id);
    }
  }
  const recognized = recognizedSet.size;
  const mastered = Math.min(masteredSum, recognized);
  return {
    transcripts: rows.length,
    recognized,
    mastered,
  };
}
