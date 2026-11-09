import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Tailwind's spacing scale is intentionally replaced in tailwind.config.js.
// Stock sizes like w-5, h-10, gap-1.5 therefore compile to *no CSS*.
// These auxiliary surfaces are independent of the stacked lesson redesign PRs.
// Keep navigation and feedback controls on supported sizes or the explicit
// 44px touch-target exception. This test does not claim screenshot QA.
const surfaces = [
  'src/routes/profile.tsx',
  'src/components/command-palette.tsx',
  'src/routes/feedback.tsx',
  'src/features/feedback/feedback-launcher.tsx',
  'src/routes/whats-new.tsx',
  'src/components/bottom-rail.tsx',
  'src/routes/path-detail.tsx',
] as const;

// Include responsive and arbitrary-media-query prefixes; match whole sizes,
// not the valid w-12 or the deliberate arbitrary w-[44px] exception.
const unsupportedSpacing = /(?:^|[\s:"'])((?:w|h|gap|px|py)-(?:1\.5|2\.5|5|7|9|10|11|14))(?=[\s"'\x60])/gm;

describe('navigation and feedback spacing utility contract', () => {
  it.each(surfaces)('%s uses supported named sizes', (filename) => {
    const content = readFileSync(join(process.cwd(), filename), 'utf8');
    const unmatched = [...content.matchAll(unsupportedSpacing)].map((match) => match[1]);
    expect(unmatched).toEqual([]);
  });
});
