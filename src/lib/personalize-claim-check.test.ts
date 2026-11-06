import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyClaimCheck, checkCandidateClaims } from '../../supabase/functions/personalize-term/claim-check'
import { buildFailedCriteriaBlock } from '../../supabase/functions/personalize-term/prompts'

const rows = readFileSync(resolve(__dirname, '../../eval/results/2026-10-30.jsonl'), 'utf8')
  .trim().split('\n').map(line => JSON.parse(line))
const misses = ['bi-rls::nurse', 'cloud-environment::pharmacist', 'bi-rls::pharmacist', 'sys-jwt::pharmacist', 'sec-oauth::pharmacist']

// Development examples are the five known failures, never held-out cases.
describe('supplemental candidate claim check', () => {
  it.each(misses)('rejects the saved expert-confirmed miss %s even when the model passes', id => {
    const row = rows.find(row => row.run_id === id)!
    const candidate = row.final_text
    expect(candidate, 'original accepted rendering exists').toBeTruthy()
    const original = row.retry_verdict ?? row.pass1_verdict
    expect(original.overall).toBe('pass')
    const result = applyClaimCheck(candidate, original)
    expect(result.overall, id).toBe('fail')
    expect(buildFailedCriteriaBlock(result)).toContain('claim check')
    expect(original.overall, 'does not mutate historical model verdict').toBe('pass')
  })

  it('preserves an ordinary explanation and the model rejection', () => {
    const candidate = { long_definition: 'a signed token carries claims.', why_it_matters: 'check the signature.', example_in_sentence: 'we checked the token.' }
    expect(checkCandidateClaims(candidate)).toEqual([])
    const verdict = rows[0].pass1_verdict
    expect(applyClaimCheck(candidate, verdict)).toBe(verdict)
    expect(applyClaimCheck(candidate, { ...verdict, overall: 'fail' }).overall).toBe('fail')
  })

  it('checks all fields so a risky example cannot hide behind a correct definition', () => {
    const candidate = { long_definition: 'an environment runs software.', why_it_matters: 'separate testing from real use.', example_in_sentence: 'staging is the only place connected to the real claims system.' }
    expect(checkCandidateClaims(candidate).length).toBeGreaterThan(0)
  })
})

describe('shared verifier parser', () => {
  it('applies the check to first and retry candidates without masking parse failures', async () => {
    const { claimCheckedParser } = await import('../../supabase/functions/personalize-term/claim-check')
    const { parseVerdict } = await import('../../supabase/functions/personalize-term/prompts')
    const row = rows.find(row => row.run_id === 'bi-rls::nurse')!
    const parse = claimCheckedParser(row.final_text, parseVerdict)
    expect(parse(JSON.stringify(row.pass1_verdict))?.overall).toBe('fail')
    expect(parse('not JSON')).toBeNull()
    const corrected = { long_definition: 'RLS filters rows based on the viewer.', why_it_matters: 'one report can serve different viewers.', example_in_sentence: 'we enabled RLS for the report.' }
    expect(claimCheckedParser(corrected, parseVerdict)(JSON.stringify(row.pass1_verdict))?.overall).toBe('pass')
  })
})
