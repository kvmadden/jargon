// <TranslatorBadge> — visualizes the translator direction as
// `[active-domain icon] → [home-domain icon]`.
//
// The arrow IS the translator. It's the brand voice principle
// ("translator-not-professor") rendered as iconography: every personalized
// rendering bridges from the term's home domain (active = what you're
// learning) to the user's lived domain (home = where the analogy should
// land). The badge surfaces that direction so the user understands what
// the personalization is actually doing.
//
// Identity case (from === to): renders just one icon, no arrow. Today
// every user sits in this case because the only domain is 'coding'. The
// component is built for the multi-domain world; in single-domain it
// degrades cleanly to a single mark.
//
// Arrow choice: typographic `→` (Plex Mono) instead of an Iconify arrow
// SVG. Two reasons:
//   1) Zero network — no extra round trip for the arrow asset
//   2) Scales with text size automatically, no vertical-align fiddle

import { DomainIcon, type IconTone } from './domain-icon';
import type { Domain } from '../lib/domains';

interface Props {
  /** The domain the user is currently learning (LEFT side of the arrow). */
  active: Domain;
  /** The domain the user lives in — their day job (RIGHT side of the arrow). */
  home: Domain;
  /** Pixel size of each icon. Arrow scales independently via CSS. */
  size?: number;
  /** Tone for the icons. Both ends use the same tone for visual coherence. */
  tone?: IconTone;
  /** Optional className for layout positioning. */
  className?: string;
}

export function TranslatorBadge({
  active,
  home,
  size = 24,
  tone = 'accent',
  className,
}: Props) {
  // Identity case: just show the one icon, no arrow. The translator is
  // the identity function when you're not bridging domains. Today this is
  // the only case; the arrow lights up when Kevin (or a future user)
  // sets their home_domain different from active_domain.
  if (active === home) {
    return (
      <span className={className} aria-label={`${active} domain`}>
        <DomainIcon domain={active} size={size} tone={tone} label="" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}
      aria-label={`translating ${active} into ${home} terms`}
    >
      <DomainIcon domain={active} size={size} tone={tone} label="" />
      <span
        className="font-mono text-text-muted leading-none select-none"
        // Slightly smaller than the icon size so the arrow reads as connector,
        // not as a third equal-weight element. Inline style because the
        // ratio is dynamic — Tailwind doesn't have arbitrary px without an
        // arbitrary class, which violates the spacing-token rule.
        style={{ fontSize: Math.round(size * 0.75) }}
        aria-hidden="true"
      >
        →
      </span>
      <DomainIcon domain={home} size={size} tone={tone} label="" />
    </span>
  );
}
