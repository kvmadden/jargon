import { describe, it, expect } from 'vitest';
import { validateLivedIcons, LIVED_ICONS_ALLOWLIST } from './lived-icons-allowlist';

describe('lived-icons-allowlist', () => {
  it('validateLivedIcons returns empty array for non-array inputs', () => {
    expect(validateLivedIcons(null)).toEqual([]);
    expect(validateLivedIcons(undefined)).toEqual([]);
    expect(validateLivedIcons('briefcase')).toEqual([]);
    expect(validateLivedIcons({ icon: 'briefcase' })).toEqual([]);
  });

  it('validateLivedIcons filters, dedupes, and normalizes valid slugs', () => {
    const input = ['briefcase', 'BRIEFCASE', 'non-existent', 'cat', 'cat', 'dog'];
    const result = validateLivedIcons(input);
    // Should keep briefcase (lowercase), cat, dog, filter non-existent, and dedupe briefcase and cat
    // But capped at default LIVED_ICON_MAX = 3
    expect(result).toEqual(['briefcase', 'cat', 'dog']);
  });

  it('validateLivedIcons honors custom max limits', () => {
    const input = ['briefcase', 'cat', 'dog'];
    expect(validateLivedIcons(input, 1)).toEqual(['briefcase']);
    expect(validateLivedIcons(input, 2)).toEqual(['briefcase', 'cat']);
  });

  it('validateLivedIcons handles invalid custom max limits gracefully', () => {
    const input = ['briefcase', 'cat', 'dog'];
    expect(validateLivedIcons(input, -1)).toEqual(['briefcase', 'cat', 'dog']);
    expect(validateLivedIcons(input, NaN)).toEqual(['briefcase', 'cat', 'dog']);
    expect(validateLivedIcons(input, 'invalid' as any)).toEqual(['briefcase', 'cat', 'dog']);
  });

  it('validateLivedIcons skips non-string entries in input array', () => {
    const input = ['briefcase', 123, null, 'cat'];
    expect(validateLivedIcons(input)).toEqual(['briefcase', 'cat']);
  });
});
