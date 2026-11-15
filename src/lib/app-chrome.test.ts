import { describe, expect, it } from 'vitest';
import { appBarShowsWordmark, showsAppBar } from './app-chrome';

describe('app chrome', () => {
  it('shows the app bar with the wordmark on the learning screens', () => {
    for (const path of ['/home', '/term/bi-rls', '/path/data-analytics', '/lesson', '/lesson/summary', '/review', '/settings', '/profile', '/spotted', '/program/p1', '/feedback']) {
      expect(showsAppBar(path), path).toBe(true);
      expect(appBarShowsWordmark(path), path).toBe(true);
    }
  });

  it('keeps the bar, without a second wordmark, on onboarding and gifts', () => {
    for (const path of ['/onboarding/goals', '/onboarding/profile', '/gift/send', '/gift/accept']) {
      expect(showsAppBar(path), path).toBe(true);
      expect(appBarShowsWordmark(path), path).toBe(false);
    }
  });

  it('shows no bar on the splash, welcome and public atlas screens', () => {
    for (const path of ['/', '/welcome', '/atlas']) expect(showsAppBar(path), path).toBe(false);
  });
});
