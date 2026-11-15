import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from '../../stores/user-store';
import { FeedbackLauncher } from './feedback-launcher';

vi.mock('./capture', () => ({ captureFeedbackScreenshot: vi.fn(async () => null) }));
vi.mock('./data', () => ({
  flushFeedbackQueue: vi.fn(async () => 0),
  listProductFeedback: vi.fn(async () => []),
  submitProductFeedback: vi.fn(async () => undefined),
  subscribeToProductFeedback: vi.fn(() => ({ unsubscribe: vi.fn(async () => undefined) })),
}));

afterEach(() => {
  useUserStore.setState({ user: null, session: null, loading: false });
});

describe('FeedbackLauncher', () => {
  it('keeps the same hooks when the learner signs in after the first render', () => {
    // Regression: the desktop app bar listener once sat after the signed-out
    // early return, so signing in rendered more hooks and React threw.
    useUserStore.setState({ user: null, session: null, loading: false });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <FeedbackLauncher />
      </MemoryRouter>,
    );
    act(() => {
      useUserStore.setState({ user: { id: 'user-1' } as never, session: {} as never, loading: false });
    });
    expect(errors.mock.calls.join('\n')).not.toMatch(/more hooks|order of Hooks/i);
    errors.mockRestore();
  });

  it('floats nothing over the page: the app bar opens it', async () => {
    useUserStore.setState({ user: { id: 'user-1' } as never, session: {} as never, loading: false });
    render(
      <MemoryRouter>
        <FeedbackLauncher />
      </MemoryRouter>,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    await act(async () => {
      window.dispatchEvent(new Event('jargon:open-feedback'));
    });
    expect(await screen.findByRole('heading', { name: 'what happened?' })).toBeTruthy();
  });
});
