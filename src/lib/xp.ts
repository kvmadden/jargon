// XP rules + level curve

export const XP = {
  CORRECT_ANSWER: 10,
  SENTENCE_PASS: 25,
  SENTENCE_PARTIAL: 12,
  LESSON_COMPLETE: 20,
  FIRST_LESSON_OF_DAY_BONUS: 30,
  TERM_MASTERED: 50,
} as const;

export interface LevelProgressInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  percent: number;
}

/** Level curve: floor(100 * n^1.5). Level 1 = 100, level 5 = 1118, level 10 = 3162. */
export function xpForLevel(level: number): number {
  if (typeof level !== 'number' || level <= 0 || isNaN(level) || !isFinite(level)) return 0;
  const safeLevel = Math.floor(level);
  if (safeLevel <= 0) return 0;
  return Math.floor(100 * Math.pow(safeLevel, 1.5));
}

/** Reverse: total XP → current level (1-indexed). Level 1 begins at 0 XP. */
export function levelFromXp(totalXp: number): number {
  if (typeof totalXp !== 'number' || totalXp < 0 || isNaN(totalXp)) return 1;
  if (!isFinite(totalXp) || totalXp >= xpForLevel(1000000)) return 999999;
  if (totalXp < xpForLevel(1)) return 1;
  let level = Math.min(999999, Math.max(1, Math.floor(Math.pow(totalXp / 100, 2 / 3))));
  while (xpForLevel(level + 1) <= totalXp && level < 999999) {
    level += 1;
  }
  while (level > 1 && xpForLevel(level) > totalXp) {
    level -= 1;
  }
  return level;
}

/** Returns { level, xpIntoLevel, xpForNextLevel, percent } for a given total XP. */
export function levelProgress(totalXp: number): LevelProgressInfo {
  const safeXp = typeof totalXp !== 'number' || isNaN(totalXp) || totalXp < 0 ? 0 : totalXp;
  if (!isFinite(safeXp)) {
    return { level: 999999, xpIntoLevel: 0, xpForNextLevel: 1, percent: 100 };
  }
  const level = levelFromXp(safeXp);
  const floor = level === 1 ? 0 : xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const xpIntoLevel = Math.max(0, safeXp - floor);
  const xpForNextLevel = Math.max(1, ceiling - floor);
  const percent = Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)));
  return { level, xpIntoLevel, xpForNextLevel, percent };
}
