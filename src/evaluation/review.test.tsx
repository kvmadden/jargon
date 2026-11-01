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
