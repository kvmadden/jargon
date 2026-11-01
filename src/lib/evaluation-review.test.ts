import { describe, expect, it } from 'vitest'
import { loadEvaluation, selectRows } from './evaluation-review'

describe('evaluation review from real artifacts', () => {
  it('retains all runs and never invents expert agreement', async () => {
    const rows = await loadEvaluation()
    expect(rows).toHaveLength(79)
    expect(rows.filter(row => row.gold === 'incorrect')).toHaveLength(5)
    expect(rows.filter(row => row.gold === 'correct')).toHaveLength(7)
    expect(rows.filter(row => row.gold === 'not reviewed')).toHaveLength(67)
    expect(selectRows(rows, 'disagreements', '')).toHaveLength(5)
    // The historical verifier accepted the seven outputs the expert judged correct.
    expect(selectRows(rows, 'agreements', '').map(row => row.gold)).toEqual(Array(7).fill('correct'))
  })
  it('replays the runtime policy and retains pharmacist notes', async () => {
    const rows = await loadEvaluation()
    const misses = rows.filter(row => row.gold === 'incorrect')
    expect(misses.every(row => row.held && row.note.length > 0)).toBe(true)
    expect(rows.filter(row => row.held)).toHaveLength(12)
    expect(rows.filter(row => row.held && row.gold === 'correct')).toHaveLength(7)
    expect(rows.filter(row => row.held && row.gold === 'not reviewed')).toHaveLength(0)
    expect(selectRows(rows, 'all', 'JWT')).toHaveLength(3)
    expect(rows.find(row => row.status === 'fell_back_to_canonical')?.verdict).toBe('unavailable')
  })
})
