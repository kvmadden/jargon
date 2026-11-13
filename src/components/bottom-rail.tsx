import { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  /**
   * Total number of terms the user has mastered (isMastered: score >=
   * MASTERY_SCORE_MIN AND correct_count >= MASTERED_CORRECT_MIN) across the
   * active domain. Display as `N mastered`.
   */
  mastered: number;
  /**
   * Number of paths in the active domain where the user has at least one
   * mastered term. Display as `pathsTouched/pathsTotal paths`.
   */
  pathsTouched: number;
  /** Total path count for the active domain (denominator). */
  pathsTotal: number;
  /**
   * Distinct terms recognized via /spotted scans this week (Mon→ in
   * America/New_York). Display as `N spotted this week`.
   */
  spottedThisWeek: number;
}

/**
 * Sticky bottom rail — mission-aligned 3-stat readout.
 *
 * B+1.18: replaced the legacy Duolingo-style "streak · lvl · xp" cluster
 * with three mission-shaped numbers that come from real rows:
 *   - mastered  ← user_progress (score ≥ 0.8 AND correct_count ≥ 3)
 *   - paths     ← user_progress aggregated by path (any-mastered / total)
 *   - spotted   ← spotted_scan_log distinct term IDs this week
 *
 * Forwarded ref lets pages (Home) measure the actual rendered height —
 * including the safe-area inset — so they can apply matching bottom
 * padding to their main scroll area without obscuring the last card.
 *
 * Tap target = whole rail, navigates to /profile (mirrors the legacy
 * rail's navigation contract so existing flows aren't disturbed).
 */
export const BottomRail = forwardRef<HTMLButtonElement, Props>(function BottomRail(
  { mastered, pathsTouched, pathsTotal, spottedThisWeek },
  ref,
) {
  const navigate = useNavigate();

  // Three stats, centered, mono numerals. Each stat reads as "Number Label"
  // with a 1px right-rule between siblings (the rule is suppressed on the
  // last child via `last:border-r-0`). The rail keeps its full-bleed
  // sticky chrome + safe-area inset behavior.
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => navigate('/profile')}
      className="group fixed left-0 right-0 bottom-0 safe-bottom bg-surface-card border-t border-border-default px-4 py-3 [@media(max-height:500px)]:py-1 hover:bg-surface-card-hi hover:border-accent-jargon/30 active:bg-surface-card-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors z-30 min-h-[44px]"
      aria-label={`Open profile. ${mastered} mastered, ${pathsTouched} of ${pathsTotal} paths, ${spottedThisWeek} spotted this week.`}
    >
      {/* Inner container mirrors home's content max-w so the cluster anchors
          to the same axis as the cards above. flex + justify-center keeps
          the three stats centered as a unit. */}
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex items-stretch justify-center">
        <Stat number={mastered} label="mastered" />
        <Stat
          number={`${pathsTouched}/${pathsTotal}`}
          label="paths"
        />
        <Stat
          number={spottedThisWeek}
          label="spotted this week"
          isLast
        />
      </div>
    </button>
  );
});

interface StatProps {
  number: number | string;
  label: string;
  isLast?: boolean;
}

/**
 * One slot in the 3-stat rail. Mono-numeral number on top, lowercase
 * label below — both centered. A 1px right rule (subtle, half-tone)
 * separates siblings. The last slot suppresses its rule via `isLast`.
 *
 * Padding scales: tighter on phone, looser on tablet+ for visual rhythm.
 * Each slot is `flex-1 basis-0` so the three slots share width evenly
 * even when their numeric content varies in length (e.g. "0" vs
 * "47" vs "3/7").
 */
function Stat({ number, label, isLast = false }: StatProps) {
  return (
    <div
      className={`flex-1 basis-0 flex flex-col items-center justify-center px-3 md:px-4 ${
        isLast ? '' : 'border-r border-border-default/50'
      }`}
    >
      <span className="text-base font-mono font-semibold text-text-primary tabular-nums leading-tight [@media(max-height:500px)]:text-sm">
        {number}
      </span>
      <span className="text-2xs text-text-muted leading-none mt-1 [@media(max-height:500px)]:mt-0 text-center">
        {label}
      </span>
    </div>
  );
}
