import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitReport } from '../lib/reports';
import { ReportButton } from './report-button';

vi.mock('../lib/reports', () => ({ submitReport: vi.fn() }));

vi.mock('../stores/user-store', () => ({
  useUserStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'learner-1' } }),
}));

vi.mock('./toast', () => ({
  useToastStore: (selector: (state: { push: () => void }) => unknown) =>
    selector({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.mocked(submitReport).mockReset();
});

describe('ReportButton', () => {
  it('keeps the reason choices open after a failed save, then lets the learner retry', async () => {
    vi.mocked(submitReport)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);

    render(<ReportButton termId="term-1" quizMode="mc" />);
    fireEvent.click(screen.getByRole('button', { name: 'report this term' }));
    fireEvent.click(screen.getByRole('button', { name: 'unclear' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('couldn’t flag. try again');
    });
    expect(screen.getByRole('dialog', { name: 'report this term' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'unclear' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'unclear' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'report this term' })).not.toBeInTheDocument();
    });

    expect(submitReport).toHaveBeenCalledTimes(2);
    expect(submitReport).toHaveBeenNthCalledWith(1, {
      userId: 'learner-1', termId: 'term-1', reason: 'unclear', quizMode: 'mc',
    });
    expect(submitReport).toHaveBeenNthCalledWith(2, {
      userId: 'learner-1', termId: 'term-1', reason: 'unclear', quizMode: 'mc',
    });
  });

  it('closes immediately after a successful report, without an error message', async () => {
    vi.mocked(submitReport).mockResolvedValueOnce(undefined);

    render(<ReportButton termId="term-2" quizMode={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'report this term' }));
    fireEvent.click(screen.getByRole('button', { name: 'wrong' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'report this term' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(submitReport).toHaveBeenCalledWith({
      userId: 'learner-1', termId: 'term-2', reason: 'wrong', quizMode: null,
    });
  });
});
