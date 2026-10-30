// PathGlyph — unified glyph system for path identity.
//
// Resolves a PathId to a standard, clean Phosphor icon and fetches it
// dynamically from the Iconify API.
//
// Design choices:
//   - Uses <img> tag pointing to Iconify CDN, consistent with <DomainIcon>.
//   - Caches at the browser layer, eliminating manual inline SVG overhead.
//   - Maps every single path (coding + AI domains) to a relevant line-art icon,
//     completely replacing the generic square placeholder box.
//   - Tint color resolves based on active state: signature periwinkle/violet
//     (#7C5CFF) for active paths, and text.dim.dark for inactive.
//
// The inactive tint is now IMPORTED. From 2026-08-24 to 2026-08-28 this comment
// claimed it already resolved to the token package while the line below still
// hardcoded the retired zinc a1a1aa — the comment was updated in the retirement
// pass and the value was not. hardcoded-token-doctor could not catch it twice
// over: the literal is hashless (the scanner matches raw #-prefixed hex) and it
// is interpolated into a CDN URL rather than used as a CSS value. The brand
// accent stays a literal, matching the deliberate decision in domain-icon.tsx.

import { colors } from 'design-tokens/design';

import { type PathId } from '../lib/database.types';
import { iconUrl } from '../lib/domains';

/** Brand-locked accent — see domain-icon.tsx TONE_HEX for why this one is not a token. */
const ACCENT_JARGON = '#7C5CFF';

type GlyphSize = 'sm' | 'md' | 'lg';

interface Props {
  path: PathId;
  active?: boolean;
  className?: string;
  /** Size modifier for accessibility/hierarchy. Height/width come from className. */
  size?: GlyphSize;
  /** Optional alt text override. If provided, will be set on the img; if omitted, defaults to "" (decorative). */
  alt?: string;
}

const PATH_ICONS: Record<PathId, string> = {
  // coding domain
  'git-cli': 'git-branch',
  'dev-concepts': 'brackets-angle',
  'enterprise': 'buildings',
  'claude-code': 'robot',
  'ai-engineering': 'cpu',
  'agile': 'arrows-clockwise',
  'systems': 'cube',
  'programming': 'file-code',
  'dev-tooling': 'wrench',
  'dev-workflow': 'git-commit',
  'web-api': 'plugs-connected',
  'databases': 'database',
  'computing': 'desktop',
  'networking': 'share-network',
  'security': 'shield-check',
  'architecture': 'compass',
  'systems-engineering': 'gear-six',
  'cloud-devops': 'cloud',
  'qa-reliability': 'check-square',
  'math-logic': 'function',
  'tech-stack': 'stack',
  'enterprise-platforms': 'tree-structure',
  'data-analytics': 'chart-bar',
  // ai domain
  'ai-foundations': 'atom',
  'ai-tools': 'toolbox',
  'ai-prompting': 'terminal-window',
  'ai-products': 'package',
  'ai-evaluation': 'scales',
  'ai-policy': 'gavel',
  'ai-agentic-era': 'rocket-launch',
};

export function PathGlyph({
  path,
  active = false,
  className = '',
  alt,
}: Props) {
  const iconName = PATH_ICONS[path] || 'square';
  
  // iconUrl() strips the leading `#` and lowercases for CDN cache friendliness,
  // so the tint can be passed as a normal token value. Building this URL by hand
  // is what let a raw hex sit here unnoticed.
  const url = iconUrl('ph', iconName, active ? ACCENT_JARGON : colors.text.dim.dark);
  
  const cls = `${className.includes('w-') ? '' : 'w-6 h-6'} ${className}`;

  return (
    <img
      src={url}
      alt={alt !== undefined ? alt : ''}
      aria-hidden={alt === undefined || alt === '' ? 'true' : undefined}
      className={cls}
      loading="lazy"
      decoding="async"
    />
  );
}
