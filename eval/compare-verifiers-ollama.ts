// Free local comparison of the unchanged original verifier and the candidate
// verifier on identical frozen inputs, through an Ollama endpoint.
//
//   ollama pull llama3.2:3b
//   node eval/compare-verifiers-ollama.ts          # Node 23.6+ (or 22.18+)
//
// Options (env):
//   OLLAMA_BASE_URL=http://127.0.0.1:11434
//   OLLAMA_MODEL=llama3.2:3b
//   OLLAMA_TEMPERATURE=0       OLLAMA_SEED=20261101
//   OLLAMA_TIMEOUT_MS=120000   local models are slower than the shipped 30 s limit
//   COMPARE_SETS=heldout,historical
//   COMPARE_LIMIT=N            first N frozen inputs only (smoke test)
//   COMPARE_TAG=YYYY-MM-DD     results file tag (default: today, UTC)
//
// The model is a LOCAL SUBSTITUTE, not the hosted model the verifier ships
// with (PERSONALIZE_MODEL in prompts.ts). Results are indicative only. They
// show how the two verifiers differ when the same local model reads the same
// frozen inputs. They do not reproduce production verdicts.
//
// No API key is read. No paid endpoint is called. The script refuses to
// overwrite an existing results file, so earlier numbers are kept.

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { buildFrozenInputs, inputsDigest, ollamaChat, runComparison } from './lib/verifier-comparison.ts'
import { PERSONALIZE_MODEL, PERSONALIZE_TIMEOUT_MS } from '../supabase/functions/personalize-term/prompts.ts'

const HELDOUT_SHA256 = '7f10a0a5a2341d0146950724f038a26c20facea757534a6d166355fc85a6f95b'
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

export function config(env: NodeJS.ProcessEnv) {
  const sets = (env.COMPARE_SETS ?? 'heldout,historical').split(',').map(s => s.trim()).filter(Boolean)
  for (const s of sets) if (s !== 'heldout' && s !== 'historical') throw new Error(`Unknown set ${s}`)
  return {
    baseUrl: env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    model: env.OLLAMA_MODEL ?? 'llama3.2:3b',
    temperature: Number(env.OLLAMA_TEMPERATURE ?? '0'),
    seed: Number(env.OLLAMA_SEED ?? '20261101'),
    timeoutMs: Number(env.OLLAMA_TIMEOUT_MS ?? '120000'),
    sets: sets as Array<'heldout' | 'historical'>,
    limit: env.COMPARE_LIMIT ? Number(env.COMPARE_LIMIT) : Infinity,
    tag: env.COMPARE_TAG ?? new Date().toISOString().slice(0, 10),
  }
}

export async function main(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof fetch, resultsDir = new URL('./results/', import.meta.url)) {
  const cfg = config(env)
  const profilesFile = JSON.parse(read('./data/profiles.json'))
  const inputs = buildFrozenInputs({
    heldoutRaw: read('./data/heldout-v1.json'),
    heldoutSha256: HELDOUT_SHA256,
    historyRaw: read('./results/2026-10-30.jsonl'),
    contexts: JSON.parse(read('./data/verifier-comparison-contexts-v1.json')),
    terms: JSON.parse(read('./data/terms.json')).terms,
    profiles: profilesFile.profiles,
    expertFiles: [JSON.parse(read('./data/expert-confirmed-misses.json')), JSON.parse(read('./data/expert-adjudication-2026-11-01.json'))],
  }, cfg.sets).slice(0, cfg.limit)

  const slug = cfg.model.replace(/[^a-z0-9.]+/gi, '-')
  const base = `${cfg.tag}-ollama-verifier-comparison-${slug}`
  mkdirSync(resultsDir, { recursive: true })
  const jsonlPath = new URL(`${base}.jsonl`, resultsDir)
  const jsonPath = new URL(`${base}.json`, resultsDir)
  if (existsSync(jsonlPath) || existsSync(jsonPath)) throw new Error(`Results for ${base} already exist. Set COMPARE_TAG to keep both runs.`)

  const chat = ollamaChat({ baseUrl: cfg.baseUrl, model: cfg.model, temperature: cfg.temperature, seed: cfg.seed, timeoutMs: cfg.timeoutMs, fetchImpl })
  console.log(`model=${cfg.model} base=${cfg.baseUrl} inputs=${inputs.length} sets=${cfg.sets.join(',')}`)
  const started = new Date().toISOString()
  const { rows, summary } = await runComparison(chat, inputs, profilesFile.known_vocabulary, row => {
    appendFileSync(jsonlPath, JSON.stringify(row) + '\n')
    console.log(`${row.input.id.padEnd(36)} ${row.input.label.padEnd(9)} original=${row.arms.original.first_verdict}/${row.arms.original.final_outcome} candidate=${row.arms.candidate.first_verdict}/${row.arms.candidate.final_outcome}`)
  })
  const result = {
    status: 'indicative only: local substitute model, not the shipped hosted verifier model',
    substitute_model: cfg.model,
    shipped_model_not_used: PERSONALIZE_MODEL,
    endpoint: cfg.baseUrl,
    settings: { temperature: cfg.temperature, seed: cfg.seed, timeout_ms: cfg.timeoutMs, shipped_timeout_ms: PERSONALIZE_TIMEOUT_MS },
    arms: {
      original: 'Shipped Pass 2 prompt with parseVerdict only, as before the claim check',
      candidate: 'Same prompt and model call with parseVerdict plus the deterministic claim check',
    },
    frozen_inputs: { count: inputs.length, sha256: inputsDigest(inputs), heldout_sha256: HELDOUT_SHA256, contexts: 'eval/data/verifier-comparison-contexts-v1.json' },
    definitions: {
      false_acceptance: 'labeled incorrect and the first verdict on the frozen candidate is pass',
      false_rejection: 'labeled correct and the first verdict on the frozen candidate is fail',
      regenerated_text: 'new model text, unlabeled, so its correctness is unknown',
    },
    started_at: started,
    finished_at: new Date().toISOString(),
    summary,
    rows_file: jsonlPath.pathname.split('/').pop(),
  }
  writeFileSync(jsonPath, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(summary, null, 2))
  return { result, rows }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error('fatal:', e?.message ?? e); process.exit(1) })
}
