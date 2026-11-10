import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TermQuickPeek } from './term-quick-peek';

// The sheet does not need a server response to test its dismissal control.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => new Promise(() => {}),
        }),
      }),
    }),
  },
}));

describe('TermQuickPeek close handle', () => {
  it('has a full-size tap target without enlarging the visual handle', () => {
    const onClose = vi.fn();
    render(<TermQuickPeek termId="example" onClose={onClose} onSeeFull={vi.fn()} />);

    const close = screen.getByRole('button', { name: 'close quick peek' });
    expect(close).toHaveClass('min-h-[44px]', 'w-12');

    const mark = close.querySelector('[aria-hidden="true"]');
    expect(mark).toHaveClass('h-1', 'w-12');

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
