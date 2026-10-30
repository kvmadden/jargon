import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VersionPill } from './version-pill';

// VersionPill is gated to signed-in users (returns null pre-auth, mirroring
// CommandPaletteHost). Mock the user store so the pill renders for these tests.
vi.mock('../stores/user-store', () => ({
  useUserStore: (selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'test-user' } }),
}));

describe('VersionPill', () => {
  it('shows the current app iteration before expansion', () => {
    render(<VersionPill />);

    expect(screen.getByRole('button', { name: /iteration 47/i })).toBeInTheDocument();
    expect(screen.queryByText(/latest changes/i)).not.toBeInTheDocument();
  });

  it('opens the latest release notes when clicked', () => {
    render(<VersionPill />);

    fireEvent.click(screen.getByRole('button', { name: /iteration 47/i }));

    expect(screen.getByText('latest changes')).toBeInTheDocument();
    expect(screen.getByText('AI platform source map')).toBeInTheDocument();
    expect(screen.getByText('Excel, Power BI, and Fabric analytics')).toBeInTheDocument();
    expect(screen.getByText('platform operating-system vocabulary')).toBeInTheDocument();
    expect(screen.queryByText('named technology foundations')).not.toBeInTheDocument();
    expect(screen.queryByText('seed-wide practice fallback')).not.toBeInTheDocument();
    expect(screen.queryByText('seed-wide guide fallback')).not.toBeInTheDocument();
    expect(screen.queryByText('conversation guide deepening pass')).not.toBeInTheDocument();
    expect(screen.queryByText('OS/security completion pack')).not.toBeInTheDocument();
    expect(screen.queryByText('AI agent foundations pack')).not.toBeInTheDocument();
    expect(screen.queryByText('data/database foundations pack')).not.toBeInTheDocument();
  });

  it('closes from the panel button', () => {
    render(<VersionPill />);
    fireEvent.click(screen.getByRole('button', { name: /iteration 47/i }));

    fireEvent.click(screen.getByRole('button', { name: /close version notes/i }));

    expect(screen.queryByText('latest changes')).not.toBeInTheDocument();
  });
});
