import { todayLocalDate } from './streak-engine';
import type { SettingsRow } from './database.types';

export const DEFAULT_FREEZE_CAP = 2;

/**
 * monthly streak-freeze refill.
 *
 * once per calendar month, tops `streak_freezes_available` up to the cap — never
 * above it, never below the user's current count (an at/above-cap user is left
 * alone). the "which month did we last refill" marker lives in localStorage:
 * there's no server column for it yet, so the guard is per-device. we read a
 * forward-compat `last_freeze_refill_at` off settings defensively so that if a
 * column is ever added the guard goes cross-device for free — but we never WRITE
 * that column (it doesn't exist, and typing the patch as Partial<SettingsRow>
 * would reject it anyway).
 *
 * ordering matters: we stamp the local marker only AFTER a successful persist,
 * so a failed write retries next load instead of silently eating the month.
 *
 * returns true if a refill happened this call.
 */
export async function checkAndRefillStreakFreezes(
  userId: string,
  settings: Partial<SettingsRow> | null,
  updateSettings: (userId: string, patch: Partial<SettingsRow>) => Promise<void>
): Promise<boolean> {
  if (!userId || !settings) return false;

  const localKey = `jargon_last_freeze_refill:${userId}`;
  let storedRefill: string | null = null;
  try {
    storedRefill = localStorage.getItem(localKey);
  } catch {
    // ignore restricted/unavailable storage
  }

  // forward-compat: honor a server column if one ever exists, else the local marker.
  const lastRefill =
    (settings as Record<string, unknown>).last_freeze_refill_at ?? storedRefill;
  const now = new Date();
  const currentMonth = todayLocalDate(now).slice(0, 7);
  const lastRefillText = lastRefill ? String(lastRefill) : null
  // Timestamp markers and the current month must use the same local timezone.
  // Keep date-only markers as calendar dates rather than interpreting them as UTC.
  const lastMonth = lastRefillText?.includes('T')
    ? todayLocalDate(new Date(lastRefillText)).slice(0, 7)
    : lastRefillText?.slice(0, 7) ?? null

  if (lastMonth && lastMonth === currentMonth) {
    return false;
  }

  const currentAvailable = Number(settings.streak_freezes_available ?? 0);
  // absolute set, never an increment: Math.max leaves an at/above-cap user alone
  // (3 stays 3, never over-capped) and makes a same-device double-fire idempotent.
  const nextAvailable = Math.max(currentAvailable, DEFAULT_FREEZE_CAP);

  try {
    await updateSettings(userId, { streak_freezes_available: nextAvailable });
  } catch {
    // persist failed — do NOT stamp the month locally, so we retry next load
    // rather than silently eating this month's refill.
    return false;
  }

  // stamp the month only AFTER a confirmed persist (ordering fix).
  try {
    localStorage.setItem(localKey, now.toISOString());
  } catch {
    // ignore
  }

  return true;
}
