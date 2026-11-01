import { useEffect, useRef, useState } from 'react'
import { colors } from 'design-tokens/design'
import { loadEvaluation, selectRows, type ReviewRow } from '../lib/evaluation-review'

export function EvaluationReview({ loader = loadEvaluation }: { loader?: typeof loadEvaluation }) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [selected, setSelected] = useState<string | null>(null)
  const [after, setAfter] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (selected) dialog.current?.showModal() }, [selected])
  useEffect(() => {
    let active = true
    setError(false)
    setRows(null)
    loader().then(value => { if (active) setRows(value) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [loader, attempt])
  const visible = rows ? selectRows(rows, filter, query) : []
  const misses = rows?.filter(row => row.gold === 'incorrect') ?? []
  const holds = rows?.filter(row => row.held) ?? []
  const accepted = rows?.filter(row => row.status.startsWith('accepted')).length ?? 0
  const detail = rows?.find(row => row.id === selected)
  return <div className="evaluation" data-theme={theme} style={{ '--accent': colors.semantic.purple[theme], '--bg': colors.surface.bg[theme], '--panel': colors.surface.card[theme], '--ink': colors.text.primary[theme], '--muted': colors.text.muted[theme], '--danger-bg': colors.semantic.danger[theme + 'Soft'], '--danger': colors.semantic.danger[theme], '--success': colors.semantic.success[theme + 'Strong'], '--success-bg': colors.semantic.success[theme + 'Soft'] } as React.CSSProperties}>
    <header className="topbar"><a href="/evaluation.html" className="brand">jargon<span> / evaluation lab</span></a><button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? '◐ Dark' : '◑ Light'}</button></header>
    <main>
      <div className="eyebrow"><span className="dot" /> OFFLINE EVALUATION / 2026.10.30</div>
      <section className="intro"><div><h1>Who checks the checker?</h1><p>A verifier passed these rewrites. Expert review found the blind spots.</p></div><span className="dataset">Synthetic learners<br /><strong>Real saved outputs</strong></span></section>
      {error ? <section role="alert" className="state"><h2>Evaluation could not load</h2><p>The saved artifacts are unavailable. Try loading them again.</p><button onClick={() => setAttempt(attempt + 1)}>Try again</button></section> : !rows ? <section role="status" className="state"><div className="loading" /><h2>Reading evaluation artifacts</h2><p>Loading saved outputs and replaying the library policy.</p></section> : <>
        <section className="stats" aria-label="Evaluation summary">
          <div><span>Completed runs</span><strong>{rows.length}<small> / 120 planned</small></strong><p>Budget-limited sample</p></div>
          <div><span>Accepted by pipeline</span><strong>{accepted}<small> / {rows.length}</small></strong><p>Includes two retries</p></div>
          <div className="miss-stat"><span>Confirmed misses</span><strong>{misses.length}<small> / {accepted} accepted</small></strong><p>Kevin Madden, PharmD</p></div>
          <div><span>Policy replay holds</span><strong>{holds.length}<small> / {accepted} accepted</small></strong><p>{holds.length - misses.length} additional, unadjudicated</p></div>
        </section>
        <section className="comparison"><div><span className="eyebrow">BEFORE → AFTER</span><h2>{after ? 'All five confirmed misses held' : 'Five errors accepted as correct'}</h2><p>{after ? 'Supplemental policy runs on the saved text. A hold asks for a rewrite, it does not prove an error.' : 'The original model accepted every expert-confirmed error. Compare with the current library policy.'}</p></div><button className="primary" aria-pressed={after} onClick={() => setAfter(!after)}>{after ? 'View original verdicts' : 'Replay current policy'} <span aria-hidden="true">↗</span></button></section>
        <section className="results" aria-label="Evaluation set">
          <div className="results-heading"><h2>Evaluation set <span>{visible.length}</span></h2><label className="search"><span className="sr-only">Search term or learner</span><input placeholder="Search term or learner…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
          <div className="filters" aria-label="Filter results">{[['all', 'All runs'], ['disagreements', 'Disagreements'], ['agreements', 'Agreements'], ['held', 'Policy holds']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
          <p className="table-note">{after ? 'Current policy replay' : 'Historical final verdict'} · Expert gold exists for five outputs only. Agreement filters compare expert labels with the historical verdict.</p>
          {visible.length === 0 ? <div className="state"><h3>No matching evaluations</h3><p>{filter === 'agreements' ? 'No expert-confirmed agreements are recorded. Unreviewed outputs are not counted as correct.' : 'Try another term, learner or filter.'}</p><button onClick={() => { setFilter('all'); setQuery('') }}>Show all runs</button></div> : <table><thead><tr><th>Term / learner</th><th>Personalized rewrite</th><th>{after ? 'Current policy' : 'Verifier verdict'}</th><th>Expert gold label</th></tr></thead><tbody>{visible.map(row => <tr key={row.id} className={row.gold === 'incorrect' ? 'confirmed' : ''}>
            <td data-label="Term / learner"><strong>{row.term}</strong><span className="learner">{row.learner}</span><button className="text-button" onClick={() => setSelected(selected === row.id ? null : row.id)} aria-expanded={selected === row.id} aria-controls="review-detail">{selected === row.id ? 'Close detail ↑' : 'Read full review ↗'}</button></td>
            <td data-label="Personalized rewrite"><p className="excerpt">{row.text?.long_definition ?? 'No parsed rendering available.'}</p>{row.gold === 'incorrect' && <div className="expert-note"><strong>PHARMD REVIEW · CONFIRMED INCORRECT</strong><p>{row.note}</p></div>}</td>
            <td data-label={after ? 'Current policy' : 'Verifier verdict'}><span className={`badge ${after && row.held ? 'hold' : row.verdict === 'pass' ? 'pass' : ''}`}>{after && row.held ? 'Hold for rewrite' : row.verdict === 'pass' ? 'Pass' : row.verdict === 'fail' ? 'Fail' : 'Unavailable'}</span><span className="cell-note">{after && row.held ? 'Supplemental claim check' : row.status === 'accepted_after_retry' ? 'After retry' : row.status === 'fell_back_to_canonical' ? 'Parse failure · canonical fallback' : 'Historical model'}</span></td>
            <td data-label="Expert gold label"><span className={`badge ${row.gold === 'incorrect' ? 'incorrect' : ''}`}>{row.gold === 'incorrect' ? 'Incorrect' : 'Not reviewed'}</span><span className="cell-note">{row.gold === 'incorrect' ? 'Kevin Madden, PharmD' : 'No expert correctness label'}</span></td>
          </tr>)}</tbody></table>}
        </section>
        {detail && <dialog ref={dialog} onClose={() => setSelected(null)} className="detail" id="review-detail" aria-label="Full review"><div className="results-heading"><h2>{detail.term} · {detail.learner}</h2><button onClick={() => dialog.current?.close()}>Close detail</button></div>{detail.text && <><h3>Definition</h3><p>{detail.text.long_definition}</p><h3>Why it matters</h3><p>{detail.text.why_it_matters}</p><h3>Example sentence</h3><p>{detail.text.example_in_sentence}</p></>}{detail.note && <><h3>{detail.gold === 'incorrect' ? 'Confirmed error · source review note' : 'AI review note · not expert gold'}</h3><p>{detail.note}</p></>}{detail.reasons.map(reason => <p key={reason} className="expert-note">{reason}</p>)}</dialog>}
        <footer><strong>Read the limits with the results.</strong><p>One run, no repeats. Only the five flagged errors received expert confirmation. The remaining outputs have no expert correctness label. Replay holds are computed by the same claim check used in the Edge Function. No new model verdicts or regenerated text.</p><p>Sources: eval/results/2026-10-30.jsonl · eval/data/expert-confirmed-misses.json · eval/results/2026-10-30-review.json</p><p>Review notes were written by an AI model. Kevin’s confirmation of the five errors is recorded separately. The upgrade is a branch dependency pending independent review.</p></footer>
      </>}
    </main>
  </div>
}
