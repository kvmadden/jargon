import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { adjudicatedTradeoff, expertLabels } from '../../eval/lib/adjudicated-tradeoff'

const read = (path: string) => JSON.parse(readFileSync(resolve(__dirname, '../../eval', path), 'utf8'))
const replay = read('results/claim-check-replay-v1.json')
const misses = read('data/expert-confirmed-misses.json')
const adjudication = read('data/expert-adjudication-2026-11-01.json')
const seven = ['excel-pivot-table::nurse', 'sec-mfa::pharmacist', 'sec-mfa::nurse', 'fabric-data-pipeline::pharmacist', 'sec-oauth::nurse', 'sec-rbac::nurse', 'data-join::nurse']

describe('expert adjudication of the seven additional holds', () => {
  it('records reviewer, date and a correct label for exactly the seven pending IDs', () => {
    expect(adjudication.reviewer).toBe('Kevin Madden, PharmD')
    expect(adjudication.review_date).toBe('2026-11-01')
    expect(adjudication.labels.map((l: any) => l.run_id).sort()).toEqual([...seven].sort())
    expect(new Set(adjudication.labels.map((l: any) => l.expert_label))).toEqual(new Set(['correct']))
  })

  it('reports all seven as false holds and keeps the policy decision separate', () => {
    const { summary, rows } = adjudicatedTradeoff(replay.historical, [misses, adjudication])
    expect(summary).toMatchObject({
      accepted_outputs: 78, policy_holds: 12, holds_unlabeled: 0,
      policy_errors_caught: 5, policy_false_acceptances: 0, policy_false_holds: 7,
      original_false_acceptances: 5, accepted_unlabeled: 66,
    })
    for (const id of seven) {
      const row = rows.find(r => r.id === id)!
      expect(row).toMatchObject({ expert_label: 'correct', policy_decision: 'hold', outcome: 'false hold', expert_date: '2026-11-01' })
    }
  })

  it('never infers labels for unadjudicated outputs', () => {
    const { rows } = adjudicatedTradeoff(replay.historical, [misses, adjudication])
    const unlabeled = rows.filter(r => r.expert_label === 'not expert adjudicated')
    expect(unlabeled).toHaveLength(66)
    expect(unlabeled.every(r => r.expert_reviewer === null && r.outcome === 'accepted, unlabeled')).toBe(true)
  })

  it('rejects duplicate, unknown or malformed labels', () => {
    expect(() => expertLabels([misses, misses])).toThrow(/Duplicate/)
    expect(() => expertLabels([{ reviewer: 'x', labels: [{ run_id: 'a', expert_label: 'maybe' }] }])).toThrow(/Unknown/)
    expect(() => adjudicatedTradeoff(replay.historical, [{ reviewer: 'x', labels: [{ run_id: 'nope', expert_label: 'correct' }] }])).toThrow(/unknown run/)
  })

  it('matches the committed adjudicated results file', () => {
    const committed = read('results/claim-check-adjudicated-2026-11-01.json')
    expect(committed.summary).toEqual(adjudicatedTradeoff(replay.historical, [misses, adjudication]).summary)
  })
})
