import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from './command-palette';
import type { Command } from '../lib/command-palette';

const COMMANDS: Command[] = [
  { id: '/profile', kind: 'route', name: 'profile', target: '/profile' },
];

function openPalette(onClose = vi.fn(), onSelectAction = vi.fn()) {
  render(
    <MemoryRouter>
      <CommandPalette
        open
        onClose={onClose}
        commands={COMMANDS}
        onSelectAction={onSelectAction}
      />
    </MemoryRouter>,
  );
  return { onClose, onSelectAction };
}

describe('CommandPalette keyboard activation', () => {
  beforeEach(() => {
    // The palette focuses the search field on the next animation frame.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not select a highlighted command when Enter is pressed on mobile Close', () => {
    const { onClose, onSelectAction } = openPalette();
    const close = screen.getByRole('button', { name: 'close command palette' });
    close.focus();

    // This event bubbles to the dialog. It previously selected /profile
    // before the Close button could receive its native keyboard click.
    fireEvent.keyDown(close, { key: 'Enter' });
    expect(onSelectAction).not.toHaveBeenCalled();

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectAction).not.toHaveBeenCalled();
  });

  it('still selects the highlighted result with Enter in the search field', () => {
    const { onClose, onSelectAction } = openPalette();
    const input = screen.getByRole('combobox', { name: 'search commands' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelectAction).toHaveBeenCalledExactlyOnceWith('/profile');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only once on Escape through the shared modal focus handler', () => {
    const { onClose, onSelectAction } = openPalette();
    const input = screen.getByRole('combobox', { name: 'search commands' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectAction).not.toHaveBeenCalled();
  });

  it('does not activate a stale result after a search produces no matches', () => {
    const { onSelectAction } = openPalette();
    const input = screen.getByRole('combobox', { name: 'search commands' });
    fireEvent.change(input, { target: { value: 'not-a-jargon-command' } });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectAction).not.toHaveBeenCalled();
  });
});
