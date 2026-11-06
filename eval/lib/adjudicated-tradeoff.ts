// Pure computation of the historical verifier tradeoff once expert labels exist.
// Inputs are the unchanged policy replay and the expert label files. Expert
// labels and policy decisions stay in separate fields on every row.

export interface ReplayRow { id: string; after: string; reasons: string[] }
export interface ExpertFile { reviewer: string; run_ids?: string[]; label?: string; review_date?: string; labels?: { run_id: string; expert_label: string }[] }

export type ExpertLabel = 'incorrect' | 'correct' | 'not expert adjudicated'

export function expertLabels(files: ExpertFile[]) {
  const labels = new Map<string, { label: ExpertLabel; reviewer: string; date: string | null }>()
  for (const file of files) {
    const entries = file.labels ?? (file.run_ids ?? []).map(run_id => ({ run_id, expert_label: file.label ?? '' }))
    for (const { run_id, expert_label } of entries) {
      if (expert_label !== 'correct' && expert_label !== 'incorrect') throw new Error(`Unknown expert label for ${run_id}`)
      if (labels.has(run_id)) throw new Error(`Duplicate expert label for ${run_id}`)
      labels.set(run_id, { label: expert_label, reviewer: file.reviewer, date: file.review_date ?? null })
    }
  }
  return labels
}

export function adjudicatedTradeoff(rows: ReplayRow[], files: ExpertFile[]) {
  const labels = expertLabels(files)
  for (const id of labels.keys()) if (!rows.some(row => row.id === id)) throw new Error(`Expert label for unknown run ${id}`)
  const table = rows.map(row => {
    const expert = labels.get(row.id)
    const held = row.after === 'held by added policy'
    const label: ExpertLabel = expert?.label ?? 'not expert adjudicated'
    const outcome = label === 'incorrect' ? (held ? 'error caught' : 'error still accepted')
      : label === 'correct' ? (held ? 'false hold' : 'correct acceptance')
        : (held ? 'held, unlabeled' : 'accepted, unlabeled')
    return {
      id: row.id,
      expert_label: label,
      expert_reviewer: expert?.reviewer ?? null,
      expert_date: expert?.date ?? null,
      policy_decision: held ? 'hold' : 'unchanged acceptance',
      outcome,
    }
  })
  const count = (outcome: string) => table.filter(row => row.outcome === outcome).length
  const held = table.filter(row => row.policy_decision === 'hold')
  const summary = {
    accepted_outputs: table.length,
    expert_labeled: table.filter(row => row.expert_label !== 'not expert adjudicated').length,
    expert_incorrect: table.filter(row => row.expert_label === 'incorrect').length,
    expert_correct: table.filter(row => row.expert_label === 'correct').length,
    policy_holds: held.length,
    holds_unlabeled: count('held, unlabeled'),
    original_false_acceptances: table.filter(row => row.expert_label === 'incorrect').length,
    original_false_holds: 0,
    policy_errors_caught: count('error caught'),
    policy_false_acceptances: count('error still accepted'),
    policy_false_holds: count('false hold'),
    accepted_unlabeled: count('accepted, unlabeled'),
  }
  return { summary, rows: table }
}
