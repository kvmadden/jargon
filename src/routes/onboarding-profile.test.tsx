/**
 * Unit + integration tests for onboarding-profile.tsx (B+1.10 redesign).
 *
 * Coverage targets (priority-ordered, per spec):
 *   1. hasValue() pure function — all StepIds × empty/non-empty (via CTA gating)
 *   2. Gating logic on the next button (RTL component tests)
 *   3. Step jumping via progress bar segments
 *   4. Skip semantics — field cleared + skipped flag preserved on back-nav
 *   5. finish() payload shape passed to upsertUserProfile
 *   6. StepJob race-condition cancel: goBack bumps seq, stale resolve is no-op
 *   7. Double-tap guard on finish
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * No @testing-library/user-event (not installed in this project).
 *
 * Step map (10 total, 0-indexed):
 *   0  domain       1  display_name  2  why       3  job
 *   4  encounter    5  interests     6  heritage   7  roles
 *   8  background   9  review
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Module mocks ───────────────────────────────────────────────────────────

// react-router-dom: override useNavigate.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// user-store: minimal fake user.
vi.mock('../stores/user-store', () => ({
  useUserStore: (selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'fake-user-id' } }),
}));

// data.ts: mock upsertUserProfile + generateJobFollowup + pickLivedIcons +
// generateLivedIconImage. The latter two are fired-and-forgotten in
// finish(); default-resolve so tests don't need per-test setup unless they
// specifically exercise the icon paths.
const mockUpsertUserProfile = vi.fn();
const mockGenerateJobFollowup = vi.fn();
const mockPickLivedIcons = vi.fn(async () => [] as string[]);
// B+1.14 — generateLivedIconImage. Default to a fallback shape so the
// fire-and-forget call resolves without affecting test outcomes.
const mockGenerateLivedIconImage = vi.fn(async () => ({
  url: null as string | null,
  motifs: [] as string[],
  isFallback: true as boolean,
}));
vi.mock('../lib/data', () => ({
  upsertUserProfile: (...args: unknown[]) => mockUpsertUserProfile(...args),
  generateJobFollowup: (...args: unknown[]) => mockGenerateJobFollowup(...args),
  pickLivedIcons: (...args: unknown[]) => mockPickLivedIcons(...args),
  generateLivedIconImage: (...args: unknown[]) => mockGenerateLivedIconImage(...args),
}));

// onboarding-session: no-op.
vi.mock('../lib/onboarding-session', () => ({
  markProfileStepSeen: vi.fn(),
}));

// interest-dictionary: no suggestions needed.
vi.mock('../lib/interest-dictionary', () => ({
  searchInterests: vi.fn(() => []),
}));

import OnboardingProfile from './onboarding-profile';

// ── Render ────────────────────────────────────────────────────────────────

function renderWizard() {
  return render(
    <MemoryRouter>
      <OnboardingProfile />
    </MemoryRouter>,
  );
}

// ── Selectors ─────────────────────────────────────────────────────────────

/**
 * Get the primary CTA button from the <footer> landmark.
 * The footer contains exactly one primary button (next / finish / fill in or skip)
 * plus optionally the "skip this →" secondary button.
 * Selecting within <footer> avoids collision with domain card buttons.
 */
function getNextButton(): HTMLElement {
  const footer = document.querySelector('footer');
  if (!footer) throw new Error('<footer> not found in document');
  const btns = within(footer as HTMLElement).getAllByRole('button');
  // The primary button is the FIRST button in the footer (skip is second).
  return btns[0];
}

function getSkipButton(): HTMLElement | null {
  const footer = document.querySelector('footer');
  if (!footer) return null;
  return within(footer as HTMLElement).queryByText('skip this →') as HTMLElement | null;
}

function getBackButton(): HTMLElement | null {
  return screen.queryByRole('button', { name: 'back' });
}

function getSegments(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /jump to step/i }) as HTMLElement[];
}

function clickNext() {
  fireEvent.click(getNextButton());
}

function clickSkip() {
  const btn = getSkipButton();
  if (!btn) throw new Error('Skip button not found on this step');
  fireEvent.click(btn);
}

function clickBack() {
  const btn = getBackButton();
  if (!btn) throw new Error('Back button not found — already on step 1?');
  fireEvent.click(btn);
}

/**
 * Advance `n` steps via the primary CTA. Each targeted step must already
 * have NEXT enabled. On job step with an empty value, the advance handler
 * returns false, so goNext falls through to gotoStep — this means an
 * empty job step IS advanceable (nextEnabled check guards the button
 * but here we call clickNext regardless; use only when button is enabled).
 */
function advanceSteps(n: number) {
  for (let i = 0; i < n; i++) {
    clickNext();
  }
}

/**
 * Skip or (for domain, which has no skip) click next, for `n` steps.
 */
function skipThroughSteps(n: number) {
  for (let i = 0; i < n; i++) {
    const skip = getSkipButton();
    if (skip) {
      fireEvent.click(skip);
    } else {
      clickNext();
    }
  }
}

// ── Test defaults ─────────────────────────────────────────────────────────

beforeEach(() => {
  // Vitest 4: mock call history persists across `it` blocks unless cleared.
  // Assertions that use mock.calls[0] or toHaveBeenCalledTimes(1) need a fresh slate.
  mockUpsertUserProfile.mockClear();
  mockUpsertUserProfile.mockResolvedValue({ user_id: 'fake-user-id' });
  mockGenerateJobFollowup.mockResolvedValue({ question: '', chips: [], isFallback: true });
  mockNavigate.mockReset();
});

// ── 1. hasValue() — domain step (step 1, index 0) ────────────────────────

describe('hasValue — domain step (step 1)', () => {
  it('CTA is enabled on mount (pre-selected coding default)', () => {
    renderWizard();
    expect(getNextButton()).not.toBeDisabled();
  });

  it('CTA reads "next →" on the domain step', () => {
    renderWizard();
    expect(getNextButton().textContent).toBe('next →');
  });

  it('skip button is absent on the domain step', () => {
    renderWizard();
    expect(getSkipButton()).toBeNull();
  });
});

// ── 2. hasValue() — why step (step 3, index 2) ────────────────────────────

describe('hasValue — why step (step 3)', () => {
  beforeEach(() => {
    renderWizard();
    advanceSteps(1);  // domain → display_name (skip or next)
    clickSkip();      // display_name → why
    // Now on why (index 2).
  });

  it('CTA is disabled when textarea is empty', () => {
    expect(getNextButton()).toBeDisabled();
  });

  it('CTA reads "fill in or skip" when textarea is empty', () => {
    expect(getNextButton().textContent).toBe('fill in or skip');
  });

  it('CTA becomes enabled after typing in textarea', () => {
    const textarea = screen.getByPlaceholderText(/e\.g\. i want to follow/i);
    fireEvent.change(textarea, { target: { value: 'I want to follow Claude Code' } });
    expect(getNextButton()).not.toBeDisabled();
  });

  it('CTA reads "next →" after typing', () => {
    const textarea = screen.getByPlaceholderText(/e\.g\. i want to follow/i);
    fireEvent.change(textarea, { target: { value: 'motivation text' } });
    expect(getNextButton().textContent).toBe('next →');
  });

  it('CTA stays disabled with whitespace-only input', () => {
    const textarea = screen.getByPlaceholderText(/e\.g\. i want to follow/i);
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(getNextButton()).toBeDisabled();
  });
});

// ── 3. hasValue() — display_name step (step 2, index 1) ──────────────────

describe('hasValue — display_name step (step 2)', () => {
  beforeEach(() => {
    renderWizard();
    advanceSteps(1); // domain → display_name
  });

  it('CTA is disabled when name field is empty', () => {
    expect(getNextButton()).toBeDisabled();
  });

  it('CTA becomes enabled after typing a name', () => {
    // The display_name input has a placeholder containing "Kevin" or similar.
    // Find the first visible input in main content.
    const input = document.querySelector('main input, main textarea') as HTMLInputElement | null;
    if (!input) throw new Error('display_name input not found');
    fireEvent.change(input, { target: { value: 'Kevin' } });
    expect(getNextButton()).not.toBeDisabled();
  });
});

// ── 4. Review step (step 10, index 9) ────────────────────────────────────

describe('hasValue — review step (step 10)', () => {
  beforeEach(() => {
    renderWizard();
    advanceSteps(1);      // domain → display_name
    skipThroughSteps(8);  // display_name through background → review
  });

  it('CTA reads "finish" on review step', () => {
    expect(getNextButton().textContent).toBe('finish');
  });

  it('CTA is enabled on review step', () => {
    expect(getNextButton()).not.toBeDisabled();
  });

  it('skip button is absent on the review step', () => {
    expect(getSkipButton()).toBeNull();
  });

  it('step counter reads "step 10 of 10"', () => {
    expect(screen.getByText(/step 10 of 10/i)).toBeInTheDocument();
  });
});

// ── 5. Skip semantics ─────────────────────────────────────────────────────

describe('skip semantics', () => {
  it('skipping "why" clears textarea when navigating back', () => {
    renderWizard();
    advanceSteps(1); // → display_name
    clickSkip();     // → why

    const textarea = screen.getByPlaceholderText(/e\.g\. i want to follow/i);
    fireEvent.change(textarea, { target: { value: 'blah blah' } });
    expect(textarea).toHaveValue('blah blah');

    // Skip → job.
    clickSkip();
    // Navigate back → why.
    clickBack();

    const textareaAgain = screen.getByPlaceholderText(/e\.g\. i want to follow/i);
    expect(textareaAgain).toHaveValue('');
  });

  it('after skipping "why" and navigating back, CTA is enabled (skipped flag preserved)', () => {
    renderWizard();
    advanceSteps(1); // → display_name
    clickSkip();     // → why
    clickSkip();     // → job
    clickBack();     // → why

    // Textarea is empty but skipped → NEXT should be enabled.
    expect(getNextButton()).not.toBeDisabled();
    expect(getNextButton().textContent).toBe('next →');
  });

  it('skip advances to the next step', () => {
    renderWizard();
    advanceSteps(1); // → display_name (step 2)
    expect(screen.getByText(/step 2 of 10/i)).toBeInTheDocument();

    clickSkip(); // → why (step 3)
    expect(screen.getByText(/step 3 of 10/i)).toBeInTheDocument();
  });
});

// ── 6. Progress-bar step jumping ──────────────────────────────────────────

describe('progress bar jump logic', () => {
  /**
   * Reach step at `targetIndex` (0-based) by advancing past domain,
   * then skipping the rest.
   */
  function skipToStepIndex(targetIndex: number) {
    renderWizard();
    if (targetIndex === 0) return;
    advanceSteps(1);                     // domain → display_name
    skipThroughSteps(targetIndex - 1);   // skip the rest
  }

  it('at step 5 (index 4), tapping segment 2 (index 1) navigates back to step 2', () => {
    skipToStepIndex(4); // reach step 5 = encounter
    expect(screen.getByText(/step 5 of 10/i)).toBeInTheDocument();

    const segs = getSegments();
    fireEvent.click(segs[1]); // jump to display_name (index 1 = step 2)
    expect(screen.getByText(/step 2 of 10/i)).toBeInTheDocument();
  });

  it('at step 5 (index 4), segment 7 (index 6) is disabled — forward jump blocked', () => {
    skipToStepIndex(4); // maxReached = 4

    const segs = getSegments();
    // Index 6 = heritage, not yet reached → disabled.
    expect(segs[6]).toBeDisabled();
  });

  it('clicking a disabled forward segment does not change the step', () => {
    skipToStepIndex(4);

    const segs = getSegments();
    fireEvent.click(segs[6]); // disabled — jumpToStep returns early
    expect(screen.getByText(/step 5 of 10/i)).toBeInTheDocument();
  });

  it('after reaching review (step 10) then back-jumping to step 2, segment 9 (index 8) is enabled', () => {
    skipToStepIndex(9); // reach review (index 9), maxReached = 9
    expect(screen.getByText(/step 10 of 10/i)).toBeInTheDocument();

    const segs = getSegments();
    fireEvent.click(segs[1]); // jump back to display_name (index 1)
    expect(screen.getByText(/step 2 of 10/i)).toBeInTheDocument();

    // Segment 9 (index 8 = background) should be enabled (within maxReached).
    const segsNow = getSegments();
    expect(segsNow[8]).not.toBeDisabled();
  });
});

// ── 7. finish() payload shape ─────────────────────────────────────────────

describe('finish() payload shape', () => {
  /**
   * Navigate to review and click "finish". Optionally fill in the "why" step.
   * Returns after upsertUserProfile resolves.
   */
  async function runWizardToFinish(opts: { whyText?: string } = {}) {
    renderWizard();

    // Step 1 (domain) — default coding, click next.
    advanceSteps(1); // → display_name

    // Step 2 (display_name) — skip.
    clickSkip(); // → why

    // Step 3 (why) — fill or skip.
    if (opts.whyText && opts.whyText.trim()) {
      const textarea = screen.getByPlaceholderText(/e\.g\. i want to follow/i);
      fireEvent.change(textarea, { target: { value: opts.whyText } });
      advanceSteps(1); // enabled now → job
    } else {
      clickSkip(); // → job
    }

    // Steps 4-9 (job → background) — skip each.
    skipThroughSteps(6);

    // Step 10 (review) — click finish.
    expect(getNextButton().textContent).toBe('finish');
    fireEvent.click(getNextButton());

    await waitFor(() => {
      expect(mockUpsertUserProfile).toHaveBeenCalled();
    });
  }

  it('calls upsertUserProfile with the correct user id', async () => {
    await runWizardToFinish();
    expect(mockUpsertUserProfile).toHaveBeenCalledWith('fake-user-id', expect.any(Object));
  });

  it('active_domain is "coding" (live default via pickableDomain)', async () => {
    await runWizardToFinish();
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.active_domain).toBe('coding');
  });

  it('personalization_enabled is true', async () => {
    await runWizardToFinish();
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.personalization_enabled).toBe(true);
  });

  it('goals_freeform is null when why step was skipped', async () => {
    await runWizardToFinish({ whyText: '' });
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.goals_freeform).toBeNull();
  });

  it('goals_freeform is trimmed when filled', async () => {
    await runWizardToFinish({ whyText: '  i want to learn  ' });
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.goals_freeform).toBe('i want to learn');
  });

  it('display_name is null when display_name step was skipped', async () => {
    await runWizardToFinish();
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.display_name).toBeNull();
  });

  it('job is null when job step was skipped', async () => {
    await runWizardToFinish();
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.job).toBeNull();
  });

  it('interests is empty array when interests step was skipped', async () => {
    await runWizardToFinish();
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.interests).toEqual([]);
  });

  it('encounter_contexts is empty array when encounter step was skipped', async () => {
    await runWizardToFinish();
    const [, patch] = mockUpsertUserProfile.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.encounter_contexts).toEqual([]);
  });

  it('navigates to /home with replace:true after successful finish', async () => {
    await runWizardToFinish();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
  });
});

// ── 8. StepJob race condition (B+1.10 cancel-on-back fix) ────────────────

describe('StepJob cancel-on-back race condition', () => {
  it('navigating back while fetching prevents stale onFollowupAdvance from advancing the wizard', async () => {
    // generateJobFollowup hangs — we control when it resolves.
    let resolveFollowup!: (v: { question: string; chips: string[]; isFallback?: boolean }) => void;
    const hangingPromise = new Promise<{ question: string; chips: string[] }>((res) => {
      resolveFollowup = res;
    });
    mockGenerateJobFollowup.mockReturnValue(hangingPromise);

    renderWizard();

    // domain → display_name (skip) → why (skip) → job (step 4, index 3).
    advanceSteps(1); // → display_name
    clickSkip();     // → why
    clickSkip();     // → job
    expect(screen.getByText(/step 4 of 10/i)).toBeInTheDocument();

    // Type a job value and click next — triggers the advance handler which
    // starts the fetch (phase: fetching). The button is enabled because
    // the job field has content.
    const jobTextarea = screen.getByPlaceholderText(/regional operations/i);
    fireEvent.change(jobTextarea, { target: { value: 'Regional operations manager' } });
    clickNext(); // triggers fetching phase

    // Spinner appears.
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Navigate back while fetching — triggers jobAdvanceSeqOnBackRef.current().
    clickBack();

    // Now on step 3 (why, index 2).
    expect(screen.getByText(/step 3 of 10/i)).toBeInTheDocument();

    // Resolve the hanging promise with a real followup AFTER back navigation.
    await act(async () => {
      resolveFollowup({ question: 'Which specialty?', chips: ['retail', 'clinical', 'other'] });
    });

    // The wizard must remain on step 3 — cancel-on-back bumped the seq,
    // so onFollowupAdvance is a no-op. Without the fix it would jump to step 5.
    expect(screen.getByText(/step 3 of 10/i)).toBeInTheDocument();
    expect(screen.queryByText('retail')).not.toBeInTheDocument();
  });
});

// ── 9. Double-tap guard on finish ────────────────────────────────────────

describe('double-tap guard', () => {
  it('tapping finish twice only calls upsertUserProfile once', async () => {
    // upsertUserProfile hangs — gives us a window to double-click during in-flight.
    mockUpsertUserProfile.mockReturnValue(new Promise(() => {}));

    renderWizard();

    // Skip to review.
    advanceSteps(1);    // domain → display_name
    skipThroughSteps(8); // display_name through background → review

    expect(getNextButton().textContent).toBe('finish');

    // Rapid double-click.
    fireEvent.click(getNextButton());
    fireEvent.click(getNextButton());

    await waitFor(() => {
      expect(mockUpsertUserProfile).toHaveBeenCalledTimes(1);
    });
  });
});
