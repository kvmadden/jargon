import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The project's tailwind.config.js *replaces* the stock spacing scale.
// Numeric padding, margin, size, gap, space and min/max-size utilities
// therefore must be drawn from this finite set. A missing class silently
// creates no CSS. Keep this list aligned with theme.spacing in the config.
// Avoid touching lessons, editorial seeds, scoring or verifier policy.
const supportedNumericSpacing = new Set(['0', '1', '2', '3', '4', '6', '8', '12', '16']);
const surfaces = [
  'src/routes/profile.tsx',
  'src/components/command-palette.tsx',
  'src/routes/feedback.tsx',
  'src/features/feedback/feedback-launcher.tsx',
  'src/routes/whats-new.tsx',
  'src/components/bottom-rail.tsx',
  'src/routes/path-detail.tsx',
] as const;

// Captures responsive-class suffixes, including [@media(...)]:py-1,
// negative margins and image max-height caps. Does not mistake arbitrary
// px values such as h-[44px] for invalid named theme spacing.
const numericSpacingUtility = /(?:^|[\s:'"\x60])(-?(?:(?:min|max)-(?:w|h)|(?:w|h)|gap(?:-[xy])?|space-[xy]|[mp](?:[trblxy])?)-(\d+(?:\.\d+)?))(?=$|[\s'"\x60])/gm;

describe('navigation and feedback spacing utility contract', () => {
  it.each(surfaces)('%s uses supported numeric sizes', (filename) => {
    const content = readFileSync(join(process.cwd(), filename), 'utf8');
    const missing = [...content.matchAll(numericSpacingUtility)]
      .filter((match) => !supportedNumericSpacing.has(match[2]))
      .map((match) => match[1]);
    expect(missing).toEqual([]);
  });
});
