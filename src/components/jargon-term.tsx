// JargonTerm — v0.1 brand pattern: term-as-code highlighting.
//
// When a jargon term appears inline in body copy (a missed-terms list, a related
// terms link, a why-it-matters paragraph that mentions another term), wrap it in
// `<JargonTerm>` so it reads as code. The visual treatment matches the brand
// sheet §05: signature violet on a soft tint, IBM Plex Mono Medium, off-scale
// 1px×5px padding (deliberate brand exception — documented).
//
// DO NOT use inside quiz prompts (MC, fill, match) — the visual would give the
// answer away. Apply only to non-quiz body copy:
//   - lesson-summary.tsx (TERMS HIT / TERMS MISSED rows)
//   - term-detail.tsx (related, stretch, body mentions)
//   - whats-new.tsx (term names in new-terms cards)
//
// Renders as a `<span>` so it inherits the parent's flow context (no line breaks
// it shouldn't).

interface Props {
  children: React.ReactNode;
  /**
   * When true, drop the `accent-jargon-tint` background and only color the text +
   * keep mono. Useful when the chip is INSIDE a card that already has the tint
   * (avoids a darker double-tint stack). Default false.
   */
  bare?: boolean;
  className?: string;
}

export function JargonTerm({ children, bare = false, className = '' }: Props) {
  // Off-scale 1px / 5px padding is deliberate — matches the brand sheet's `.term`
  // rule. Documented as an exception to the spacing scale (4/8/12/16/...).
  // Renders as inline-block so the rounded background sits flush with the type.
  return (
    <span
      // BLOCKER fix from code-reviewer: `text-accent-jargon` (#7C5CFF) fails
      // WCAG AA 4.5:1 for body text. Routed through `accent-jargon-hi` (#9D80FF,
      // 5.88:1 on bg-base / 4.94:1 on surface-card — passes AA). Background tint
      // stays the original signature for the brand-sheet "term" recipe.
      className={`inline-block font-mono font-medium text-accent-jargon-hi rounded-sm align-baseline ${
        bare ? '' : 'bg-accent-jargon/[0.12]'
      } ${className}`}
      style={{ padding: '1px 5px' }}
    >
      {children}
    </span>
  );
}
