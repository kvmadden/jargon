// Streak engine — user timezone support (defaults to browser timezone via Intl)

/**
 * Helper to get the browser's resolved local timezone.
 * Used as default parameter value at call sites.
 */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

/** Return YYYY-MM-DD for the current date in the specified timezone (defaults to browser local timezone). */
export function todayLocalDate(
  now: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): string {
  const safeNow = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const tz = timeZone || getUserTimeZone();
  try {
    // en-CA gives YYYY-MM-DD format directly
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(safeNow);
  } catch {
    return safeNow.toISOString().slice(0, 10);
  }
}

/** Days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return 0;
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Compute the current streak length given an array of dates the user logged a lesson on,
 * sorted newest first. A streak of N means: today (or yesterday if no lesson yet today)
 * is the most recent day, and there are N consecutive days back from there.
 */
export function computeCurrentStreak(loggedDates: string[], today: string = todayLocalDate()): number {
  if (!Array.isArray(loggedDates) || loggedDates.length === 0) return 0;
  const validDates = loggedDates.filter(d => d && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (validDates.length === 0) return 0;
  const set = new Set(validDates);
  let streak = 0;

  // Walk backward from today; if today isn't in the set, we still allow yesterday to count
  // (the user hasn't done today yet — streak survives until end of day).
  let cursor = today;
  if (!set.has(cursor)) {
    // step back one day
    cursor = shiftDate(cursor, -1);
    if (!set.has(cursor)) return 0;
  }

  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
    if (streak > 100000) break;
  }
  return streak;
}

/** Compute longest streak ever from a date set. */
export function computeLongestStreak(loggedDates: string[]): number {
  if (!Array.isArray(loggedDates) || loggedDates.length === 0) return 0;
  // Deduplicate: same-day multiple logs should not break/reset longest streak
  const validDates = Array.from(
    new Set(loggedDates.filter(d => d && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))
  );
  if (validDates.length === 0) return 0;
  const sorted = [...validDates].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(sorted[i - 1]!, sorted[i]!);
    if (diff === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return longest;
}

/** Shift a YYYY-MM-DD date by N days (can be negative). */
export function shiftDate(date: string, days: number, timeZone: string = getUserTimeZone()): string {
  const safeDays = isNaN(days) || typeof days !== 'number' || !isFinite(days) ? 0 : Math.round(days);
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const todayStr = todayLocalDate(new Date(), timeZone);
    const d = new Date(`${todayStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + safeDays);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(`${date}T00:00:00Z`);
  if (isNaN(d.getTime())) {
    const todayStr = todayLocalDate(new Date(), timeZone);
    const d2 = new Date(`${todayStr}T00:00:00Z`);
    d2.setUTCDate(d2.getUTCDate() + safeDays);
    return d2.toISOString().slice(0, 10);
  }
  d.setUTCDate(d.getUTCDate() + safeDays);
  return d.toISOString().slice(0, 10);
}

/** Should we prompt the user to use a streak freeze? */
export function shouldPromptFreeze(
  lastLoggedDate: string | null | undefined,
  freezesAvailable: number,
  today: string = todayLocalDate(),
): { prompt: boolean; gap: number } {
  if (!lastLoggedDate || typeof lastLoggedDate !== 'string') return { prompt: false, gap: 0 };
  const safeFreezes = isNaN(freezesAvailable) || typeof freezesAvailable !== 'number' || freezesAvailable < 0 ? 0 : freezesAvailable;
  const gap = daysBetween(lastLoggedDate, today);
  // If gap >= 2 days and we have enough freezes to bridge gap-1 missed days
  const shouldPrompt = gap >= 2 && safeFreezes >= gap - 1;
  return { prompt: shouldPrompt, gap };
}
