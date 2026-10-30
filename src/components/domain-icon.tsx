// <DomainIcon> — flat-art mark for a domain, fetched from Iconify.
//
// Design choices:
//   - <img> not inline SVG: caches at the browser layer; no JS overhead;
//     no DOMPurify dance. The downside (can't theme via CSS currentColor)
//     is fine for jargon — color choices are brand-locked anyway.
//   - tone enum, not arbitrary color prop: forces every call site to pick
//     a brand token. New colors require a token bump, not an ad-hoc prop.
//   - size in px: match the per-call site grid (16/24/32/48). Iconify's
//     hosted SVGs render crisp at any pixel size; we set width+height
//     explicitly to avoid layout shift on the network round-trip.
//
// Adding a new tone: add to TONE_HEX below + the keyof type updates
// automatically. Adding a new domain icon: change DomainMeta.icon in
// src/lib/domains.ts — this component picks up the new icon automatically.

import { colors } from 'design-tokens/design';

import { domainIconUrl, type Domain } from '../lib/domains';

/**
 * Colour tokens for the mark. Two different kinds of value live here and they
 * are NOT governed the same way:
 *
 *   - accent / accent-hi are BRAND-LOCKED jargon values (v0.1 signature
 *     violet). They have no representation in the shared token package and
 *     stay as literals, mirrored in tailwind.config.js. If the brand signature
 *     changes, BOTH this map AND the Tailwind config must update.
 *   - muted / primary are SHARED text tokens and are now imported, not
 *     retyped. Until 2026-08-24 they were zinc a1a1aa and fafafa (spelled hashless on
 *     purpose — the retired-hex scanner matches raw #-literals) — the retired
 *     zinc ramp — and this file was one of the three places jargon still
 *     carried it after the class itself was fixed, precisely because a hand
 *     "mirror" of a token has no wire down which a correction can travel.
 */
const TONE_HEX = {
  accent: '#7C5CFF',
  'accent-hi': '#9D80FF',
  muted: colors.text.dim.dark,
  primary: colors.text.primary.dark,
} as const;

export type IconTone = keyof typeof TONE_HEX;

interface Props {
  domain: Domain;
  /** Pixel size — should match the surrounding grid (16, 24, 32, 48). */
  size?: number;
  /** Color tone; defaults to the signature accent. */
  tone?: IconTone;
  /** Optional className for layout positioning (margin, alignment). */
  className?: string;
  /** Optional aria-label override. Defaults to "<domain> icon". */
  label?: string;
}

export function DomainIcon({
  domain,
  size = 24,
  tone = 'accent',
  className,
  label,
}: Props) {
  const url = domainIconUrl(domain, TONE_HEX[tone]);
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt={label !== undefined ? label : `${domain} icon`}
      className={className}
      // Decorative-but-labeled — alt text exists for screen readers but
      // we don't want the icon to block paint if the network is slow.
      loading="lazy"
      decoding="async"
    />
  );
}
