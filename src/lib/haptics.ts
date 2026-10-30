/**
 * Haptics primitive wrapping navigator.vibrate (Capacitor-Haptics compatible shape).
 *
 * Semantic calls:
 * - haptics.tap(): light click / tap (10ms)
 * - haptics.success(): positive feedback pulse ([15, 30, 20]ms)
 * - haptics.error(): double heavy buzz ([40, 60, 40]ms)
 * - haptics.mastery(): celebratory sequence ([20, 40, 20, 40, 40]ms)
 *
 * Each call is a safe no-op returning false when navigator.vibrate is unsupported
 * OR when prefers-reduced-motion: reduce matches.
 */

export function isReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function isVibrateSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Triggers a vibration pattern if supported and reduced motion is disabled.
 * Returns true if vibration was triggered, false if skipped/unsupported.
 */
export function triggerVibration(pattern: number | number[]): boolean {
  if (isReducedMotion() || !isVibrateSupported()) {
    return false;
  }
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const haptics = {
  /** Light tap for button clicks / card selection */
  tap: (): boolean => triggerVibration(10),

  /** Positive feedback for correct answer */
  success: (): boolean => triggerVibration([15, 30, 20]),

  /** Negative feedback for incorrect answer */
  error: (): boolean => triggerVibration([40, 60, 40]),

  /** Celebratory sequence for term/path mastery */
  mastery: (): boolean => triggerVibration([20, 40, 20, 40, 40]),
};

export default haptics;
