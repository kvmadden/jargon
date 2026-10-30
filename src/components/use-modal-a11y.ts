import { useEffect, useRef } from 'react';

/**
 * Reusable React hook for modal/dialog accessibility.
 * Handles locking body overflow, autofocusing container/first-item,
 * trapping keyboard focus loop inside the modal, and handling Escape key.
 * Restores previous focus on unmount.
 */
export function useModalA11y(
  open: boolean,
  onClose: () => void,
): React.RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest onClose in a ref so the setup effect below can depend ONLY
  // on `open`. Consumers pass an inline onClose (a new identity every render);
  // if it were an effect dependency, any parent re-render while the modal is
  // open would re-run the whole setup — the cleanup restores focus to the
  // pre-open element and the body then re-focuses the container, yanking focus
  // off a child input mid-typing. (Regression: the Cmd+K command palette
  // dropped keystrokes on first open when its host lazy-loaded terms and
  // re-rendered.)
  const onCloseRef = useRef<() => void>(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    // 1. Store previous focus
    const previousFocus = document.activeElement as HTMLElement | null;

    // 2. Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const currentContainer = container;

    // 3. Focus the container (requires tabIndex={-1} on container) — but NOT if
    // focus is already inside it (a child input may have grabbed focus first),
    // so we never steal focus back onto the wrapper.
    if (!currentContainer.contains(document.activeElement)) {
      currentContainer.focus();
    }

    // 4. Handle Tab trap & Escape key
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = Array.from(
          currentContainer.querySelectorAll<HTMLElement>(
            'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]',
          ),
        ).filter((el) => {
          if (el.tabIndex === -1 && el !== currentContainer) return false;
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLElement;

        if (e.shiftKey) {
          if (active === first || active === currentContainer) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (
        previousFocus &&
        typeof previousFocus.focus === 'function' &&
        document.body.contains(previousFocus)
      ) {
        previousFocus.focus();
      }
    };
  }, [open]);

  return containerRef;
}
