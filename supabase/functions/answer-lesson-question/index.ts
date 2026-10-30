// Jargon — server-side lesson question answerer.
//
// Server-side Q&A for questions asked during lessons. Auth: requires a valid
// Supabase JWT belonging to a user whose email is on the `allowed_users` table.
//
// Request: POST { question: string, term_id: string, cardMode?: string }
// Response: { ok: boolean, answer?: string, lessonUpdateNotice?: string, status?: string, message?: string }

// deno-lint-ignore-file no-explicit-any
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getUserFromJWT } from '../_shared/auth.ts';
import { corsHeaders, preflight, jsonResponse } from '../_shared/cors.ts';
import { isAllowlisted } from '../_shared/allowlist.ts';
import { checkSpend } from '../_shared/spend-guard.ts';

const ANSWER_MODEL = 'claude-sonnet-4-6';
const ANSWER_TIMEOUT_MS = 30_000;

// Sonnet 4.6 pricing: $3/MTok in, $15/MTok out
const PRICE_IN_PER_MTOK = 3;
const PRICE_OUT_PER_MTOK = 15;

interface LogPayload {
  user_id: string;
  term_label: string;
  cost_usd?: number | null;
  latency_ms?: number | null;
  status: string;
}

async function writeLog(serviceClient: any, payload: LogPayload): Promise<void> {
  try {
    const { error } = await serviceClient.from('lesson_question_log').insert(payload);
    if (error) console.error('[answer-lesson-question] log write failed:', error.message);
  } catch (err) {
    console.error('[answer-lesson-question] log write threw:', err);
  }
}

function calcCost(tokensIn: number | null, tokensOut: number | null): number | null {
  if (tokensIn === null && tokensOut === null) return null;
  const inUsd = ((tokensIn ?? 0) / 1_000_000) * PRICE_IN_PER_MTOK;
  const outUsd = ((tokensOut ?? 0) / 1_000_000) * PRICE_OUT_PER_MTOK;
  return Number((inUsd + outUsd).toFixed(5));
}

function buildSystemPrompt(term: string, termData: {
  term: string;
  one_line_definition?: string | null;
  long_definition?: string | null;
  example_in_sentence?: string | null;
  why_it_matters?: string | null;
  etymology?: string | null;
}): string {
  return `you help a learner who asked a question WHILE studying the technical term "${term}".

term details:
- term: ${term}
- definition: ${termData.one_line_definition ?? ''}
- detailed definition: ${termData.long_definition ?? ''}
- example: ${termData.example_in_sentence ?? ''}
- why it matters: ${termData.why_it_matters ?? ''}
- etymology: ${termData.etymology ?? ''}

answer their question clearly and concretely in 1-3 short sentences, side-reaction voice (lowercase, plainspoken, no fluff). ground the answer in the provided definition/example/why-it-matters. if the question reveals the app's own content is wrong or confusing, you MAY add a one-line lessonUpdateNotice.

return ONLY one JSON object: {"answer":"...","lessonUpdateNotice":"..."|null}. no markdown, no extra text.`;
}

function buildUserMessage(question: string, cardMode?: string): string {
  return `card mode: ${cardMode ?? 'unknown'}
question: ${question}`;
}

interface AnswerRequest {
  question: string;
  term_id: string;
  cardMode?: string;
}

interface ParsedAnswer {
  answer: string;
  lessonUpdateNotice?: string | null;
}

function tryParseJson(raw: string): ParsedAnswer | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.answer === 'string' &&
      parsed.answer.trim().length > 0
    ) {
      return {
        answer: parsed.answer.trim(),
        lessonUpdateNotice:
          typeof parsed.lessonUpdateNotice === 'string' && parsed.lessonUpdateNotice.trim().length > 0
            ? parsed.lessonUpdateNotice.trim()
            : null,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

Deno.serve(async (req) => {
  const startMs = Date.now();
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'method not allowed' }, 405);
  }

  // Auth: verify Supabase JWT and allowlist gate
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) {
    return jsonResponse(req, { error: 'missing authorization bearer' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey) {
    return jsonResponse(req, { error: 'server misconfigured: SUPABASE_URL or SUPABASE_ANON_KEY missing' }, 500);
  }

  const { user, error: userErr } = await getUserFromJWT(jwt, supabaseUrl, anonKey);
  if (userErr || !user?.email || !user?.id) {
    return jsonResponse(req, { error: 'invalid jwt', detail: userErr ?? 'no email' }, 401);
  }

  if (!serviceKey) {
    return jsonResponse(req, { error: 'server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing' }, 500);
  }
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const allow = await isAllowlisted(serviceClient, user.email);
  if (!allow.allowed) {
    return jsonResponse(req, { error: 'not on allowlist' }, 403);
  }

  // Body validation
  let body: AnswerRequest;
  try {
    body = (await req.json()) as AnswerRequest;
  } catch {
    return jsonResponse(req, { ok: false, status: 'fallback-parse', message: 'invalid json body' }, 200);
  }

  if (
    typeof body?.question !== 'string' ||
    !body.question.trim() ||
    typeof body?.term_id !== 'string' ||
    !body.term_id.trim()
  ) {
    return jsonResponse(req, { ok: false, status: 'fallback-invalid-request', message: 'missing required fields' }, 200);
  }

  // Spend guard check
  const spend = await checkSpend(serviceClient, user.id);
  if (!spend.allowed) {
    await writeLog(serviceClient, {
      user_id: user.id,
      term_label: body.term_id,
      cost_usd: 0,
      latency_ms: Date.now() - startMs,
      status: 'skipped-over-cap',
    });
    return jsonResponse(req, {
      ok: false,
      status: 'skipped-over-cap',
      message: 'the helper is at its monthly limit — try again next month.',
    }, 200);
  }

  // Fetch term row by term_id via serviceClient
  let termLabel = body.term_id;
  let termData: {
    term: string;
    one_line_definition?: string | null;
    long_definition?: string | null;
    example_in_sentence?: string | null;
    why_it_matters?: string | null;
    etymology?: string | null;
  } = { term: body.term_id };

  try {
    const { data: termRow } = await serviceClient
      .from('terms')
      .select('term, one_line_definition, long_definition, example_in_sentence, why_it_matters, etymology')
      .eq('id', body.term_id)
      .maybeSingle();

    if (termRow?.term) {
      termData = termRow;
      termLabel = termRow.term;
    }
  } catch {
    // If lookup fails or term not found, degrade gracefully using body.term_id as term
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    await writeLog(serviceClient, {
      user_id: user.id,
      term_label: termLabel,
      cost_usd: 0,
      latency_ms: Date.now() - startMs,
      status: 'fallback-misconfigured',
    });
    return jsonResponse(req, {
      ok: false,
      status: 'fallback-misconfigured',
      message: 'answerer misconfigured on server',
    }, 200);
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANSWER_TIMEOUT_MS);

  try {
    const response = (await anthropic.messages.create(
      {
        model: ANSWER_MODEL,
        max_tokens: 400,
        system: [
          {
            type: 'text',
            text: buildSystemPrompt(termData.term, termData),
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: buildUserMessage(body.question, body.cardMode) }],
      },
      { signal: controller.signal },
    )) as any;

    const tokensIn = response?.usage?.input_tokens ?? null;
    const tokensOut = response?.usage?.output_tokens ?? null;
    const costUsd = calcCost(tokensIn, tokensOut);
    const block = response?.content?.[0];

    if (block && block.type === 'text') {
      const parsed = tryParseJson(block.text);
      if (parsed) {
        await writeLog(serviceClient, {
          user_id: user.id,
          term_label: termLabel,
          cost_usd: costUsd,
          latency_ms: Date.now() - startMs,
          status: 'success',
        });
        return jsonResponse(req, {
          ok: true,
          answer: parsed.answer,
          lessonUpdateNotice: parsed.lessonUpdateNotice ?? undefined,
        }, 200);
      }
    }

    await writeLog(serviceClient, {
      user_id: user.id,
      term_label: termLabel,
      cost_usd: costUsd,
      latency_ms: Date.now() - startMs,
      status: 'fallback-parse',
    });
    return jsonResponse(req, {
      ok: false,
      status: 'fallback-parse',
      message: 'failed to parse answer',
    }, 200);
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError' || /abort/i.test(err?.message ?? '');
    console.error('[answer-lesson-question] error:', err);
    await writeLog(serviceClient, {
      user_id: user.id,
      term_label: termLabel,
      cost_usd: 0,
      latency_ms: Date.now() - startMs,
      status: isTimeout ? 'fallback-timeout' : 'fallback-anthropic-error',
    });
    return jsonResponse(req, {
      ok: false,
      status: isTimeout ? 'fallback-timeout' : 'fallback-anthropic-error',
      message: isTimeout ? 'answerer timed out' : 'answerer encountered an error',
    }, 200);
  } finally {
    clearTimeout(timeoutId);
  }
});
