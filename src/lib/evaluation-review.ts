export type ReviewRow = {
  id: string
  term: string
  learner: string
  text: { long_definition: string, why_it_matters: string, example_in_sentence: string } | null
  verdict: string
  status: string
  gold: 'incorrect' | 'correct' | 'not reviewed'
  note: string
  held: boolean
  reasons: string[]
}
export async function loadEvaluation(): Promise<ReviewRow[]> {
  const [{ default: raw }, { default: expert }, { default: adjudication }, { default: review }, { checkCandidateClaims }] = await Promise.all([
    import('../../eval/results/2026-10-30.jsonl?raw'),
    import('../../eval/data/expert-confirmed-misses.json'),
    import('../../eval/data/expert-adjudication-2026-11-01.json'),
    import('../../eval/results/2026-10-30-review.json'),
    import('../../supabase/functions/personalize-term/claim-check'),
  ])
  const notes = review.notes as Record<string, { call: string, note: string }>
  // Expert labels only. The policy decision is computed separately below.
  const judgedCorrect = new Set(adjudication.labels.filter(label => label.expert_label === 'correct').map(label => label.run_id))
  return raw.trim().split('\n').map(line => {
    const run = JSON.parse(line)
    const reasons = run.final_text && run.final_status !== 'fell_back_to_canonical' ? checkCandidateClaims(run.final_text) : []
    return {
      id: run.run_id,
      term: run.term,
      learner: run.profile_label,
      text: run.final_text,
      status: run.final_status,
      verdict: (run.retry_verdict ?? run.pass1_verdict)?.overall ?? 'unavailable',
      gold: expert.run_ids.includes(run.run_id) ? 'incorrect' : judgedCorrect.has(run.run_id) ? 'correct' : 'not reviewed',
      note: notes[`${run.run_id}::final`]?.note ?? '',
      held: reasons.length > 0,
      reasons,
    }
  })
}
export function selectRows(rows: ReviewRow[], filter: string, query: string) {
  return rows.filter(row => {
    const matches = `${row.term} ${row.learner}`.toLowerCase().includes(query.toLowerCase())
    if (!matches) return false
    if (filter === 'disagreements') return (row.gold === 'incorrect' && row.verdict === 'pass') || (row.gold === 'correct' && row.verdict === 'fail')
    if (filter === 'agreements') return (row.gold === 'incorrect' && row.verdict === 'fail') || (row.gold === 'correct' && row.verdict === 'pass')
    if (filter === 'held') return row.held
    return true
  }).sort((a, b) => rank(b) - rank(a))
}
function rank(row: ReviewRow) {
  return row.gold === 'incorrect' ? 2 : row.gold === 'correct' ? 1 : 0
}
