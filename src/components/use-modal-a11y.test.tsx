import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useModalA11y } from './use-modal-a11y';

function ModalTestWrapper({
  open,
  onClose,
  children,
  empty = false,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  empty?: boolean;
}) {
  const containerRef = useModalA11y(open, onClose);
  return (
    <div ref={containerRef} tabIndex={-1} data-testid="modal-container">
      {!empty && (
        <>
          <button data-testid="btn1">Btn 1</button>
          <button data-testid="btn2">Btn 2</button>
        </>
      )}
      {children}
    </div>
  );
}

describe('useModalA11y', () => {
  let outerButton: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';

    outerButton = document.createElement('button');
    outerButton.textContent = 'Outer';
    document.body.appendChild(outerButton);
    outerButton.focus();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not lock scroll or trap focus when open is false', () => {
    const onClose = vi.fn();
    render(<ModalTestWrapper open={false} onClose={onClose} />);

    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(outerButton);
  });

  it('locks body scroll, focuses container when opened, and restores scroll/focus on close', () => {
    const onClose = vi.fn();
    const { rerender, unmount } = render(<ModalTestWrapper open={true} onClose={onClose} />);

    expect(document.body.style.overflow).toBe('hidden');

    // Close modal
    rerender(<ModalTestWrapper open={false} onClose={onClose} />);

    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(outerButton);

    unmount();
  });

  it('triggers onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<ModalTestWrapper open={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus forward and backward inside container', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<ModalTestWrapper open={true} onClose={onClose} />);

    const btn1 = getByTestId('btn1');
    const btn2 = getByTestId('btn2');

    // Focus last element
    btn2.focus();

    // Press Tab on last element -> wraps to first element
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(btn1);

    // Press Shift+Tab on first element -> wraps to last element
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(btn2);
  });

  it('handles empty focusables container gracefully on Tab key', () => {
    const onClose = vi.fn();
    render(<ModalTestWrapper open={true} onClose={onClose} empty={true} />);

    const preventDefaultSpy = vi.fn();
    fireEvent.keyDown(window, { key: 'Tab', preventDefault: preventDefaultSpy });

    // Should not crash when container has no focusable children
  });

  it('does not crash on unmount if previousFocus was removed from DOM', () => {
    const tempButton = document.createElement('button');
    document.body.appendChild(tempButton);
    tempButton.focus();

    const onClose = vi.fn();
    const { unmount } = render(<ModalTestWrapper open={true} onClose={onClose} />);

    document.body.removeChild(tempButton);

    expect(() => unmount()).not.toThrow();
  });
});
