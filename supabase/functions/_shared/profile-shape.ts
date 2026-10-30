// Shared user-profile shape for Edge Functions that touch profile data.
//
// One source of truth for the gift-mode wizard payload + the accepted-recipient
// finalize step. If the schema drifts (new field, renamed field), both
// `send-gift-invite` and `accept-gift-invite` get TS errors at compile time
// instead of a silent runtime mismatch.
//
// This DOES NOT mirror every column of `user_profile` — only the fields that
// flow through the gift handoff. `personalization_enabled`, `gifted_by_user_id`,
// `created_at`, etc. are server-controlled and never appear in the wire
// payload.

// deno-lint-ignore-file no-explicit-any

import { validateLivedIcons } from './lived-icons-allowlist.ts';

export interface ProfileShape {
  goals_extended?: string[];
  goals_freeform?: string | null;
  job?: string | null;
  encounter_contexts?: string[];
  interests?: string[];
  heritage?: string | null;
  roles?: string[];
  background_text?: string | null;
  active_domain?: string | null;
  /**
   * Stage B+1.10 — preferred display name. Surfaced in greetings + toasts.
   * Capitalization is preserved exactly as entered (no force-lower / -upper
   * at sanitize time — the sanitizer only trims whitespace and length-caps).
   */
  display_name?: string | null;
  /**
   * Stage B+1.11 — sender's relationship to the recipient (gift mode), or the
   * user's own self-described relationship to the gifter (after accept). One of
   * the wizard's chip options ("father-in-law", "mentor", etc.) OR free-text
   * when "other" was picked. Capped at 60 chars. Personalization-relevant —
   * drives register and emotional distance in the translator prompt.
   */
  relationship?: string | null;
  /**
   * Stage B+1.11 — 0-3 Phosphor icon slugs from the lived-icons allowlist.
   * Picked by Opus via the `pick-lived-icons` Edge Function. Persists to
   * user_profile.lived_icons text[] (cloud-migration-033). The sanitizer
   * filters against the canonical allowlist (`validateLivedIcons`) — any
   * slug not in the allowlist is silently dropped. Wire = enforcement
   * boundary; the renderer trusts whatever lands here.
   */
  lived_icons?: string[];
  /**
   * Stage B+1.14 — public URL of the AI-generated badge PNG. Set by the
   * `generate-lived-icon-image` Edge Function. Persists to
   * user_profile.lived_icon_url (cloud-migration-038). Null = not
   * generated yet OR generation failed; renderer falls back to the
   * Phosphor-strip path. Sanitizer trims + length-caps; URL format isn't
   * validated past basic shape because the source is always the trusted
   * Edge Function (we don't accept arbitrary client-provided URLs).
   */
  lived_icon_url?: string | null;
}

const ARRAY_CAP = 50;
const JOB_MAX = 240;
const HERITAGE_MAX = 120;
const BACKGROUND_MAX = 500;
const GOALS_FREEFORM_MAX = 500;
const DISPLAY_NAME_MAX = 80;
const RELATIONSHIP_MAX = 60;
// Defensive cap on the lived_icon_url. Real Supabase Storage URLs are
// ~150-200 chars; 600 leaves headroom for query strings (the cache-buster
// `?t=<ts>` is ~15 chars) without admitting absurdly-long pasted garbage.
const LIVED_ICON_URL_MAX = 600;

function safeArray(v: any): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, ARRAY_CAP) : [];
}

function safeText(v: any, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

/**
 * Coerce an untrusted `unknown` payload into a clean `ProfileShape`. Returns
 * null if the input is null/undefined; otherwise returns an object where every
 * field is type-safe and length-bounded.
 *
 * Fields that come back as `null` (text fields with empty input) or `[]` (array
 * fields with no input) are still returned — the caller decides whether to
 * persist them. The Postgres `accept_gift_invite_atomic` function uses
 * `coalesce` to leave existing values untouched when the new value is null.
 */
export function sanitizeProfileShape(p: ProfileShape | null | undefined): ProfileShape | null {
  if (!p) return null;
  return {
    goals_extended: safeArray(p.goals_extended),
    goals_freeform: safeText(p.goals_freeform, GOALS_FREEFORM_MAX),
    job: safeText(p.job, JOB_MAX),
    encounter_contexts: safeArray(p.encounter_contexts),
    interests: safeArray(p.interests),
    heritage: safeText(p.heritage, HERITAGE_MAX),
    roles: safeArray(p.roles),
    background_text: safeText(p.background_text, BACKGROUND_MAX),
    active_domain: typeof p.active_domain === 'string' ? p.active_domain : undefined,
    display_name: safeText(p.display_name, DISPLAY_NAME_MAX),
    relationship: safeText(p.relationship, RELATIONSHIP_MAX),
    // B+1.11 — filter against the lived-icons allowlist + dedupe + cap at 3.
    // Any slug not in the curated allowlist is silently dropped here — the
    // wire is the place where we enforce content validity, not the renderer.
    lived_icons: validateLivedIcons(p.lived_icons, 3),
    // B+1.14 — sanitize the AI-badge URL through safeText (trim + cap +
    // empty→null). The URL is set by the Edge Function on success; client
    // payloads carrying this field on the gift handoff are trusted only
    // for length, not content (the Postgres function will reject
    // malformed paths upstream when the renderer attempts to load them).
    lived_icon_url: safeText(p.lived_icon_url, LIVED_ICON_URL_MAX),
  };
}
