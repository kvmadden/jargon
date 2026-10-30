// 9 dots in a 3×3 grid — one fingerprint per path showing E/M/H mastery.
// Bottom row = Easy (3 dots), middle = Medium, top = Hard.
// Each dot fills proportionally with mastered terms in that difficulty.

interface Props {
  /** mastery counts per difficulty: { 1: count, 2: count, 3: count } */
  mastered: { 1: number; 2: number; 3: number };
  /** total terms per difficulty */
  totals: { 1: number; 2: number; 3: number };
  className?: string;
}

export function DifficultyDots({ mastered, totals, className = '' }: Props) {
  function rowDots(level: 1 | 2 | 3) {
    const total = totals[level] ?? 0;
    const rawMastered = mastered[level] ?? 0;
    const m = Math.max(0, Math.min(rawMastered, total));
    // Determine exact number of lit dots for this level (0..3)
    const litCount = total > 0 ? Math.min(3, Math.max(0, Math.floor((m * 3) / total))) : 0;

    return Array.from({ length: 3 }, (_, i) => {
      // A dot at index i is lit iff i < litCount
      const isLit = i < litCount;
      return (
        <span
          key={i}
          aria-hidden="true"
          className={`block w-1 h-1 rounded-full ${
            isLit ? 'bg-accent-jargon' : 'bg-border-default'
          }`}
        />
      );
    });
  }
  const label = `mastery: easy ${mastered[1]} of ${totals[1]}, medium ${mastered[2]} of ${totals[2]}, hard ${mastered[3]} of ${totals[3]}`;
  return (
    <div
      role="img"
      aria-label={label}
      className={`grid grid-cols-3 gap-1 ${className}`}
    >
      {rowDots(3)}
      {rowDots(2)}
      {rowDots(1)}
    </div>
  );
}

