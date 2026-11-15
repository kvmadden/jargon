// No network, credentials or model calls. Replays the added policy only.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { checkCandidateClaims } from '../supabase/functions/personalize-term/claim-check.ts'
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
const historyRaw = read('./results/2026-10-30.jsonl')
const heldoutRaw = read('./data/heldout-v1.json')
const expectedHash = '7f10a0a5a2341d0146950724f038a26c20facea757534a6d166355fc85a6f95b'
if (digest(heldoutRaw) !== expectedHash) throw new Error('Frozen held-out set changed')
const knownWrong = new Set<string>(JSON.parse(read('./data/expert-confirmed-misses.json')).run_ids)
const rows = historyRaw.trim().split('\n').map(line => JSON.parse(line))
const historical = rows.filter(row => row.final_status !== 'fell_back_to_canonical').map(row => ({
  id: row.run_id,
  label: knownWrong.has(row.run_id) ? 'expert-confirmed wrong' : 'not expert adjudicated',
  before: 'accepted by historical LLM pipeline',
  after: checkCandidateClaims(row.final_text).length ? 'held by added policy' : 'unchanged acceptance',
  reasons: checkCandidateClaims(row.final_text),
  candidate: row.final_text,
}))
if (historical.length !== 78 || historical.filter(row => knownWrong.has(row.id)).length !== 5) {
  throw new Error('Historical denominator or known-miss IDs changed')
}
const heldout = JSON.parse(heldoutRaw).items.map((item: any) => ({
  ...item,
  before: 'no LLM baseline measured',
  after: checkCandidateClaims(item.candidate).length ? 'hold' : 'pass',
  reasons: checkCandidateClaims(item.candidate),
}))
const result = {
  method: 'Deterministic supplemental-policy replay. No new LLM verdicts or regeneration. Historical model decisions stay fixed. Held-out before/after is policy absent versus present, not an LLM comparison.',
  historical_sha256: digest(historyRaw),
  heldout_sha256: digest(heldoutRaw),
  historical_summary: {
    accepted_before: historical.length,
    expert_confirmed_misses_before: 5,
    expert_confirmed_misses_remaining: historical.filter(row => knownWrong.has(row.id) && row.after === 'unchanged acceptance').length,
    additional_unadjudicated_holds: historical.filter(row => !knownWrong.has(row.id) && row.after === 'held by added policy').length,
    confirmed_false_rejections: null,
  },
  heldout_summary: {
    count: heldout.length,
    incorrect: heldout.filter((row: any) => !row.correct).length,
    correct: heldout.filter((row: any) => row.correct).length,
    policy_absent_missed_errors: heldout.filter((row: any) => !row.correct).length,
    policy_present_missed_errors: heldout.filter((row: any) => !row.correct && row.after === 'pass').length,
    policy_absent_false_rejections: 0,
    policy_present_false_rejections: heldout.filter((row: any) => row.correct && row.after === 'hold').length,
    label_source: 'Synthetic author labels, not expert adjudication',
    llm_before: null,
    llm_after: null,
  },
  historical,
  heldout,
}
const output = new URL('./results/claim-check-replay-v1.json', import.meta.url)
writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ historical: result.historical_summary, heldout: result.heldout_summary }, null, 2))
