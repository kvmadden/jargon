import { act, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPaletteHost } from './command-palette-host';
import { useUserStore } from '../stores/user-store';

// The host lazy-loads the dictionary the first time the palette opens.
// We only care about the hardcoded ROUTES here (the lesson-questions entry),
// so stub the term fetch to an empty list — the routes render regardless.
vi.mock('../lib/data', () => ({
  fetchAllTerms: vi.fn().mockResolvedValue([]),
}));

function openPalette() {
  // Main's host opens on Cmd+K / Ctrl+K (capture-phase window keydown).
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  });
}

describe('CommandPaletteHost', () => {
  beforeEach(() => {
    useUserStore.setState({
      user: { id: 'user-1', email: 'kevin@example.com' } as User,
      session: null,
      loading: false,
    });
  });

  afterEach(() => {
    useUserStore.setState({ user: null, session: null, loading: false });
  });

  it('registers the lesson-questions route in the command palette', async () => {
    render(
      <MemoryRouter>
        <CommandPaletteHost />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog', { name: /command palette/i })).not.toBeInTheDocument();

    openPalette();

    // findByText flushes the host's lazy fetchAllTerms() microtask inside
    // act(), so opening the palette doesn't leak a "not wrapped in act" warning.
    expect(await screen.findByText('lesson questions')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
    expect(screen.getByText('saved lesson questions and answers')).toBeInTheDocument();
    expect(screen.getByText('feedback loop')).toBeInTheDocument();
    expect(screen.getByText('your notes, replies, check-ins, and shipped changes')).toBeInTheDocument();
    expect(screen.getByText('agentic era course')).toBeInTheDocument();
  });

  it('registers the concept atlas route in the command palette', async () => {
    render(
      <MemoryRouter>
        <CommandPaletteHost />
      </MemoryRouter>,
    );

    openPalette();

    expect(await screen.findByText('concept atlas')).toBeInTheDocument();
  });

  it('opens the palette from the app bar search button, with nothing floating over the page', async () => {
    render(
      <MemoryRouter>
        <CommandPaletteHost />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /open command palette/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /command palette/i })).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('jargon:open-search'));
    });

    expect(await screen.findByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
  });

  it('suppresses the palette entirely when signed out', () => {
    useUserStore.setState({ user: null, session: null, loading: false });

    const { container } = render(
      <MemoryRouter>
        <CommandPaletteHost />
      </MemoryRouter>,
    );

    openPalette();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('lesson questions')).not.toBeInTheDocument();
  });
});
