import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecentSpottedScans } from './spotted';

describe('RecentSpottedScans', () => {
  it('renders recent scan summaries in newest-first order', () => {
    render(
      <RecentSpottedScans
        scans={[
          {
            id: 'scan-2',
            scan_at: '2026-05-24T01:00:00Z',
            total_words: 18,
            mastered_count: 2,
            learning_count: 1,
            unseen_count: 5,
            term_ids: ['commit', 'branch', 'commit'],
          },
          {
            id: 'scan-1',
            scan_at: '2026-05-23T01:00:00Z',
            total_words: 9,
            mastered_count: 1,
            learning_count: 0,
            unseen_count: 2,
            term_ids: ['api'],
          },
        ]}
      />,
    );

    expect(screen.getByText('recent scans')).toBeInTheDocument();
    expect(screen.getByText('2 recognized · 2 mastered · 5 new')).toBeInTheDocument();
    expect(screen.getByText('1 recognized · 1 mastered · 2 new')).toBeInTheDocument();
    expect(screen.getByText('2026-05-24')).toBeInTheDocument();
    expect(screen.getByText('2026-05-23')).toBeInTheDocument();
  });

  it('renders nothing when there are no scans yet', () => {
    const { container } = render(<RecentSpottedScans scans={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('does not warn if a mocked recent list repeats an id', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(
        <RecentSpottedScans
          scans={[
            {
              id: 'scan-dup',
              scan_at: '2026-05-24T01:00:00Z',
              total_words: 18,
              mastered_count: 2,
              learning_count: 1,
              unseen_count: 5,
              term_ids: ['commit'],
            },
            {
              id: 'scan-dup',
              scan_at: '2026-05-24T01:01:00Z',
              total_words: 10,
              mastered_count: 1,
              learning_count: 1,
              unseen_count: 3,
              term_ids: ['branch'],
            },
          ]}
        />,
      );

      const duplicateKeyWarnings = errorSpy.mock.calls
        .flat()
        .filter((value) =>
          String(value).includes('Encountered two children with the same key'),
        );
      expect(duplicateKeyWarnings).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
