// Paired comparison of the unchanged original verifier and the candidate
// verifier on identical frozen inputs. The model client is injected so tests
// can mock it and the CLI can point it at a local Ollama endpoint.
//
// Both arms send the same shipped Pass 2 system prompt and user message,
// regenerate once with the shipped Pass 3 prompt on failure, then re-verify,
// exactly like the Edge Function handler. The only difference between arms is
// the verdict parser: original = parseVerdict, candidate = parseVerdict plus
// the deterministic claim check. Nothing here changes either verifier.

import { createHash } from 'node:crypto'
import {
  PASS2_SYSTEM_PROMPT,
  PERSONALIZE_MAX_TOKENS_PASS2,
  PERSONALIZE_MAX_TOKENS_PASS3,
  PERSONALIZE_MAX_RETRIES,
  pass3SystemPrompt,
  buildPass2UserMessage,
  buildPass3UserMessage,
  buildFailedCriteriaBlock,
  parseRendering,
  parseVerdict,
} from '../../supabase/functions/personalize-term/prompts.ts'
import type { ParsedRendering, TermRow, UserProfileRow, VerifierVerdict } from '../../supabase/functions/personalize-term/prompts.ts'
import { claimCheckedParser } from '../../supabase/functions/personalize-term/claim-check.ts'

export type Arm = 'original' | 'candidate'
export const ARMS: Arm[] = ['original', 'candidate']
export type Label = 'correct' | 'incorrect' | 'unlabeled'

export interface FrozenInput {
  set: 'heldout' | 'historical'
  id: string
  label: Label
  label_source: string
  context_fit: string
  term: TermRow & { id: string }
  profile: UserProfileRow & { id: string }
  candidate: ParsedRendering
}

export interface ChatResult { text: string; latency_ms: number }
export type ChatFn = (args: { system: string; user: string; maxTokens: number }) => Promise<ChatResult>

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

// ─── Frozen inputs ──────────────────────────────────────────────────────────

export interface Sources {
  heldoutRaw: string
  heldoutSha256: string
  historyRaw: string
  contexts: { items: { id: string; term_id: string; profile_id: string; fit: string }[] }
  terms: (TermRow & { id: string })[]
  profiles: (UserProfileRow & { id: string })[]
  expertFiles: { reviewer: string; label?: string; run_ids?: string[]; labels?: { run_id: string; expert_label: string }[] }[]
}

export function buildFrozenInputs(src: Sources, sets: Array<'heldout' | 'historical'>): FrozenInput[] {
  if (sha256(src.heldoutRaw) !== src.heldoutSha256) throw new Error('Frozen held-out set changed')
  const term = (id: string) => { const t = src.terms.find(t => t.id === id); if (!t) throw new Error(`Unknown term ${id}`); return t }
  const profile = (id: string) => { const p = src.profiles.find(p => p.id === id); if (!p) throw new Error(`Unknown profile ${id}`); return p }
  const inputs: FrozenInput[] = []
  if (sets.includes('heldout')) {
    for (const item of JSON.parse(src.heldoutRaw).items) {
      const ctx = src.contexts.items.find(c => c.id === item.id)
      if (!ctx) throw new Error(`No frozen context for ${item.id}`)
      inputs.push({
        set: 'heldout', id: item.id,
        label: item.correct ? 'correct' : 'incorrect',
        label_source: 'synthetic author label',
        context_fit: ctx.fit,
        term: term(ctx.term_id), profile: profile(ctx.profile_id),
        candidate: item.candidate,
      })
    }
  }
  if (sets.includes('historical')) {
    const expert = new Map<string, { label: Label; reviewer: string }>()
    for (const f of src.expertFiles) {
      const entries = f.labels ?? (f.run_ids ?? []).map(run_id => ({ run_id, expert_label: f.label ?? '' }))
      for (const e of entries) expert.set(e.run_id, { label: e.expert_label as Label, reviewer: f.reviewer })
    }
    const rows = src.historyRaw.trim().split('\n').map(line => JSON.parse(line))
    for (const row of rows.filter(r => r.final_status !== 'fell_back_to_canonical')) {
      const e = expert.get(row.run_id)
      inputs.push({
        set: 'historical', id: row.run_id,
        label: e?.label ?? 'unlabeled',
        label_source: e ? `expert: ${e.reviewer}` : 'none',
        context_fit: 'original',
        term: term(row.term_id), profile: profile(row.profile_id),
        candidate: row.final_text,
      })
    }
  }
  return inputs
}

export const inputsDigest = (inputs: FrozenInput[]) => sha256(JSON.stringify(inputs))

// ─── One arm on one item (mirror of the handler's verify, retry, fallback) ────

export type FinalOutcome = 'accepted_frozen_candidate' | 'accepted_regenerated' | 'fell_back_to_canonical'

export interface ArmRecord {
  arm: Arm
  first_verdict: 'pass' | 'fail' | 'unparseable' | 'error'
  first_failed_criteria: string[]
  first_claim_check_reasons: string[]
  regenerated: boolean
  regeneration: 'not_needed' | 'parsed' | 'unparseable' | 'error' | 'skipped'
  regenerated_candidate: ParsedRendering | null
  retry_verdict: 'pass' | 'fail' | 'unparseable' | 'error' | null
  retry_failed_criteria: string[]
  final_outcome: FinalOutcome
  fallback_reason: string | null
  raw: Record<string, string>
  latency_ms: number
  error_text: string | null
}

const failed = (v: VerifierVerdict | null) =>
  v ? Object.entries(v).filter(([, c]) => c && typeof c === 'object' && (c as any).result === 'fail').map(([k]) => k) : []
const claimReasons = (v: VerifierVerdict | null) =>
  v ? (v.technical_accuracy_preserved?.reasoning ?? '').split(/(?=claim check:)/).filter(s => s.startsWith('claim check:')).map(s => s.trim()) : []

export async function runArm(chat: ChatFn, arm: Arm, input: FrozenInput, knownVocabulary: string[]): Promise<ArmRecord> {
  const parserFor = (c: ParsedRendering) => (arm === 'candidate' ? claimCheckedParser(c, parseVerdict) : parseVerdict)
  const rec: ArmRecord = {
    arm, first_verdict: 'error', first_failed_criteria: [], first_claim_check_reasons: [],
    regenerated: false, regeneration: 'not_needed', regenerated_candidate: null,
    retry_verdict: null, retry_failed_criteria: [],
    final_outcome: 'fell_back_to_canonical', fallback_reason: null, raw: {}, latency_ms: 0, error_text: null,
  }
  const call = async (key: string, system: string, user: string, maxTokens: number) => {
    const out = await chat({ system, user, maxTokens })
    rec.raw[key] = out.text
    rec.latency_ms += out.latency_ms
    return out.text
  }
  const fallback = (reason: string) => { rec.final_outcome = 'fell_back_to_canonical'; rec.fallback_reason = reason; return rec }

  let v1: VerifierVerdict | null
  try {
    v1 = parserFor(input.candidate)(await call('verify', PASS2_SYSTEM_PROMPT,
      buildPass2UserMessage(input.term, input.candidate, input.profile, knownVocabulary), PERSONALIZE_MAX_TOKENS_PASS2))
  } catch (e: any) {
    rec.error_text = `verify: ${e?.message ?? e}`
    return fallback('verify-error')
  }
  if (!v1) { rec.first_verdict = 'unparseable'; return fallback('verify-unparseable') }
  rec.first_verdict = v1.overall
  rec.first_failed_criteria = failed(v1)
  rec.first_claim_check_reasons = claimReasons(v1)
  if (v1.overall === 'pass') { rec.final_outcome = 'accepted_frozen_candidate'; return rec }
  if (PERSONALIZE_MAX_RETRIES < 1) { rec.regeneration = 'skipped'; return fallback('verify-fail-no-retry') }

  rec.regenerated = true
  let regen: ParsedRendering | null
  try {
    regen = parseRendering(await call('regenerate', pass3SystemPrompt(input.term.domain),
      buildPass3UserMessage(input.term, input.profile, input.candidate, buildFailedCriteriaBlock(v1)), PERSONALIZE_MAX_TOKENS_PASS3))
  } catch (e: any) {
    rec.regeneration = 'error'
    rec.error_text = `regenerate: ${e?.message ?? e}`
    return fallback('regenerate-error')
  }
  if (!regen) { rec.regeneration = 'unparseable'; return fallback('regenerate-unparseable') }
  rec.regeneration = 'parsed'
  rec.regenerated_candidate = regen

  let v2: VerifierVerdict | null
  try {
    v2 = parserFor(regen)(await call('reverify', PASS2_SYSTEM_PROMPT,
      buildPass2UserMessage(input.term, regen, input.profile, knownVocabulary), PERSONALIZE_MAX_TOKENS_PASS2))
  } catch (e: any) {
    rec.retry_verdict = 'error'
    rec.error_text = `reverify: ${e?.message ?? e}`
    return fallback('reverify-error')
  }
  if (!v2) { rec.retry_verdict = 'unparseable'; return fallback('reverify-unparseable') }
  rec.retry_verdict = v2.overall
  rec.retry_failed_criteria = failed(v2)
  if (v2.overall === 'pass') { rec.final_outcome = 'accepted_regenerated'; return rec }
  return fallback('reverify-fail')
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export function scoreArm(rows: { input: FrozenInput; arms: Record<Arm, ArmRecord> }[], arm: Arm) {
  const recs = rows.map(r => ({ input: r.input, rec: r.arms[arm] }))
  const by = (pred: (x: (typeof recs)[number]) => boolean) => recs.filter(pred).map(x => x.input.id)
  const incorrect = recs.filter(x => x.input.label === 'incorrect')
  const correct = recs.filter(x => x.input.label === 'correct')
  return {
    items: recs.length,
    labeled_incorrect: incorrect.length,
    labeled_correct: correct.length,
    unlabeled: recs.length - incorrect.length - correct.length,
    // Verdict on the frozen candidate itself. Unparseable or errored verdicts are
    // neither an acceptance nor a rejection, so they are listed separately.
    false_acceptances: by(x => x.input.label === 'incorrect' && x.rec.first_verdict === 'pass'),
    false_rejections: by(x => x.input.label === 'correct' && x.rec.first_verdict === 'fail'),
    true_rejections: by(x => x.input.label === 'incorrect' && x.rec.first_verdict === 'fail'),
    true_acceptances: by(x => x.input.label === 'correct' && x.rec.first_verdict === 'pass'),
    unparseable_or_error: by(x => x.rec.first_verdict === 'unparseable' || x.rec.first_verdict === 'error'),
    regenerations: by(x => x.rec.regenerated),
    accepted_after_regeneration: by(x => x.rec.final_outcome === 'accepted_regenerated'),
    fallbacks: by(x => x.rec.final_outcome === 'fell_back_to_canonical'),
    claim_check_triggered: by(x => x.rec.first_claim_check_reasons.length > 0),
  }
}

export function summarize(rows: { input: FrozenInput; arms: Record<Arm, ArmRecord> }[]) {
  const sets = [...new Set(rows.map(r => r.input.set))]
  const out: Record<string, any> = {}
  for (const set of sets) {
    const subset = rows.filter(r => r.input.set === set)
    out[set] = {
      original: scoreArm(subset, 'original'),
      candidate: scoreArm(subset, 'candidate'),
      first_verdict_disagreements: subset.filter(r => r.arms.original.first_verdict !== r.arms.candidate.first_verdict).map(r => r.input.id),
    }
  }
  return out
}

export async function runComparison(chat: ChatFn, inputs: FrozenInput[], knownVocabulary: string[], onRow?: (row: any) => void) {
  const rows: { input: FrozenInput; arms: Record<Arm, ArmRecord> }[] = []
  for (const input of inputs) {
    const arms = {} as Record<Arm, ArmRecord>
    for (const arm of ARMS) arms[arm] = await runArm(chat, arm, input, knownVocabulary)
    const row = { input, arms }
    rows.push(row)
    onRow?.(row)
  }
  return { rows, summary: summarize(rows) }
}

// ─── Ollama client ──────────────────────────────────────────────────────────

export interface OllamaOptions { baseUrl: string; model: string; temperature: number; seed: number; timeoutMs: number; fetchImpl?: typeof fetch }

export function ollamaChat(opts: OllamaOptions): ChatFn {
  const doFetch = opts.fetchImpl ?? fetch
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/api/chat`
  return async ({ system, user, maxTokens }) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
    const started = Date.now()
    try {
      const res = await doFetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          stream: false,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          options: { temperature: opts.temperature, seed: opts.seed, num_predict: maxTokens },
        }),
      })
      if (!res.ok) throw new Error(`http ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const body: any = await res.json()
      const text = body?.message?.content
      if (typeof text !== 'string') throw new Error('response has no message.content')
      return { text, latency_ms: Date.now() - started }
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new Error(`timeout after ${opts.timeoutMs} ms`)
      throw e
    } finally {
      clearTimeout(timer)
    }
  }
}
