// Tests for <TranslatorBadge>.
//
// Two render paths to verify:
//   (1) Identity (active === home): single icon, no arrow.
//   (2) Bridge (active !== home): two icons + arrow text.
//
// Today only one Domain ('coding') exists, so case (2) requires casting
// a fake string through `as Domain`. That's the same pattern used in
// classifyJobToDomains tests — when the second domain ships, swap the
// casts for real domain enum values.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TranslatorBadge } from './translator-badge';
import type { Domain } from '../lib/domains';

describe('TranslatorBadge', () => {
  describe('identity case (active === home)', () => {
    it('renders exactly one icon, no arrow', () => {
      const { container } = render(
        <TranslatorBadge active="coding" home="coding" />,
      );
      const imgs = container.querySelectorAll('img');
      expect(imgs).toHaveLength(1);
      // No arrow span — the identity case skips the inline-flex wrapper.
      const arrows = container.querySelectorAll('span[aria-hidden="true"]');
      expect(arrows).toHaveLength(0);
    });

    it("uses the 'coding' icon for the identity case", () => {
      const { container } = render(
        <TranslatorBadge active="coding" home="coding" />,
      );
      const img = container.querySelector('img');
      expect(img?.getAttribute('src')).toContain('/ph/code.svg');
    });

    it('aria-label describes the single domain', () => {
      const { container } = render(
        <TranslatorBadge active="coding" home="coding" />,
      );
      const wrapper = container.querySelector('span[aria-label]');
      expect(wrapper?.getAttribute('aria-label')).toBe('coding domain');
    });
  });

  describe('bridge case (active !== home)', () => {
    // Cast a hypothetical second-domain string. When the real second
    // domain ships, replace 'pharmacy' with the actual enum value and
    // verify the icon URL points at that domain's registered icon.
    const fakeHome = 'pharmacy' as Domain;

    it('renders two icons + an arrow span', () => {
      const { container } = render(
        <TranslatorBadge active="coding" home={fakeHome} />,
      );
      const imgs = container.querySelectorAll('img');
      expect(imgs).toHaveLength(2);
      const arrows = container.querySelectorAll('span[aria-hidden="true"]');
      expect(arrows).toHaveLength(1);
      expect(arrows[0].textContent).toBe('→');
    });

    it("aria-label describes the bridge direction (active → home)", () => {
      const { container } = render(
        <TranslatorBadge active="coding" home={fakeHome} />,
      );
      const wrapper = container.querySelector('span[aria-label]');
      expect(wrapper?.getAttribute('aria-label')).toBe(
        'translating coding into pharmacy terms',
      );
    });

    it('arrow font-size scales with the size prop (75% rule)', () => {
      const { container } = render(
        <TranslatorBadge active="coding" home={fakeHome} size={32} />,
      );
      const arrow = container.querySelector('span[aria-hidden="true"]') as HTMLSpanElement;
      // 32 * 0.75 = 24 (Math.round)
      expect(arrow.style.fontSize).toBe('24px');
    });
  });
});
