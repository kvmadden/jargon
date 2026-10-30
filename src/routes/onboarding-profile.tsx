import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { ErrorBoundary } from './error-boundary';
import {
  upsertUserProfile,
  generateJobFollowup,
  pickLivedIcons,
  generateLivedIconImage,
} from '../lib/data';
import type { JobFollowup } from '../lib/data';
import { markProfileStepSeen } from '../lib/onboarding-session';
import { searchInterests } from '../lib/interest-dictionary';
import { Wordmark } from '../components/wordmark';
import {
  ONBOARDING_DOMAIN_OPTIONS,
  isLiveDomainOption,
  pickableDomain,
  onboardingIconUrl,
  DEFAULT_DOMAIN,
  type OnboardingDomainOption,
} from '../lib/domains';

/**
 * Onboarding profile wizard — Stage B+1.10 redesign.
 *
 * Replaces the B+1.2 wizard. Five behavioral changes from the prior version:
 *
 *   1. NEW step 1 — domain selection. Shows every domain jargon plans to
 *      teach (coding live; ai/excel/microsoft-365/power-platform marked
 *      "soon"). Coming-soon cards are visible but disabled — users see
 *      the trajectory, not just what's available today.
 *
 *   2. "what brings you to jargon?" became a freeform textarea (was a
 *      chip multi-select). Captured in `goals_freeform` (added in
 *      cloud-migration-028); legacy `goals_extended` chip array is no
 *      longer written from this surface.
 *
 *   3. NEXT is gated — disabled until the current step has a value OR the
 *      user has explicitly tapped SKIP. SKIP always works on every step.
 *      Domain step's skip = default to coding (the default that's been
 *      there all along, just now explicit).
 *
 *   4. Step jumping — past-step segments in the progress bar are tappable
 *      to return to that step. Forward jumping isn't allowed except via
 *      the review screen's per-line edit buttons (forces sequential first
 *      pass, free-form second pass).
 *
 *   5. NEW final step — review. Lists every answer with an "edit" link
 *      that jumps back to the relevant step. Bottom CTA "finish" upserts
 *      and navigates to /home.
 *
 * Steps (indexed by STEP_IDS — the numeric step number is just the index):
 *   1.  domain                — `active_domain` (and indirectly `home_domain`)
 *   2.  display_name          — what should I call you? (B+1.10 / display_name push)
 *   3.  why (freeform)        — `goals_freeform`
 *   4.  job                   — `job` (with in-place follow-up flow)
 *   5.  encounter contexts    — `encounter_contexts`
 *   6.  interests             — `interests`
 *   7.  heritage              — `heritage`
 *   8.  roles                 — `roles`
 *   9.  background            — `background_text`
 *   10. review                — no field, just a summary surface
 *
 * Storage: every step writes via `upsertUserProfile` only on `finish` (final
 * step's "finish" CTA). The wizard holds state in memory until then. Skip
 * leaves a field at its DB default. Even a fully-skipped run still writes a
 * row with the picked domain + `personalization_enabled: true`.
 *
 * NOTE on display_name: capitalization is preserved verbatim. The CTA never
 * lower-cases or capitalizes the typed value. Display_name is the second
 * step (right after domain pick) so it's available before any greeting
 * surface needs it. Skipping leaves display_name null — greetings fall
 * back to email-prefix or "friend".
 */

type StepId =
  | 'domain'
  | 'display_name'
  | 'why'
  | 'job'
  | 'encounter'
  | 'interests'
  | 'heritage'
  | 'roles'
  | 'background'
  | 'review';

const STEP_IDS: StepId[] = [
  'domain',
  'display_name',
  'why',
  'job',
  'encounter',
  'interests',
  'heritage',
  'roles',
  'background',
  'review',
];

const TOTAL_STEPS = STEP_IDS.length;

interface WizardAnswers {
  /** OnboardingDomainOption.id — could be a coming-soon id; resolved at write time. */
  domain_pick: string;
  /** B+1.10 — preferred display name. Capitalization preserved verbatim. */
  display_name: string;
  goals_freeform: string;
  job: string;
  encounter_contexts: string[];
  interests: string[];
  heritage: string;
  roles: string[];
  background_text: string;
}

const EMPTY_ANSWERS: WizardAnswers = {
  domain_pick: 'coding', // pre-selected default; user can change before tapping next
  display_name: '',
  goals_freeform: '',
  job: '',
  encounter_contexts: [],
  interests: [],
  heritage: '',
  roles: [],
  background_text: '',
};

// Tracks which steps the user explicitly skipped (vs. left empty by accident).
// Empty + skipped = OK to advance; empty + not-skipped = NEXT disabled.
type SkippedSet = Partial<Record<StepId, true>>;

const ENCOUNTER_OPTIONS = [
  'Claude Code in my own projects',
  'Slack at work',
  'tech podcasts',
  'family/friends',
  'news articles',
  'job listings',
  'nowhere yet — fresh start',
];

const ROLE_OPTIONS = [
  'parent',
  'grandparent',
  'partner',
  'manager',
  'mentor',
  'student',
  'immigrant',
  'veteran',
  'caretaker',
  'freelancer',
  'entrepreneur',
  'other',
];

const MAX_BACKGROUND_CHARS = 500;
const MAX_HERITAGE_CHARS = 120;
const MAX_GOALS_FREEFORM_CHARS = 500;
// B+1.10 — display_name cap. Short names; longer is paste accident or test.
const MAX_DISPLAY_NAME_CHARS = 80;

// ────────────────────────────────────────────────────────────
// Gating: does the current step have a value the user filled in?
// ────────────────────────────────────────────────────────────

function hasValue(stepId: StepId, answers: WizardAnswers): boolean {
  switch (stepId) {
    case 'domain':
      // Domain pre-selects to 'coding' so it always has a value. Returning
      // true here means NEXT is always enabled on the domain step — the
      // user can tap right through accepting the default, OR pick another
      // live domain, OR skip (skip behaves the same as accepting default).
      return answers.domain_pick.length > 0;
    case 'display_name':
      // Trim only for the gating check; the persisted value preserves any
      // surrounding spaces only if there are non-space chars on either side
      // (the input itself trims at finish-time only).
      return answers.display_name.trim().length > 0;
    case 'why':
      return answers.goals_freeform.trim().length > 0;
    case 'job':
      return answers.job.trim().length > 0;
    case 'encounter':
      return answers.encounter_contexts.length > 0;
    case 'interests':
      return answers.interests.length > 0;
    case 'heritage':
      return answers.heritage.trim().length > 0;
    case 'roles':
      return answers.roles.length > 0;
    case 'background':
      return answers.background_text.trim().length > 0;
    case 'review':
      // Review has no field — NEXT is always enabled (becomes "finish").
      return true;
  }
}

// ────────────────────────────────────────────────────────────
// Step labels for the review screen + progress aria-labels
// ────────────────────────────────────────────────────────────

function stepLabel(stepId: StepId): string {
  switch (stepId) {
    case 'domain':         return 'starting domain';
    case 'display_name':   return 'what to call you';
    case 'why':            return 'why jargon';
    case 'job':            return 'your work';
    case 'encounter':      return 'where you run into these terms';
    case 'interests':      return 'what you’re into';
    case 'heritage':       return 'where you’re from';
    case 'roles':          return 'roles that define you';
    case 'background':     return 'anything else';
    case 'review':         return 'review';
  }
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function OnboardingProfile() {
  return (
    <ErrorBoundary>
      <OnboardingProfileContent />
    </ErrorBoundary>
  );
}

function OnboardingProfileContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_ANSWERS);
  const [skipped, setSkipped] = useState<SkippedSet>({});
  /** Highest step the user has reached forward (controls progress-bar tap-to-jump). */
  const [maxReached, setMaxReached] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [busy, setBusy] = useState(false);

  // Step 3 (job) keeps its own in-place follow-up flow. The wizard hands it
  // a registerAdvanceHandler so footer-NEXT can route through StepJob's
  // handler when in flight. Same pattern as the prior wizard — preserved
  // verbatim because the behavior is non-trivial and well-tested.
  const jobAdvanceHandlerRef = useRef<(() => boolean) | null>(null);
  // B+1.10 — companion ref StepJob registers, lets the wizard cancel the
  // in-flight Opus follow-up when the user navigates back during fetch.
  // Without this, the late async resolution would call onFollowupAdvance
  // with a stale stepIndex closure and jump the user forward from the
  // wrong step.
  const jobAdvanceSeqOnBackRef = useRef<(() => void) | null>(null);

  const stepId = STEP_IDS[stepIndex];

  function patch<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function gotoStep(targetIndex: number, dir: 'forward' | 'back') {
    setDirection(dir);
    setStepIndex(targetIndex);
    setMaxReached((m) => Math.max(m, targetIndex));
  }

  function goNext() {
    if (busy) return;
    // Job step has an in-place follow-up — let it intercept.
    if (stepId === 'job' && jobAdvanceHandlerRef.current?.()) return;
    if (stepIndex === TOTAL_STEPS - 1) {
      void finish();
      return;
    }
    gotoStep(stepIndex + 1, 'forward');
  }

  function goBack() {
    if (busy || stepIndex === 0) return;
    // BLOCKER FIX (B+1.10 reviewer Blocker 2): if the user is on the job step
    // with an in-flight `generateJobFollowup` request, hitting Back must
    // cancel the request — otherwise when it resolves it calls `onFollowupAdvance`
    // with a stale closure that advances the user one step from where they
    // ARE (which is now `step - 1`, not `step`). Bumping the seq invalidates
    // the in-flight handler. The StepJob component watches `requestSeqRef`
    // already — see StepJob's own `handleEdit` at the bottom of this file.
    if (stepId === 'job') {
      jobAdvanceSeqOnBackRef.current?.();
    }
    gotoStep(stepIndex - 1, 'back');
  }

  function jumpToStep(targetIndex: number) {
    if (busy || targetIndex === stepIndex) return;
    // Allow jumping to any step the user has previously reached; forward-only
    // jumps from review (handled by the review screen's edit buttons, which
    // pass any index in the past as targetIndex < stepIndex).
    if (targetIndex > maxReached) return;
    gotoStep(targetIndex, targetIndex < stepIndex ? 'back' : 'forward');
  }

  function skipStep() {
    if (busy) return;
    // Mark this step as explicitly skipped (in case the user comes back).
    // Reset the field so the next person to tap "back" sees a clean slate.
    setSkipped((prev) => ({ ...prev, [stepId]: true }));
    if (stepId === 'display_name') patch('display_name', '');
    if (stepId === 'why')          patch('goals_freeform', '');
    if (stepId === 'job')          patch('job', '');
    if (stepId === 'encounter')    patch('encounter_contexts', []);
    if (stepId === 'interests')    patch('interests', []);
    if (stepId === 'heritage')     patch('heritage', '');
    if (stepId === 'roles')        patch('roles', []);
    if (stepId === 'background')   patch('background_text', '');
    // Domain skip = stay on default 'coding' (no reset needed).
    if (stepIndex === TOTAL_STEPS - 1) {
      void finish();
      return;
    }
    gotoStep(stepIndex + 1, 'forward');
  }

  async function finish() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const resolvedDomain = pickableDomain(answers.domain_pick);
      // B+1.10 / display_name: trim ONLY for empty-collapse — the persisted
      // value preserves the user's exact capitalization. Whitespace at the
      // edges is the only thing we strip.
      const trimmedDisplayName = answers.display_name.trim();
      const profilePatch = {
        active_domain: resolvedDomain,
        // home_domain stays at its DB default ('coding') for now — the
        // distinction matters only when home is a real lived-in domain
        // (pharmacy, law, etc.). Until those ship, home == active is fine.
        display_name: trimmedDisplayName || null,
        job: answers.job.trim() || null,
        interests: answers.interests,
        heritage: answers.heritage.trim() || null,
        roles: answers.roles,
        background_text: answers.background_text.trim() || null,
        goals_freeform: answers.goals_freeform.trim() || null,
        encounter_contexts: answers.encounter_contexts,
        personalization_enabled: true,
      };
      await upsertUserProfile(user.id, profilePatch);
      markProfileStepSeen(user.id);
      // B+1.11 — fire pickLivedIcons in the background (does NOT block
      // navigation). Opus picks 1-3 Phosphor slugs for the FALLBACK
      // strip path; the result lands via a follow-up upsert. Failure
      // path is a silent empty array — the strip just doesn't render.
      const userId = user.id;
      void (async () => {
        const slugs = await pickLivedIcons(profilePatch);
        if (slugs.length === 0) return;
        try {
          await upsertUserProfile(userId, { lived_icons: slugs });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[onboarding-profile] lived_icons upsert failed', err);
        }
      })();
      // B+1.14 — fire generateLivedIconImage in parallel. Opus + Gemini
      // produce a single circular AI badge that combines 2-3 motifs into
      // one piece of flat-art (the primary render path; strip stays as
      // fallback). The Edge Function persists the URL to
      // user_profile.lived_icon_url itself, so we don't need a follow-up
      // upsertUserProfile call. Generation takes 5-15s — fire-and-forget
      // so the user lands on /home immediately and the badge crossfades
      // in on the next mount.
      void generateLivedIconImage(profilePatch);
      navigate('/home', { replace: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[onboarding-profile] finish failed', err);
      setBusy(false);
    }
  }

  // ── Derive footer state from the current step ─────────────────────────────
  const filled = hasValue(stepId, answers);
  const wasSkipped = skipped[stepId] === true;
  // NEXT is enabled when:
  //   - We're on domain (always — has a default selection)
  //   - We're on review (becomes "finish")
  //   - The user has typed/selected something
  //   - The user explicitly skipped this step earlier (and hasn't filled it yet)
  const nextEnabled = stepId === 'domain' || stepId === 'review' || filled || wasSkipped;
  const isReviewStep = stepId === 'review';
  const isFinalSubmit = isReviewStep;
  const ctaCopy = busy
    ? 'saving…'
    : isFinalSubmit
      ? 'finish'
      : filled || wasSkipped || stepId === 'domain'
        ? 'next →'
        : 'fill in or skip';

  return (
    <div className="h-screen flex flex-col bg-bg-base safe-top safe-bottom overflow-hidden">
      {/* Header — wordmark + back link (hidden on step 1).
          Inner wrapper anchors to body's max-w column so chrome doesn't
          orphan at the screen edges on tablet/desktop. */}
      <header className="px-4 py-4 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between min-h-[44px]">
          <Wordmark size={20} showDot />
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={busy}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary text-sm lowercase active:text-text-primary transition-colors disabled:opacity-60"
              aria-label="back"
            >
              ‹ back
            </button>
          )}
        </div>
      </header>

      {/* Step indicator — segments are tappable to jump back. Forward jumps
          past `maxReached` are blocked (forces a sequential first pass). */}
      <div className="px-4 pt-2 pb-4 shrink-0 max-w-md mx-auto w-full">
        <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2">
          step {stepIndex + 1} of {TOTAL_STEPS}
        </p>
        {/* 44px-floor mechanics (visual-qa touch-target invariant): each
            button IS the hit area — 44px tall (h-[44px] + my-[-20px] keeps
            the row's flow height at the original 4px) and slot+20px wide
            (mx-[-10px]; the row's matched px-[10px]/mx-[-10px] pair absorbs
            the end-button bleed so nothing overflows the row's padding box).
            The visible 4px bar is the ::after, inset back to the exact old
            slot geometry — rendered design unchanged. Expansion is mostly
            vertical on purpose: sideways bleed stays 10px so adjacent dots
            keep their taps (in the overlap strips the later dot wins). */}
        <div className="flex gap-1 mx-[-10px] px-[10px]">
          {STEP_IDS.map((id, i) => {
            const reached = i <= maxReached;
            const isCurrent = i === stepIndex;
            const isPast = i < stepIndex;
            const tappable = reached && i !== stepIndex && !busy;
            return (
              <button
                key={id}
                type="button"
                onClick={() => jumpToStep(i)}
                disabled={!tappable}
                aria-label={`jump to step ${i + 1}: ${stepLabel(id)}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'relative flex-1 h-[44px] my-[-20px] mx-[-10px]',
                  // Keyboard focus ring hugs the visible bar, not the
                  // invisible 44px hit box (mouse/touch never see it).
                  'focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent-jargon-hi',
                  "after:content-[''] after:absolute after:inset-x-[10px] after:inset-y-[20px] after:rounded-full after:transition-colors",
                  // Visual: filled when reached or current; outline-only when future
                  isPast || isCurrent
                    ? 'after:bg-accent-jargon'
                    : reached
                      ? 'after:bg-accent-jargon-lo'
                      : 'after:bg-border-default',
                  // Touch affordance — hover feedback stays on the visible bar
                  tappable
                    ? 'cursor-pointer hover:after:opacity-80'
                    : 'cursor-default',
                ].join(' ')}
              />
            );
          })}
        </div>
      </div>

      {/* Step body */}
      <main className="flex-1 px-4 max-w-md mx-auto w-full flex flex-col overflow-hidden">
        <StepFrame key={stepId} direction={direction}>
          {stepId === 'domain' && (
            <StepDomain
              value={answers.domain_pick}
              onChange={(v) => patch('domain_pick', v)}
            />
          )}
          {stepId === 'display_name' && (
            <StepDisplayName
              value={answers.display_name}
              onChange={(v) => patch('display_name', v)}
            />
          )}
          {stepId === 'why' && (
            <StepWhyFreeform
              value={answers.goals_freeform}
              onChange={(v) => patch('goals_freeform', v)}
            />
          )}
          {stepId === 'job' && (
            <StepJob
              value={answers.job}
              onChange={(v) => patch('job', v)}
              registerAdvanceHandler={(fn) => {
                jobAdvanceHandlerRef.current = fn;
              }}
              registerCancelOnBack={(fn) => {
                jobAdvanceSeqOnBackRef.current = fn;
              }}
              onFollowupAdvance={(finalJob) => {
                patch('job', finalJob);
                gotoStep(stepIndex + 1, 'forward');
              }}
            />
          )}
          {stepId === 'encounter' && (
            <StepEncounter
              value={answers.encounter_contexts}
              onChange={(v) => patch('encounter_contexts', v)}
            />
          )}
          {stepId === 'interests' && (
            <StepInterests
              value={answers.interests}
              onChange={(v) => patch('interests', v)}
            />
          )}
          {stepId === 'heritage' && (
            <StepHeritage
              value={answers.heritage}
              onChange={(v) => patch('heritage', v)}
            />
          )}
          {stepId === 'roles' && (
            <StepRoles
              value={answers.roles}
              onChange={(v) => patch('roles', v)}
            />
          )}
          {stepId === 'background' && (
            <StepBackground
              value={answers.background_text}
              onChange={(v) => patch('background_text', v)}
            />
          )}
          {stepId === 'review' && (
            <StepReview
              answers={answers}
              skipped={skipped}
              onEdit={(targetStepId) => {
                const idx = STEP_IDS.indexOf(targetStepId);
                if (idx >= 0) gotoStep(idx, 'back');
              }}
            />
          )}
        </StepFrame>
      </main>

      {/* Footer — primary CTA + skip link */}
      <footer className="px-4 pt-4 pb-4 shrink-0 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={goNext}
          disabled={busy || !nextEnabled}
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 active:bg-accent-jargon-lo transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {ctaCopy}
        </button>
        {/* Skip is hidden on review (the CTA there is "finish") and on
            domain (a default is already in place — "next" IS the skip). */}
        {/* POLISH (B+1.10 designer P4): bumped from text-2xs (11px, fine-print
            legalese) to text-xs (12px, still secondary but readable). Removed
            underline — the position + arrow carry enough affordance. Wider
            px-4 hit area so a thumb tap lands. */}
        {stepId !== 'review' && stepId !== 'domain' && (
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={skipStep}
              disabled={busy}
              className="text-xs lowercase text-text-muted min-h-[44px] px-4 active:text-text-secondary transition-colors disabled:opacity-60"
            >
              skip this →
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Step frame (per-step slide animation)
// ────────────────────────────────────────────────────────────

interface StepFrameProps {
  direction: 'forward' | 'back';
  children: React.ReactNode;
}

function StepFrame({ direction, children }: StepFrameProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const initial = direction === 'forward' ? 'translateX(20px)' : 'translateX(-20px)';
  return (
    <div
      className="flex-1 flex flex-col overflow-y-auto"
      style={{
        transform: mounted ? 'translateX(0)' : initial,
        opacity: mounted ? 1 : 0,
        transition: 'transform 200ms ease-out, opacity 200ms ease-out',
      }}
    >
      {children}
    </div>
  );
}

interface StepHeadingProps {
  title: string;
  helper?: string;
}

function StepHeading({ title, helper }: StepHeadingProps) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold text-text-primary lowercase leading-snug">
        {title}
      </h2>
      {helper && (
        <p className="text-sm text-text-secondary mt-2 leading-relaxed">{helper}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Step 1 — DOMAIN (NEW B+1.10)
// ────────────────────────────────────────────────────────────

interface StepDomainProps {
  value: string;
  onChange: (next: string) => void;
}

function StepDomain({ value, onChange }: StepDomainProps) {
  return (
    <>
      <StepHeading
        title="which world are you learning?"
        helper="pick the domain you want to speak. you can switch any time."
      />
      <div className="flex flex-col gap-3 pb-4">
        {ONBOARDING_DOMAIN_OPTIONS.map((opt) => (
          <DomainOptionCard
            key={opt.id}
            option={opt}
            selected={value === opt.id}
            onPick={() => isLiveDomainOption(opt) && onChange(opt.id)}
          />
        ))}
      </div>
    </>
  );
}

interface DomainOptionCardProps {
  option: OnboardingDomainOption;
  selected: boolean;
  onPick: () => void;
}

function DomainOptionCard({ option, selected, onPick }: DomainOptionCardProps) {
  const live = isLiveDomainOption(option);
  const iconState: 'soon' | 'selected' | 'available' = !live
    ? 'soon'
    : selected
      ? 'selected'
      : 'available';
  const url = onboardingIconUrl(option, iconState);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!live}
      aria-pressed={selected}
      aria-disabled={!live}
      className={[
        'relative w-full text-left rounded-lg p-4 min-h-[80px]',
        'flex items-center gap-3',
        'border transition-colors',
        !live
          ? 'bg-surface-card border-border-default opacity-60 cursor-not-allowed'
          : selected
            ? 'bg-accent-jargon/[0.12] border-accent-jargon'
            : 'bg-surface-card border-border-default active:bg-surface-card-hi',
      ].join(' ')}
    >
      <img
        src={url}
        alt=""
        width={32}
        height={32}
        className="shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-base font-semibold leading-tight ${live ? 'text-text-primary' : 'text-text-secondary'}`}>
          {option.label}
        </p>
        {/* Soon-note moves UP for "soon" cards (right under the label) so
            the lock state is read immediately. Tagline still renders below. */}
        {!live && option.soonNote && (
          <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mt-1">
            {option.soonNote}
          </p>
        )}
        <p className="text-xs text-text-muted leading-snug mt-1">
          {option.tagline}
        </p>
      </div>
      {selected && live && (
        <span aria-hidden="true" className="shrink-0 text-accent-jargon-hi text-base font-mono">
          ✓
        </span>
      )}
      {/* "Soon" lock pill — visible affordance that tapping is intentionally
          blocked, vs. the prior opacity-only treatment that read as "broken."
          Top-right matches where the ✓ goes for selected cards. */}
      {!live && (
        <span
          aria-hidden="true"
          className="absolute top-2 right-3 text-2xs uppercase tracking-wider text-text-muted font-mono bg-bg-base border border-border-default rounded-full px-2 py-0.5"
        >
          soon
        </span>
      )}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Step 2 — DISPLAY NAME (B+1.10 — what should I call you?)
// ────────────────────────────────────────────────────────────

interface StepDisplayNameProps {
  value: string;
  onChange: (next: string) => void;
}

function StepDisplayName({ value, onChange }: StepDisplayNameProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title="what should I call you?"
        helper="first name, nickname, whatever feels right. capitalization stays exactly as you type it."
      />
      <input
        type="text"
        value={local}
        onChange={(e) => {
          // No force-lower / force-upper — trust the input verbatim. We only
          // length-cap (matches the 80-char DB cap from cloud-migration-031).
          if (e.target.value.length <= MAX_DISPLAY_NAME_CHARS) {
            setLocal(e.target.value);
            onChange(e.target.value);
          }
        }}
        placeholder="first name, nickname, whatever feels right"
        maxLength={MAX_DISPLAY_NAME_CHARS}
        autoComplete="given-name"
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px]"
      />
      <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
        {local.length} / {MAX_DISPLAY_NAME_CHARS}
      </p>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 3 — WHY (FREEFORM, B+1.10 — replaces chip multi-select)
// ────────────────────────────────────────────────────────────

interface StepWhyFreeformProps {
  value: string;
  onChange: (next: string) => void;
}

function StepWhyFreeform({ value, onChange }: StepWhyFreeformProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title="what brings you to jargon?"
        helper="say it however it lives in your head. the real reason."
      />
      <textarea
        value={local}
        onChange={(e) => {
          if (e.target.value.length <= MAX_GOALS_FREEFORM_CHARS) {
            setLocal(e.target.value);
            onChange(e.target.value);
          }
        }}
        placeholder="e.g. i want to follow what claude code is doing in my terminal · my brother keeps dropping words like 'monorepo' and 'rebase' and i nod along · i'm thinking about switching careers and want to know if dev makes sense"
        rows={6}
        autoComplete="off"
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none"
      />
      <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
        {local.length} / {MAX_GOALS_FREEFORM_CHARS}
      </p>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 3 — JOB (preserved verbatim from B+1.4-C — in-place follow-up)
// ────────────────────────────────────────────────────────────

interface StepJobProps {
  value: string;
  onChange: (next: string) => void;
  registerAdvanceHandler: (fn: () => boolean) => void;
  /**
   * B+1.10 — wizard registers a cancel callback so it can invalidate the
   * in-flight Opus follow-up if the user navigates away (back button, jump
   * via progress bar). Without it, the async resolution would race against
   * route changes.
   */
  registerCancelOnBack: (fn: () => void) => void;
  onFollowupAdvance: (finalJob: string) => void;
}

type JobPhase = 'idle' | 'fetching' | 'followup-active';

function StepJob({
  value,
  onChange,
  registerAdvanceHandler,
  registerCancelOnBack,
  onFollowupAdvance,
}: StepJobProps) {
  const [local, setLocal] = useState(value);
  const [phase, setPhase] = useState<JobPhase>('idle');
  const [followup, setFollowup] = useState<JobFollowup | null>(null);
  const [committedJob, setCommittedJob] = useState<string>('');
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (phase === 'idle') setLocal(value);
  }, [value, phase]);

  // B+1.10 — register the cancel-on-back hook with the parent. Bumps the
  // requestSeqRef so any in-flight `generateJobFollowup` resolution becomes
  // a no-op (sees stale seq, returns silently). Also resets phase so the
  // textarea re-mounts cleanly if the user comes back to this step.
  useEffect(() => {
    registerCancelOnBack(() => {
      requestSeqRef.current++;
      if (phase === 'fetching' || phase === 'followup-active') {
        setPhase('idle');
        setFollowup(null);
        setOtherOpen(false);
        setOtherText('');
      }
    });
  });

  useEffect(() => {
    registerAdvanceHandler(() => {
      if (phase === 'followup-active' || phase === 'fetching') return true;
      const trimmed = local.trim();
      if (trimmed.length === 0) return false;
      setCommittedJob(trimmed);
      setPhase('fetching');
      const seq = ++requestSeqRef.current;
      void (async () => {
        const result = await generateJobFollowup(trimmed);
        if (seq !== requestSeqRef.current) return;
        if (result.isFallback || result.question.length === 0 || result.chips.length === 0) {
          onFollowupAdvance(trimmed);
          return;
        }
        setFollowup(result);
        setPhase('followup-active');
      })();
      return true;
    });
  });

  function pickChip(chip: string) {
    if (chip === 'other') {
      setOtherOpen(true);
      return;
    }
    onFollowupAdvance(`${committedJob} · ${chip}`);
  }

  function commitOther() {
    const cleaned = otherText.trim();
    if (cleaned.length === 0) return;
    onFollowupAdvance(`${committedJob} · ${cleaned}`);
  }

  function handleEdit() {
    requestSeqRef.current++;
    setPhase('idle');
    setFollowup(null);
    setOtherOpen(false);
    setOtherText('');
    setLocal(committedJob);
    onChange(committedJob);
  }

  return (
    <>
      <StepHeading
        title="what do you do for work?"
        helper="this is the analogy domain we'll lean on first."
      />
      {phase === 'idle' && (
        <>
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            specifics matter — what kind of job, where, how long?
          </p>
          <textarea
            value={local}
            onChange={(e) => {
              if (e.target.value.length <= 240) {
                setLocal(e.target.value);
                onChange(e.target.value);
              }
            }}
            placeholder="e.g. regional operations manager at a logistics company · ER nurse at a Level 1 trauma center · third-grade teacher at a Title 1 school"
            rows={5}
            autoComplete="off"
            autoFocus
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none"
          />
        </>
      )}
      {(phase === 'fetching' || phase === 'followup-active') && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center min-h-[44px] px-3 rounded-full text-sm bg-surface-card border border-border-default text-text-primary max-w-full truncate"
              aria-label={`your job: ${committedJob}`}
            >
              <span className="truncate">{committedJob}</span>
            </span>
            <button
              type="button"
              onClick={handleEdit}
              className="text-sm lowercase text-accent-jargon-hi underline underline-offset-2 min-h-[44px] px-2 active:text-text-secondary transition-colors"
              aria-label="edit job"
            >
              edit
            </button>
          </div>

          {phase === 'fetching' && (
            <div
              className="flex items-center gap-2 text-sm text-text-secondary"
              role="status"
              aria-live="polite"
            >
              <span
                aria-hidden="true"
                className="inline-block w-3 h-3 rounded-full border-2 border-text-muted border-t-accent-jargon animate-spin"
              />
              <span>tailoring a follow-up…</span>
            </div>
          )}

          {phase === 'followup-active' && followup && (
            <>
              <p className="text-base text-text-primary mb-3 leading-snug">
                {followup.question}
              </p>
              <div className="flex flex-wrap gap-2">
                {followup.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => pickChip(chip)}
                    className={`min-h-[44px] px-3 rounded-full text-sm border transition-colors ${
                      chip === 'other' && otherOpen
                        ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
                        : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              {otherOpen && (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    type="text"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitOther();
                      }
                    }}
                    placeholder="say more"
                    maxLength={120}
                    autoComplete="off"
                    autoFocus
                    className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={commitOther}
                    disabled={otherText.trim().length === 0}
                    className="self-end text-sm lowercase text-accent-jargon-hi underline underline-offset-2 min-h-[44px] px-2 active:text-text-secondary transition-colors disabled:opacity-40"
                  >
                    add and continue →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 4 — ENCOUNTER (preserved)
// ────────────────────────────────────────────────────────────

interface StepEncounterProps {
  value: string[];
  onChange: (next: string[]) => void;
}

function StepEncounter({ value, onChange }: StepEncounterProps) {
  return (
    <>
      <StepHeading
        title="where do you usually run into these terms?"
        helper="pick all that apply."
      />
      <div className="flex flex-wrap gap-2">
        {ENCOUNTER_OPTIONS.map((chip) => (
          <ChipToggle
            key={chip}
            label={chip}
            selected={value.includes(chip)}
            onClick={() => {
              onChange(
                value.includes(chip)
                  ? value.filter((v) => v !== chip)
                  : [...value, chip],
              );
            }}
          />
        ))}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 5 — INTERESTS (preserved)
// ────────────────────────────────────────────────────────────

interface StepInterestsProps {
  value: string[];
  onChange: (next: string[]) => void;
}

function StepInterests({ value, onChange }: StepInterestsProps) {
  const [input, setInput] = useState('');
  const pickedLower = useMemo(
    () => new Set(value.map((v) => v.toLowerCase())),
    [value],
  );
  const suggestions = useMemo(
    () => searchInterests(input, { excludeLower: pickedLower, limit: 10 }),
    [input, pickedLower],
  );

  function add(raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (pickedLower.has(cleaned.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...value, cleaned]);
    setInput('');
  }
  function remove(item: string) {
    onChange(value.filter((v) => v !== item));
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const top = suggestions[0];
      if (top && top.toLowerCase() === input.trim().toLowerCase()) {
        add(top);
      } else {
        add(input);
      }
    } else if (e.key === 'Backspace' && input.length === 0 && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  return (
    <>
      <StepHeading
        title="what are you into?"
        helper="tap as many as you want, or type your own."
      />
      <p className="text-xs text-text-secondary mb-3 leading-relaxed">
        the more specific the better — search 500+ interests or type your own.
      </p>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {value.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => remove(v)}
              aria-label={`remove ${v}`}
              className="min-h-[44px] px-3 rounded-full text-sm bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary inline-flex items-center gap-2"
            >
              <span>{v}</span>
              <span aria-hidden="true" className="text-text-secondary">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="search or type your own"
          maxLength={60}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[44px]"
        />
        {input.trim().length > 0 && suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="interest suggestions"
            className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface-card border border-border-default rounded-lg overflow-y-auto max-h-[286px] shadow-lg"
          >
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(s);
                  }}
                  className="w-full text-left min-h-[44px] px-3 py-2 text-base text-text-primary active:bg-surface-card-hi border-b border-border-default last:border-b-0"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 6 — HERITAGE (preserved)
// ────────────────────────────────────────────────────────────

interface StepHeritageProps {
  value: string;
  onChange: (next: string) => void;
}

function StepHeritage({ value, onChange }: StepHeritageProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title="where are you from?"
        helper="country, region, city — wherever shaped you."
      />
      <input
        type="text"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="e.g. Liverpool, England · Tampa, FL · Mexico → Texas"
        maxLength={MAX_HERITAGE_CHARS}
        autoComplete="off"
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px]"
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 7 — ROLES (preserved)
// ────────────────────────────────────────────────────────────

interface StepRolesProps {
  value: string[];
  onChange: (next: string[]) => void;
}

function StepRoles({ value, onChange }: StepRolesProps) {
  return (
    <>
      <StepHeading
        title="any roles that define you?"
        helper="tap any that fit."
      />
      <div className="flex flex-wrap gap-2">
        {ROLE_OPTIONS.map((chip) => (
          <ChipToggle
            key={chip}
            label={chip}
            selected={value.includes(chip)}
            onClick={() => {
              onChange(
                value.includes(chip)
                  ? value.filter((v) => v !== chip)
                  : [...value, chip],
              );
            }}
          />
        ))}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 8 — BACKGROUND (preserved)
// ────────────────────────────────────────────────────────────

interface StepBackgroundProps {
  value: string;
  onChange: (next: string) => void;
}

function StepBackground({ value, onChange }: StepBackgroundProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title="anything else that'd help me translate?"
        helper="optional. the more specific the better."
      />
      <textarea
        value={local}
        onChange={(e) => {
          if (e.target.value.length <= MAX_BACKGROUND_CHARS) {
            setLocal(e.target.value);
            onChange(e.target.value);
          }
        }}
        placeholder="hobbies, weird trivia — the more specific the better"
        rows={4}
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none"
      />
      <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
        {local.length} / {MAX_BACKGROUND_CHARS}
      </p>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 9 — REVIEW (NEW B+1.10)
// ────────────────────────────────────────────────────────────

interface StepReviewProps {
  answers: WizardAnswers;
  skipped: SkippedSet;
  onEdit: (stepId: StepId) => void;
}

function StepReview({ answers, skipped, onEdit }: StepReviewProps) {
  const domainOpt = ONBOARDING_DOMAIN_OPTIONS.find((o) => o.id === answers.domain_pick);
  const domainLabel = domainOpt?.label ?? answers.domain_pick;
  const resolvedDomain = pickableDomain(answers.domain_pick);
  const domainNote =
    domainOpt && !isLiveDomainOption(domainOpt)
      ? ` (defaulting to ${DEFAULT_DOMAIN} until ${domainLabel} ships)`
      : '';

  function valueOrSkipped(stepId: StepId, formatted: string | null): string {
    if (formatted && formatted.trim().length > 0) return formatted;
    if (skipped[stepId]) return 'skipped';
    return '—';
  }

  const rows: Array<{ stepId: StepId; label: string; value: string }> = [
    {
      stepId: 'domain',
      label: stepLabel('domain'),
      value: `${domainLabel}${domainNote}`,
    },
    {
      stepId: 'display_name',
      label: stepLabel('display_name'),
      // Render display_name verbatim — no lower/upper, no truncation past
      // the input cap (already 80 chars).
      value: valueOrSkipped('display_name', answers.display_name.trim() || null),
    },
    {
      stepId: 'why',
      label: stepLabel('why'),
      value: valueOrSkipped('why', answers.goals_freeform.trim() || null),
    },
    {
      stepId: 'job',
      label: stepLabel('job'),
      value: valueOrSkipped('job', answers.job.trim() || null),
    },
    {
      stepId: 'encounter',
      label: stepLabel('encounter'),
      value: valueOrSkipped('encounter', answers.encounter_contexts.join(' · ') || null),
    },
    {
      stepId: 'interests',
      label: stepLabel('interests'),
      value: valueOrSkipped('interests', answers.interests.join(' · ') || null),
    },
    {
      stepId: 'heritage',
      label: stepLabel('heritage'),
      value: valueOrSkipped('heritage', answers.heritage.trim() || null),
    },
    {
      stepId: 'roles',
      label: stepLabel('roles'),
      value: valueOrSkipped('roles', answers.roles.join(' · ') || null),
    },
    {
      stepId: 'background',
      label: stepLabel('background'),
      value: valueOrSkipped('background', answers.background_text.trim() || null),
    },
  ];

  void resolvedDomain;

  return (
    <>
      <StepHeading
        title="does this look right?"
        helper="tap any line to edit. you can change every answer later from settings."
      />
      <ul className="flex flex-col gap-2 pb-4">
        {rows.map((row) => {
          // POLISH (B+1.10 designer P8): the domain row is the load-bearing
          // answer — it determines what content the user actually sees.
          // Pop it visually with the accent border + soft tint background
          // so the eye snaps to it as the most-important confirmation.
          const isDomainRow = row.stepId === 'domain';
          return (
            <li key={row.stepId}>
              <button
                type="button"
                onClick={() => onEdit(row.stepId)}
                className={[
                  'w-full text-left rounded-lg p-3 min-h-[56px] active:bg-surface-card-hi transition-colors flex items-start gap-3 border',
                  isDomainRow
                    ? 'bg-accent-jargon/[0.12] border-accent-jargon'
                    : 'bg-surface-card border-border-default',
                ].join(' ')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-2xs uppercase tracking-wider text-text-muted font-mono">
                    {row.label}
                  </p>
                  <p className="text-sm text-text-primary leading-snug mt-1 break-words">
                    {row.value}
                  </p>
                </div>
                <span aria-hidden="true" className="text-accent-jargon-hi text-xs lowercase font-mono shrink-0 mt-1">
                  edit
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Shared chip control
// ────────────────────────────────────────────────────────────

interface ChipToggleProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function ChipToggle({ label, selected, onClick }: ChipToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[44px] px-3 rounded-full text-sm border transition-colors ${
        selected
          ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
          : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi'
      }`}
    >
      {label}
    </button>
  );
}
