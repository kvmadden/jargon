import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EvaluationReview } from './review'

describe('evaluation loading and recovery', () => {
  it('shows loading while artifacts are pending', () => {
    render(<EvaluationReview loader={() => new Promise(() => {})} />)
    expect(screen.getByRole('status')).toHaveTextContent('Reading evaluation artifacts')
  })
  it('recovers from artifact failure and explains empty expert agreements', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue([])
    render(<EvaluationReview loader={loader} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Evaluation could not load')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2))
    fireEvent.click(await screen.findByRole('button', { name: 'Agreements' }))
    expect(screen.getByText(/No expert-confirmed agreements/)).toBeInTheDocument()
  })
})

describe('expert labels and policy holds stay separate', () => {
  const row = (id: string, gold: 'incorrect' | 'correct' | 'not reviewed', held: boolean) => ({
    id, term: id, learner: 'hospital nurse', text: { long_definition: `${id} text`, why_it_matters: '', example_in_sentence: '' },
    verdict: 'pass', status: 'accepted_first_try', gold, note: '', held, reasons: held ? ['claim check: x'] : [],
  })
  it('shows an expert-correct held output as a false hold', async () => {
    const loader = vi.fn().mockResolvedValue([row('wrong', 'incorrect', true), row('right', 'correct', true), row('other', 'not reviewed', false)])
    render(<EvaluationReview loader={loader} />)
    expect(await screen.findByText('1 false holds, judged correct by the expert')).toBeInTheDocument()
    expect(screen.getByText(/Expert labels exist for 2 outputs, 1 incorrect and 1 correct/)).toBeInTheDocument()
    expect(screen.getByText('Kevin Madden, PharmD · 2026-11-01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Replay current policy/ }))
    expect(screen.getByText('False hold · expert judged correct')).toBeInTheDocument()
  })
})
