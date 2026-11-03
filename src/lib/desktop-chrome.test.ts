import { describe, expect, it } from 'vitest';
import { floatingButtonDesktopClass, showsDesktopAppBar } from './desktop-chrome';

describe('desktop chrome', () => {
  it('shows the app bar on the learning screens', () => {
    for (const path of ['/home', '/term/bi-rls', '/path/data-analytics', '/lesson', '/lesson/summary', '/review', '/settings', '/profile', '/spotted', '/program/p1', '/feedback']) {
      expect(showsDesktopAppBar(path), path).toBe(true);
      expect(floatingButtonDesktopClass(path), path).toBe('lg:hidden');
    }
  });

  it('leaves focused flows with their own header alone, floating buttons included', () => {
    for (const path of ['/', '/welcome', '/onboarding/goals', '/onboarding/profile', '/gift/send', '/gift/accept', '/atlas']) {
      expect(showsDesktopAppBar(path), path).toBe(false);
      expect(floatingButtonDesktopClass(path), path).toBe('');
    }
  });
});
