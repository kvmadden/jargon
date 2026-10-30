// Smoke tests for <ReportAnalogyButton>.
//
// Covers the two visible states + the submit happy path. The full test
// matrix (network failure → error toast, char-limit truncation, autofocus)
// would belong in a dedicated qa-tester pass; this file is the
// react-builder smoke set.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportAnalogyButton } from './report-analogy-button';

// Mock the data-layer wrapper. The component should call it but never
// reach actual network in tests.
vi.mock('../lib/data', () => ({
  reportAnalogyIssue: vi.fn(),
}));

// Mock the toast store — we don't need to assert the toast content in
// smoke tests, just that it's not throwing on push.
vi.mock('./toast', () => ({
  useToastStore: (selector: (s: { push: (m: string, v?: string) => void }) => unknown) =>
    selector({ push: vi.fn() }),
}));

const SAMPLE_RENDERING = {
  long_definition: 'rebase = re-running the tide cycle in a salt marsh.',
  why_it_matters: 'helps you keep history clean.',
  example_in_sentence: 'i rebased onto main before merging.',
};

beforeEach(async () => {
  const mod = await import('../lib/data');
  vi.mocked(mod.reportAnalogyIssue).mockReset();
});

describe('<ReportAnalogyButton>', () => {
  it('renders the collapsed link state by default', () => {
    render(<ReportAnalogyButton termId="rebase" rendering={SAMPLE_RENDERING} />);
    const trigger = screen.getByRole('button', { name: /report this analogy/i });
    expect(trigger).toBeInTheDocument();
    // Lowercase brand voice — never "REPORT INACCURACY" or similar shouting.
    expect(trigger.textContent).toMatch(/this analogy doesn't land/i);
    // No textarea visible until expanded.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('expands into the inline form when the link is tapped', () => {
    render(<ReportAnalogyButton termId="rebase" rendering={SAMPLE_RENDERING} />);
    fireEvent.click(screen.getByRole('button', { name: /report this analogy/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('disables submit while complaint is empty', () => {
    render(<ReportAnalogyButton termId="rebase" rendering={SAMPLE_RENDERING} />);
    fireEvent.click(screen.getByRole('button', { name: /report this analogy/i }));
    const submit = screen.getByRole('button', { name: /submit/i });
    expect(submit).toBeDisabled();
  });

  it('calls reportAnalogyIssue with the rendering snapshot on submit', async () => {
    const mod = await import('../lib/data');
    vi.mocked(mod.reportAnalogyIssue).mockResolvedValueOnce(true);

    render(<ReportAnalogyButton termId="rebase" rendering={SAMPLE_RENDERING} />);
    fireEvent.click(screen.getByRole('button', { name: /report this analogy/i }));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, {
      target: { value: 'tides do not evaporate the water — they renew it.' },
    });

    const submit = screen.getByRole('button', { name: /submit/i });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mod.reportAnalogyIssue).toHaveBeenCalledWith({
        term_id: 'rebase',
        rendering: SAMPLE_RENDERING,
        complaint: 'tides do not evaporate the water — they renew it.',
      });
    });
  });

  it('caps the complaint at 500 chars at the input layer', () => {
    render(<ReportAnalogyButton termId="rebase" rendering={SAMPLE_RENDERING} />);
    fireEvent.click(screen.getByRole('button', { name: /report this analogy/i }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'x'.repeat(600) } });
    // The component slices to 500 in its onChange handler; the textarea
    // also has maxLength=500 as a second guard.
    expect(textarea.value.length).toBeLessThanOrEqual(500);
  });
});
