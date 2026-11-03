// Shared core for the lived-icon image generation Edge Functions.
//
// Both `generate-lived-icon-image` and `generate-lived-icon-image-from-prompt`
// share the same Pass 1 → Pass 2 → upload pipeline. The only difference
// between the two endpoints is whether the request body carries a
// `user_request` field — and even that's accepted by both endpoints; the
// from-prompt variant just makes the field semantically required on the
// client side.
//
// We extract the core into _shared so both Edge Functions stay paper-thin
// (~30 lines each, just auth + body parse + delegate). This avoids having
// to duplicate the multi-pass orchestration in two places — the owner will
// thank himself in 6 months.

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { sanitizeProfileShape, type ProfileShape } from './profile-shape.ts';
import { estimateCostUsd, roundUsd, type TokenUsage } from './pricing.ts';

// ─── Tunables ──────────────────────────────────────────────────────────────────

const PASS1_MODEL = 'claude-opus-4-7';
const PASS1_TIMEOUT_MS = 30_000;
const PASS1_MAX_TOKENS = 400;

// OPERATOR NOTE: The operator must confirm the deployed GEMINI_API_KEY has paid image access + which model to use (gemini-2.5-flash-image may be limit:0 or deprecated). Do NOT guess a replacement model name.
const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 60_000;

const PER_USER_DAILY_CAP = 10;
const STORAGE_BUCKET = 'lived-icons';

// Opus 4.7 unit costs (USD per 1M tokens).
// Text-model pricing lives in _shared/pricing.ts (list price, cache tokens included).
// Gemini Flash Image — ~$0.04 per image as of 2026-05.
const GEMINI_PRICE_PER_IMAGE_USD = 0.04;

/**
 * Strips URLs (specifically any query params or URLs that could embed API keys)
 * from client-facing error messages or log strings.
 */
export function sanitizeErrorText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/https?:\/\/\S+/g, '[url]');
}

// ─── Audit log payload shape (mirrors lived_icon_generation_log columns) ───────

export type FinalStatus =
  | 'success'
  | 'fallback-empty'
  | 'fallback-parse'
  | 'fallback-anthropic-error'
  | 'fallback-gemini-error'
  | 'fallback-storage-error'
  | 'fallback-rate-limited'
  | 'fallback-timeout'
  | 'skipped-over-cap';

interface LogPayload {
  user_id: string;
  request_started_at: string;
  motifs?: string[] | null;
  image_prompt?: string | null;
  user_request?: string | null;
  resulting_url?: string | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  total_cost_usd?: number | null;
  total_latency_ms?: number | null;
  final_status: FinalStatus;
  error_text?: string | null;
}

function calcCost(usage: TokenUsage | null, includeImage: boolean): number | null {
  if (usage === null && !includeImage) return null;
  const textUsd = usage ? estimateCostUsd(PASS1_MODEL, usage) : 0;
  const imgUsd = includeImage ? GEMINI_PRICE_PER_IMAGE_USD : 0;
  return roundUsd(textUsd + imgUsd);
}

async function writeLog(serviceClient: SupabaseClient, payload: LogPayload): Promise<void> {
  try {
    const { error } = await serviceClient.from('lived_icon_generation_log').insert(payload);
    if (error) console.error('[lived-icon-generation] log write failed:', error.message);
  } catch (err) {
    console.error('[lived-icon-generation] log write threw:', err);
  }
}

// ─── Pass 1 prompt + parser ────────────────────────────────────────────────────

const PASS1_SYSTEM_PROMPT = `You design a single AI badge that visually represents this person's world. Pick 2-3 specific motifs from their profile (job, interests, heritage, roles, freeform background, relationship, where they encounter terms). Then write a one-line image-gen prompt that combines those motifs into a single flat-art badge.

Rules:
- Pick 2-3 motifs total. Three is best when the profile is rich; two is fine when it's sparse.
- Motifs must be CONCRETE OBJECTS, not abstractions. ("soccer ball" YES, "athleticism" NO. "palm tree" YES, "Florida vibes" NO. "stethoscope" YES, "healthcare" NO.)
- The motifs should be specific to THIS person — pull from their actual profile. Do NOT invent details that aren't in the profile.
- The image-gen prompt MUST describe a single circular badge with all motifs arranged inside the circle (NOT three separate icons in a row — one composition).
- The image-gen prompt MUST require ALL of these style constraints, verbatim:
  - "single violet stroke #7C5CFF, no fills, no shading"
  - "transparent background"
  - "flat-art badge, minimalist line work"
  - "square 512x512 PNG"
  - "Studio Ghibli meets Phosphor icons aesthetic"
- If the user supplied a USER REQUEST (e.g. "make it more about birds"), let it bias your motif picks toward the request. Don't override the request — honor it. If the request is incompatible with the profile (request says "trains" but profile has zero transport signal), pick the closest fit and proceed; do NOT refuse.

Reply with ONLY a single JSON object on one line:
{"motifs":["motif one","motif two","motif three"],"image_prompt":"flat-art badge, single circular violet outline #7C5CFF stroke. inside the circle: a soccer ball, a palm tree, an open book, arranged in a triangle. minimalist line work, no shading, no fills, no color other than violet. transparent background. square 512x512 PNG. Studio Ghibli meets Phosphor icons aesthetic."}

DO NOT add commentary, reasoning, or any field beyond the JSON above.`;

function buildPass1UserMessage(p: ProfileShape, userRequest: string | null): string {
  const parts: string[] = [];
  if (p.job && p.job.trim().length > 0) parts.push(`JOB: ${p.job.trim()}`);
  if (p.heritage && p.heritage.trim().length > 0) parts.push(`FROM: ${p.heritage.trim()}`);
  if (Array.isArray(p.roles) && p.roles.length > 0) parts.push(`ROLES: ${p.roles.join(', ')}`);
  if (Array.isArray(p.interests) && p.interests.length > 0) parts.push(`INTERESTS: ${p.interests.join(', ')}`);
  if (p.background_text && p.background_text.trim().length > 0) parts.push(`BACKGROUND: ${p.background_text.trim()}`);
  if (p.goals_freeform && p.goals_freeform.trim().length > 0) parts.push(`WHY THEY'RE HERE: ${p.goals_freeform.trim()}`);
  if (Array.isArray(p.encounter_contexts) && p.encounter_contexts.length > 0) {
    parts.push(`WHERE THEY ENCOUNTER TERMS: ${p.encounter_contexts.join(', ')}`);
  }
  if (p.relationship && p.relationship.trim().length > 0) parts.push(`RELATIONSHIP: ${p.relationship.trim()}`);
  if (p.display_name && p.display_name.trim().length > 0) parts.push(`NAME: ${p.display_name.trim()}`);

  const profileBlock = parts.length > 0
    ? parts.join('\n')
    : '(profile is sparse — pick the most universal 2 motifs you can: e.g. a coffee cup + a sun.)';

  if (userRequest && userRequest.trim().length > 0) {
    return `${profileBlock}\n\nUSER REQUEST: ${userRequest.trim()}\n\nPick 2-3 motifs and write the image-gen prompt. Return JSON only.`;
  }
  return `${profileBlock}\n\nPick 2-3 motifs and write the image-gen prompt. Return JSON only.`;
}

function stripFencing(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

interface Pass1Output {
  motifs: string[];
  image_prompt: string;
}

function parsePass1(raw: string): Pass1Output | null {
  try {
    const parsed = JSON.parse(stripFencing(raw));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const motifs = (parsed as { motifs?: unknown }).motifs;
    const prompt = (parsed as { image_prompt?: unknown }).image_prompt;
    if (!Array.isArray(motifs) || typeof prompt !== 'string') return null;
    const cleanedMotifs = motifs
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      .map((m) => m.trim().slice(0, 60))
      .slice(0, 3);
    if (cleanedMotifs.length === 0) return null;
    if (prompt.trim().length === 0) return null;
    return { motifs: cleanedMotifs, image_prompt: prompt.trim().slice(0, 2000) };
  } catch {
    return null;
  }
}

// ─── Pass 2: Gemini response shape ─────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inline_data?: { mime_type?: string; data?: string };
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
}

function extractPngBase64(geminiResp: GeminiResponse): string | null {
  const parts = geminiResp?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const snake = part?.inline_data;
    if (snake && typeof snake.data === 'string' && snake.data.length > 0) {
      const mime = (snake.mime_type ?? '').toLowerCase();
      if (mime === '' || mime.includes('png') || mime.includes('image')) return snake.data;
    }
    const camel = part?.inlineData;
    if (camel && typeof camel.data === 'string' && camel.data.length > 0) {
      const mime = (camel.mimeType ?? '').toLowerCase();
      if (mime === '' || mime.includes('png') || mime.includes('image')) return camel.data;
    }
  }
  return null;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Daily cap check ───────────────────────────────────────────────────────────

async function isOverDailyCap(serviceClient: SupabaseClient, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await serviceClient
    .from('lived_icon_generation_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('final_status', 'success')
    .gte('created_at', since);
  if (error) {
    console.error('[lived-icon-generation] cap-check failed:', error.message);
    return false;
  }
  return (count ?? 0) >= PER_USER_DAILY_CAP;
}

// ─── Storage upload ────────────────────────────────────────────────────────────
//
// Path convention:
//   - Self-generation (caller is generating their OWN badge): `{user_id}.png`.
//     One PNG per user, overwrites on regeneration, URL stable.
//   - Gift pre-generation (caller is the SENDER, generating for a not-yet-
//     signed-up recipient): `gift/{sha256(email).slice(0,16)}.png`. Hashed
//     so a recipient email never appears in storage paths (which are world-
//     readable via the public bucket). Survives the sender's own
//     regenerations + survives the recipient's first /home mount where
//     they trigger their own generation under their `{user_id}.png` path.

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s.toLowerCase().trim());
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function resolveStoragePath(userId: string, recipientEmail: string | null): Promise<string> {
  if (recipientEmail && recipientEmail.length > 0) {
    const hash = (await sha256Hex(recipientEmail)).slice(0, 16);
    return `gift/${hash}.png`;
  }
  return `${userId}.png`;
}

async function uploadPng(
  serviceClient: SupabaseClient,
  storagePath: string,
  pngBytes: Uint8Array,
  supabaseUrl: string,
): Promise<string | null> {
  const { error } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pngBytes, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '60',
    });
  if (error) {
    console.error('[lived-icon-generation] storage upload failed:', error.message);
    return null;
  }
  const base = supabaseUrl.replace(/\/+$/, '');
  const ts = Date.now();
  return `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}?t=${ts}`;
}

// ─── Persist URL to user_profile (best-effort) ─────────────────────────────────

async function persistUrlToProfile(
  serviceClient: SupabaseClient,
  userId: string,
  url: string,
): Promise<void> {
  const { error } = await serviceClient
    .from('user_profile')
    .update({ lived_icon_url: url })
    .eq('user_id', userId);
  if (error) {
    console.error('[lived-icon-generation] persist URL failed:', error.message);
  }
}

// ─── Public output type ────────────────────────────────────────────────────────

export interface GenerationResult {
  url: string | null;
  motifs: string[];
  /** True when any pass failed and the URL is null. */
  isFallback: boolean;
  status?: FinalStatus;
  error?: string;
}

// ─── Public entry: orchestrate the full pipeline ───────────────────────────────

export interface GenerationContext {
  serviceClient: SupabaseClient;
  userId: string;
  supabaseUrl: string;
  anthropicKey: string;
  geminiKey: string;
  rawProfile: ProfileShape | null | undefined;
  /** Optional freeform user request to bias motif selection. */
  userRequest: string | null;
  /**
   * Optional — when present, the upload goes to a gift-namespace path
   * (`gift/<hash(email)>.png`) instead of the caller's `{user_id}.png`,
   * AND we skip the auto-persist to user_profile (the caller doesn't
   * own the recipient's profile row — they couldn't write to it anyway,
   * but skipping the call avoids a misleading log line).
   *
   * Used by gift-send finish() to pre-generate a recipient badge that
   * lands in `prefilled_profile.lived_icon_url` and flows through
   * `accept_gift_invite_atomic` to the recipient's user_profile at
   * accept time.
   */
  forRecipientEmail?: string | null;
}

/**
 * Run the full Pass 1 → Pass 2 → upload pipeline. Always resolves; never
 * throws. The audit log is written before every return.
 *
 * Failure modes (each returns `{ url: null, isFallback: true }` + writes
 * an audit row):
 *   - `fallback-rate-limited`     — per-user 10/day cap hit
 *   - `fallback-parse`            — Opus motif JSON unparseable
 *   - `fallback-anthropic-error`  — Anthropic 5xx / abort / network
 *   - `fallback-gemini-error`     — Gemini 5xx / no image data / network
 *   - `fallback-storage-error`    — base64 decode or upload failed
 *   - `fallback-timeout`          — AbortController fired (either pass)
 */
export async function runLivedIconGeneration(ctx: GenerationContext): Promise<GenerationResult> {
  const requestStartedAt = new Date().toISOString();
  const startMs = Date.now();
  const userRequest = ctx.userRequest;

  // ─── Daily cap check ─────────────────────────────────────────────────────────
  if (await isOverDailyCap(ctx.serviceClient, ctx.userId)) {
    await writeLog(ctx.serviceClient, {
      user_id: ctx.userId,
      request_started_at: requestStartedAt,
      user_request: userRequest,
      total_latency_ms: Date.now() - startMs,
      final_status: 'fallback-rate-limited',
      error_text: `over per-user daily cap (${PER_USER_DAILY_CAP}/day)`,
    });
    return { url: null, motifs: [], isFallback: true };
  }

  const sanitized = sanitizeProfileShape(ctx.rawProfile ?? null);
  const safeProfile: ProfileShape = sanitized ?? {
    interests: [],
    roles: [],
    encounter_contexts: [],
    goals_extended: [],
    lived_icons: [],
  };

  const anthropic = new Anthropic({ apiKey: ctx.anthropicKey });

  // ─── Pass 1 ──────────────────────────────────────────────────────────────────
  let motifs: string[] = [];
  let imagePrompt = '';
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let pass1Usage: TokenUsage | null = null;

  const pass1Controller = new AbortController();
  const pass1TimeoutId = setTimeout(() => pass1Controller.abort(), PASS1_TIMEOUT_MS);
  try {
    const response = (await anthropic.messages.create(
      {
        model: PASS1_MODEL,
        max_tokens: PASS1_MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: PASS1_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: buildPass1UserMessage(safeProfile, userRequest) }],
      },
      { signal: pass1Controller.signal },
    )) as any;
    tokensIn = response?.usage?.input_tokens ?? null;
    tokensOut = response?.usage?.output_tokens ?? null;
    pass1Usage = response?.usage ?? null;
    const block = response?.content?.[0];
    const rawText = block && block.type === 'text' ? (block.text as string) : '';
    const parsed = rawText ? parsePass1(rawText) : null;
    if (!parsed) {
      await writeLog(ctx.serviceClient, {
        user_id: ctx.userId,
        request_started_at: requestStartedAt,
        user_request: userRequest,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        total_cost_usd: calcCost(pass1Usage, false),
        total_latency_ms: Date.now() - startMs,
        final_status: 'fallback-parse',
        error_text: rawText.slice(0, 500),
      });
      return { url: null, motifs: [], isFallback: true };
    }
    motifs = parsed.motifs;
    imagePrompt = parsed.image_prompt;
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError' || /abort/i.test(err?.message ?? '');
    const safeErrText = sanitizeErrorText((err?.message ?? String(err)).slice(0, 500));
    console.error('[lived-icon-generation] pass 1 error:', err);
    await writeLog(ctx.serviceClient, {
      user_id: ctx.userId,
      request_started_at: requestStartedAt,
      user_request: userRequest,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      total_cost_usd: calcCost(pass1Usage, false),
      total_latency_ms: Date.now() - startMs,
      final_status: isTimeout ? 'fallback-timeout' : 'fallback-anthropic-error',
      error_text: safeErrText,
    });
    return { url: null, motifs: [], isFallback: true, status: isTimeout ? 'fallback-timeout' : 'fallback-anthropic-error', error: safeErrText };
  } finally {
    clearTimeout(pass1TimeoutId);
  }

  // ─── Pass 2 ──────────────────────────────────────────────────────────────────
  const gemController = new AbortController();
  const gemTimeoutId = setTimeout(() => gemController.abort(), GEMINI_TIMEOUT_MS);
  let pngBase64: string | null = null;
  try {
    const geminiUrl = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(ctx.geminiKey)}`;
    const geminiBody = {
      contents: [{ parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    };
    const r = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: gemController.signal,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      const errText = sanitizeErrorText(`gemini ${r.status}: ${text.slice(0, 400)}`);
      console.error('[lived-icon-generation] pass 2 (gemini) HTTP failure:', errText);
      await writeLog(ctx.serviceClient, {
        user_id: ctx.userId,
        request_started_at: requestStartedAt,
        motifs,
        image_prompt: imagePrompt,
        user_request: userRequest,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        total_cost_usd: calcCost(pass1Usage, false),
        total_latency_ms: Date.now() - startMs,
        final_status: 'fallback-gemini-error',
        error_text: errText,
      });
      return { url: null, motifs, isFallback: true, status: 'fallback-gemini-error', error: errText };
    }
    const data = (await r.json()) as GeminiResponse;
    pngBase64 = extractPngBase64(data);
    if (!pngBase64) {
      const errText = 'gemini response had no inline image data';
      console.error('[lived-icon-generation] pass 2 (gemini) format error:', errText);
      await writeLog(ctx.serviceClient, {
        user_id: ctx.userId,
        request_started_at: requestStartedAt,
        motifs,
        image_prompt: imagePrompt,
        user_request: userRequest,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        total_cost_usd: calcCost(pass1Usage, false),
        total_latency_ms: Date.now() - startMs,
        final_status: 'fallback-gemini-error',
        error_text: errText,
      });
      return { url: null, motifs, isFallback: true, status: 'fallback-gemini-error', error: errText };
    }
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError' || /abort/i.test(err?.message ?? '');
    const finalStatus: FinalStatus = isTimeout ? 'fallback-timeout' : 'fallback-gemini-error';
    const errText = sanitizeErrorText((err?.message ?? String(err)).slice(0, 500));
    console.error(`[lived-icon-generation] pass 2 (gemini) error (${finalStatus}):`, errText);
    await writeLog(ctx.serviceClient, {
      user_id: ctx.userId,
      request_started_at: requestStartedAt,
      motifs,
      image_prompt: imagePrompt,
      user_request: userRequest,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      total_cost_usd: calcCost(pass1Usage, false),
      total_latency_ms: Date.now() - startMs,
      final_status: finalStatus,
      error_text: errText,
    });
    return { url: null, motifs, isFallback: true, status: finalStatus, error: errText };
  } finally {
    clearTimeout(gemTimeoutId);
  }

  // ─── Pass 3: storage upload ──────────────────────────────────────────────────
  let pngBytes: Uint8Array;
  try {
    pngBytes = decodeBase64(pngBase64);
  } catch (err: any) {
    const errText = sanitizeErrorText(`base64 decode failed: ${(err?.message ?? String(err)).slice(0, 400)}`);
    await writeLog(ctx.serviceClient, {
      user_id: ctx.userId,
      request_started_at: requestStartedAt,
      motifs,
      image_prompt: imagePrompt,
      user_request: userRequest,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      total_cost_usd: calcCost(pass1Usage, true),
      total_latency_ms: Date.now() - startMs,
      final_status: 'fallback-storage-error',
      error_text: errText,
    });
    return { url: null, motifs, isFallback: true, status: 'fallback-storage-error', error: errText };
  }

  const recipientEmail = (ctx.forRecipientEmail ?? '').trim();
  const storagePath = await resolveStoragePath(
    ctx.userId,
    recipientEmail.length > 0 ? recipientEmail : null,
  );
  const publicUrl = await uploadPng(ctx.serviceClient, storagePath, pngBytes, ctx.supabaseUrl);
  if (!publicUrl) {
    const errText = 'storage upload returned null';
    await writeLog(ctx.serviceClient, {
      user_id: ctx.userId,
      request_started_at: requestStartedAt,
      motifs,
      image_prompt: imagePrompt,
      user_request: userRequest,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      total_cost_usd: calcCost(pass1Usage, true),
      total_latency_ms: Date.now() - startMs,
      final_status: 'fallback-storage-error',
      error_text: errText,
    });
    return { url: null, motifs, isFallback: true, status: 'fallback-storage-error', error: errText };
  }

  // Auto-persist the URL to user_profile.lived_icon_url ONLY for self-
  // generation. Gift pre-generation has nowhere to write — the recipient
  // doesn't have a user_profile row yet (it's created at
  // accept_gift_invite_atomic time, which copies the URL through from
  // prefilled_profile). The sender's caller does NOT want their own
  // profile updated with the recipient's badge URL, so we skip entirely
  // when forRecipientEmail is set.
  if (recipientEmail.length === 0) {
    await persistUrlToProfile(ctx.serviceClient, ctx.userId, publicUrl);
  }

  await writeLog(ctx.serviceClient, {
    user_id: ctx.userId,
    request_started_at: requestStartedAt,
    motifs,
    image_prompt: imagePrompt,
    user_request: userRequest,
    resulting_url: publicUrl,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    total_cost_usd: calcCost(pass1Usage, true),
    total_latency_ms: Date.now() - startMs,
    final_status: 'success',
  });

  return { url: publicUrl, motifs, isFallback: false };
}
