import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore } from './toast';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty toasts array', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('pushes a toast with default variant and auto-dismisses after 2400ms', () => {
    useToastStore.getState().push('Test message');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toBe('Test message');
    expect(toasts[0]!.variant).toBe('default');

    // Fast-forward past auto-dismiss timer
    vi.advanceTimersByTime(2500);

    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('supports custom variants (success, warn, error)', () => {
    useToastStore.getState().push('Success!', 'success');
    useToastStore.getState().push('Warning!', 'warn');
    useToastStore.getState().push('Error!', 'error');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(3);
    expect(toasts[0]!.variant).toBe('success');
    expect(toasts[1]!.variant).toBe('warn');
    expect(toasts[2]!.variant).toBe('error');
  });

  it('manually dismisses a toast by id', () => {
    useToastStore.getState().push('First');
    useToastStore.getState().push('Second');

    const toasts = useToastStore.getState().toasts;
    const firstId = toasts[0]!.id;

    useToastStore.getState().dismiss(firstId);

    const updatedToasts = useToastStore.getState().toasts;
    expect(updatedToasts).toHaveLength(1);
    expect(updatedToasts[0]!.message).toBe('Second');
  });

  it('clears all toasts when clear() is called', () => {
    useToastStore.getState().push('One');
    useToastStore.getState().push('Two');
    expect(useToastStore.getState().toasts).toHaveLength(2);

    useToastStore.getState().clear();

    expect(useToastStore.getState().toasts).toEqual([]);
  });
});
