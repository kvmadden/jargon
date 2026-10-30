// Translator-voiced streak prose (B+1.6 polish + voice pass).
//
// Replaces the bare numeric "N day streak!" treatment seen in most learning
// apps with a single dry observation that follows jargon's translator-not-
// professor voice. Lowercase, brief, grounded. Never excited.
//
// Used in prose surfaces (lesson summary header, profile detail, etc.) —
// NOT in the dense stat cards or the home-page pill, which keep the
// numeric `Nd` treatment for information density.
//
// Voice rule examples:
//   day 0   → "no streak going. start one."
//   day 1   → "day one. that counts."
//   day 7   → "a week in."
//   day 30  → "a month in. that's not nothing."
//   day 100 → "one hundred."
//   day 365 → "a year. a year."
//
// The thresholds are chosen so each line lands distinctly at a "natural"
// streak length (week, two weeks, month, two months, hundred, year). The
// in-between days share a banner so the user sees variety without the
// system feeling random.

export function streakVoice(days: number): string {
  const integerDays = Math.floor(isNaN(days) || !isFinite(days) ? 0 : days);
  if (integerDays <= 0) return 'no streak going. start one.';
  if (integerDays === 1) return 'day one. that counts.';
  if (integerDays < 5) return `${integerDays} days in a row.`;
  if (integerDays < 7) return `${integerDays} days. almost a week.`;
  if (integerDays === 7) return 'a week in.';
  if (integerDays < 14) return `${integerDays} days. past a week.`;
  if (integerDays === 14) return 'two weeks.';
  if (integerDays < 30) return `${integerDays} days running.`;
  if (integerDays === 30) return "a month in. that's not nothing.";
  if (integerDays < 60) return `${integerDays} days. month-plus.`;
  if (integerDays === 60) return 'two months.';
  if (integerDays < 100) return `${integerDays} days. it's a habit now.`;
  if (integerDays === 100) return 'one hundred.';
  if (integerDays < 365) return `${integerDays} days. you keep coming back.`;
  if (integerDays === 365) return 'a year. a year.';
  return `${integerDays} days. over a year — that's how it works.`;
}
