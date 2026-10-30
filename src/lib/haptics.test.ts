import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { haptics, isReducedMotion, isVibrateSupported, triggerVibration } from './haptics';

describe('haptics util', () => {
  const originalVibrate = navigator.vibrate;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      value: originalVibrate,
      writable: true,
      configurable: true,
    });
    window.matchMedia = originalMatchMedia;
  });

  function mockMatchMedia(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce') ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  function mockVibrate(implementation?: (pattern: number | number[]) => boolean) {
    const vibrateMock = vi.fn().mockImplementation(implementation || (() => true));
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });
    return vibrateMock;
  }

  it('detects vibrate support correctly', () => {
    mockVibrate();
    expect(isVibrateSupported()).toBe(true);

    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(isVibrateSupported()).toBe(false);
  });

  it('detects reduced motion setting correctly', () => {
    mockMatchMedia(true);
    expect(isReducedMotion()).toBe(true);

    mockMatchMedia(false);
    expect(isReducedMotion()).toBe(false);
  });

  it('triggers vibration with expected pattern when supported and reduced motion is false', () => {
    const vibrateMock = mockVibrate();
    mockMatchMedia(false);

    expect(haptics.tap()).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith(10);

    expect(haptics.success()).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([15, 30, 20]);

    expect(haptics.error()).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([40, 60, 40]);

    expect(haptics.mastery()).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith([20, 40, 20, 40, 40]);
  });

  it('short-circuits and returns false when prefers-reduced-motion is active', () => {
    const vibrateMock = mockVibrate();
    mockMatchMedia(true);

    expect(haptics.tap()).toBe(false);
    expect(haptics.success()).toBe(false);
    expect(haptics.error()).toBe(false);
    expect(haptics.mastery()).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('short-circuits and returns false when navigator.vibrate is unsupported', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    mockMatchMedia(false);

    expect(haptics.tap()).toBe(false);
    expect(haptics.success()).toBe(false);
    expect(haptics.error()).toBe(false);
    expect(haptics.mastery()).toBe(false);
  });

  it('handles navigator.vibrate throwing an error gracefully', () => {
    mockVibrate(() => {
      throw new Error('SecurityError: Vibration blocked');
    });
    mockMatchMedia(false);

    expect(triggerVibration(10)).toBe(false);
    expect(haptics.tap()).toBe(false);
  });
});
