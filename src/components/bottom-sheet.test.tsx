import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './bottom-sheet';

describe('BottomSheet', () => {
  it('renders children when open is true and does not render when false', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BottomSheet open={false} onClose={onClose} ariaLabel="Test Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );

    expect(screen.queryByText('Sheet Content')).not.toBeInTheDocument();

    rerender(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );

    expect(screen.getByText('Sheet Content')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Test Sheet' })).toBeInTheDocument();
  });

  it('triggers onClose when clicking the background overlay', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );

    // Click background overlay (the role="presentation" outer wrapper)
    const overlay = screen.getByRole('presentation');
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClose when clicking the content panel', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );

    const content = screen.getByText('Sheet Content');
    fireEvent.click(content);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies scroll lock to document.body when open, and restores it on unmount', () => {
    document.body.style.overflow = 'auto';
    const onClose = vi.fn();

    const { unmount } = render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('auto');
  });

  it('focuses the dialog container when opened and handles escape key', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={onClose} ariaLabel="Test Sheet">
        <button type="button">Inside Button</button>
      </BottomSheet>
    );

    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
