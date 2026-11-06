// No network, credentials or model calls. Joins expert labels to the unchanged
// policy replay and writes a new dated file. claim-check-replay-v1.json is read
// only and never rewritten here.
import { readFileSync, writeFileSync } from 'node:fs'
import { adjudicatedTradeoff } from './lib/adjudicated-tradeoff.ts'
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const replay = read('./results/claim-check-replay-v1.json')
const files = [read('./data/expert-confirmed-misses.json'), read('./data/expert-adjudication-2026-11-01.json')]
const { summary, rows } = adjudicatedTradeoff(replay.historical, files)
if (summary.accepted_outputs !== 78 || summary.policy_holds !== 12) throw new Error('Replay denominators changed')
const result = {
  method: 'Expert labels joined to the unchanged deterministic policy replay. No new model verdicts or regeneration. Expert labels and policy decisions are separate fields.',
  replay_source: 'eval/results/claim-check-replay-v1.json',
  replay_historical_sha256: replay.historical_sha256,
  label_sources: ['eval/data/expert-confirmed-misses.json', 'eval/data/expert-adjudication-2026-11-01.json'],
  limits: [
    'Expert labels cover only the 12 held outputs. The 66 unchanged acceptances are not expert adjudicated, so errors among them are unknown.',
    'A hold triggers one regeneration and then canonical fallback. Whether regeneration would have kept useful personalization for the seven false holds is not measured.',
    'One historical run of 79 items. Counts, not rates, are the evidence.',
  ],
  summary,
  rows,
}
writeFileSync(new URL('./results/claim-check-adjudicated-2026-11-01.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
