// Frozen before verifier implementation. Seed controls order, not claim selection.
// Author-written synthetic challenge cases. Labels are not expert gold labels.
import { writeFileSync } from 'node:fs'
const seed = 20261031
let state = seed
const cases = [
  ['access', false, 'in a hospital, nurses can only view charts on their assigned ward.'],
  ['access', false, 'the pharmacy system hides all patient profiles outside your store.'],
  ['artifact', false, 'a prescription label is digitally signed so alterations are always detected.'],
  ['credential', false, 'the pharmacy transfers records without sharing the patient login to the dispensing chart.'],
  ['contradiction', false, 'staging is the only environment connected to the real billing system.'],
  ['access', false, 'a nurse cannot open records from another hospital unit.'],
  ['artifact', false, 'a tamper-proof dispensing label guarantees the prescription has not changed.'],
  ['credential', false, 'patients lend their dispensing-record password to another pharmacy.'],
  ['technical', false, 'two passwords count as two independent authentication factors.'],
  ['technical', false, 'a JWT encrypts its payload so nobody can read the claims.'],
  ['technical', false, 'an idempotent request must produce a different result every time it is repeated.'],
  ['clinical', false, 'every medication interaction is harmless if the dose is low enough.'],
  ['plain', true, 'row-level security filters which records a signed-in user may retrieve.'],
  ['plain', true, 'a JWT signature helps the receiver detect an altered token.'],
  ['plain', true, 'OAuth can grant an application limited access without handing it your password.'],
  ['plain', true, 'production serves real users while staging is used for pre-release testing.'],
  ['context', true, 'the pharmacist reports an API error during a fictional stock check.'],
  ['context', true, 'a nurse uses an alert dashboard to notice when a service is down.'],
  ['negation', true, 'do not assume a hospital system only shows charts from your unit.'],
  ['negation', true, 'a prescription label is not a signed authentication token.'],
  ['hypothetical', true, 'in this fictional hospital demo, row-level security hides records outside the assigned unit.'],
  ['hypothetical', true, 'a toy pharmacy application gives each patient a login to a fictional chart.'],
  ['context', true, 'staging can use a sandbox insurance endpoint rather than real claims.'],
  ['context', true, 'patient portal credentials should not be shared with another application.'],
]
const items = cases.map(([family, correct, text], i) => ({
  id: `heldout-${String(i + 1).padStart(2, '0')}`,
  family,
  correct,
  candidate: {
    long_definition: text,
    why_it_matters: 'understanding the mechanism helps you ask clearer questions.',
    example_in_sentence: 'we discussed this concept in a fictional software meeting.',
  },
}))
for (let i = items.length - 1; i > 0; i--) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  const j = state % (i + 1)
  ;[items[i], items[j]] = [items[j], items[i]]
}
writeFileSync(new URL('./data/heldout-v1.json', import.meta.url), JSON.stringify({
  seed,
  provenance: 'Synthetic author-written contrast cases, frozen before implementation. Not independent domain-expert labels. No LLM baseline verdicts exist.',
  items,
}, null, 2) + '\n')
