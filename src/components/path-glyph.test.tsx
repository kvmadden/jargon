// Regression tests for <PathGlyph>'s tint resolution.
//
// From 2026-08-24 to 2026-08-28 this component's header comment claimed the
// inactive tint resolved to the token package while the code below it still
// hardcoded the retired zinc `a1a1aa`. The retirement pass updated the prose
// and missed the value, and nothing caught it:
//   - hardcoded-token-doctor matches raw `#`-prefixed literals; this one was
//     hashless because it is interpolated into a CDN query param.
//   - vqa covers route "/" only, which renders <Landing>. PathGlyph appears in
//     eight other modules, none of them on that route — so the visual gate
//     could never have exercised it.
// These assertions are the coverage that was missing. They pin the VALUE, not
// the comment, which is the distinction the original defect turned on.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { colors } from 'design-tokens/design';
import { PathGlyph } from './path-glyph';

const RETIRED_ZINC = 'a1a1aa';

describe('<PathGlyph> tint', () => {
  it('resolves the inactive tint from the token package, not a hardcoded hex', () => {
    render(<PathGlyph path="git-cli" active={false} alt="git" />);
    const src = screen.getByRole('img', { name: 'git' }).getAttribute('src') ?? '';

    const expected = colors.text.dim.dark.replace('#', '').toLowerCase();
    expect(src).toContain(`color=%23${expected}`);
    expect(src).not.toContain(RETIRED_ZINC);
  });

  it('still renders the brand accent when active', () => {
    render(<PathGlyph path="git-cli" active alt="git" />);
    const src = screen.getByRole('img', { name: 'git' }).getAttribute('src') ?? '';
    expect(src).toContain('color=%23c2410c');
    expect(src).not.toContain(RETIRED_ZINC);
  });

  // The control. If the token itself were ever set back to the retired value,
  // the two assertions above would still pass — expected would simply BE the
  // zinc. This makes that impossible to miss.
  it('the token it reads is not the retired zinc', () => {
    expect(colors.text.dim.dark.toLowerCase()).not.toContain(RETIRED_ZINC);
    expect(colors.text.dim.dark).toBe('#a8a29e');
  });
});
