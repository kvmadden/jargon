import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useToastStore } from '../components/toast';
import {
  sendGiftInvite,
  EMPTY_PREFILLED_PROFILE,
  generateJobFollowup,
  pickLivedIcons,
  composeGiftProfile,
  generateLivedIconImage,
} from '../lib/data';
import type {
  PrefilledProfile,
  JobFollowup,
  ComposeGiftProfileResponse,
  ComposeConfidence,
} from '../lib/data';
import { searchInterests } from '../lib/interest-dictionary';
import { Wordmark } from '../components/wordmark';
import { isVoiceSupported, createVoiceSession } from '../lib/voice-input';
import { ErrorBoundary } from './error-boundary';
import { GuidedProgramCard } from '../components/guided-program-card';
import {
  GUIDED_PROGRAMS,
  asGuidedProgramId,
  guidedProgram,
  type GuidedProgramId,
} from '../lib/guided-programs';

/**
 * /gift/send — sender wizard for "set up a profile for someone you love".
 *
 * 13-step wizard (B+1.11), second-person framed. Step 0 captures recipient
 * name + email; the rest of the steps reference the recipient by name via
 * `[name]` substitution. The wizard ends on a live preview of the
 * recipient-facing splash so the sender can verify what they're about to
 * send before tapping "looks good — send invite."
 *
 * Step map (B+1.11):
 *   0  recipient (name + email)              required
 *   1  relationship                          required (single-select chip)
 *   2  display_name                          optional
 *   3  why                                   optional (freeform + chips)
 *   4  private_reasoning                     optional (sender-only freeform)
 *   5  job                                   optional (in-place follow-up)
 *   6  encounter_contexts                    optional
 *   7  interests                             optional
 *   8  heritage                              optional
 *   9  roles                                 optional
 *   10 background                            optional
 *   11 custom_message                        optional (recipient sees this)
 *   12 preview                               final — "looks good — send invite"
 *
 * Final CTA: "looks good — send invite" — POSTs to send-gift-invite Edge
 * Function with the full prefilled_profile + recipient details + custom_message
 * + relationship + private_reasoning. On success: toast confirms + navigates
 * back to /settings.
 *
 * Storage notes (B+1.11):
 *   - relationship goes to gift_invites.relationship AND is mirrored into
 *     PrefilledProfile.relationship (which travels through prefilled_profile
 *     jsonb but is also separately persisted as a column on the gift row).
 *     accept_gift_invite_atomic copies it into user_profile.relationship at
 *     accept time. Editable later from Settings → edit profile.
 *   - private_reasoning goes ONLY to gift_invites.private_reasoning. It does
 *     NOT flow into user_profile (RLS would expose it to the recipient).
 *     The personalize-term Edge Function reads it via service-role JOIN.
 *
 * Skippable per-step — except step 0 (recipient — required to send the magic
 * link), step 1 (relationship — required for the framing prompt to land),
 * and step 12 (preview — that's the send action).
 *
 * Spec: B+1.4-B brief §"Sender flow (`/gift/send`)" + B+1.11 gift-composer push.
 */

// B+1.11 — gift composer push. Adds three new steps:
//   - relationship (chip single-select, between recipient and display_name)
//   - private_reasoning (freeform, between why and job)
//   - preview (live recipient-facing splash render, becomes the new final step)
// Total bumps from 10 to 13. The final-step CTA ("send invite") moves to the
// preview step; custom_message becomes a non-terminal step.
//
//   0  recipient (name + email)
//   1  relationship       ← NEW (B+1.11)
//   2  display_name
//   3  why
//   4  private_reasoning  ← NEW (B+1.11)
//   5  job
//   6  encounter
//   7  interests
//   8  heritage
//   9  roles
//   10 background
//   11 custom_message
//   12 preview             ← NEW (B+1.11)  — final step; "send invite" CTA lives here
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
const TOTAL_STEPS = 13 as const; // 0..12 inclusive

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SenderAnswers {
  recipient_name: string;
  recipient_email: string;
  /** B+1.10 — what to call the recipient (sender's pick). Verbatim casing. */
  display_name: string;
  /**
   * B+1.11 — sender's relationship to the recipient. One of RELATIONSHIP_OPTIONS
   * OR a freeform string when "other" is picked. Required before advancing past
   * step 1 (one-of-N).
   */
  relationship: string;
  goals_extended: string[];
  goals_freeform: string;
  /**
   * B+1.11 — private "why are you giving this?" textarea. Recipient never sees
   * this. Goes to gift_invites.private_reasoning, NOT to user_profile.
   */
  private_reasoning: string;
  job: string | null;
  encounter_contexts: string[];
  interests: string[];
  heritage: string | null;
  roles: string[];
  background_text: string | null;
  custom_message: string | null;
  guided_program_id: GuidedProgramId | null;
}

const EMPTY_ANSWERS: SenderAnswers = {
  recipient_name: '',
  recipient_email: '',
  // Spread first, then overwrite display_name as a non-null string for the
  // local wizard state (gets coalesced to null at finish() if blank).
  ...EMPTY_PREFILLED_PROFILE,
  display_name: '',
  relationship: '',
  goals_freeform: '',
  private_reasoning: '',
  custom_message: null,
  guided_program_id: null,
};

// Mirrors GOAL_OPTIONS from /onboarding/profile, reframed for third-person
// guessing — "follow what their dev kid is doing", etc. The strings remain
// lowercase + chip-friendly.
const GOAL_OPTIONS = [
  'follow what their dev family is up to',
  'sound credible at work',
  'just curious how software really works',
  'keep up with their kid / partner',
];

const ENCOUNTER_OPTIONS = [
  'tech podcasts',
  'family / friends',
  'news articles',
  'job listings',
  'slack at work',
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

// B+1.11 — single-select chip options for "what's your relationship to them?"
// Order is intentional: family relationships come first. The free-text "other" sits at the
// end and opens an inline freeform input mirror of StepWhy's "other" pattern.
const RELATIONSHIP_OPTIONS = [
  'father-in-law',
  'mother-in-law',
  'parent',
  'sibling',
  'partner / spouse',
  'friend',
  'mentor',
  'colleague',
  'adult child',
  'other',
];

const MAX_BACKGROUND_CHARS = 500;
const MAX_HERITAGE_CHARS = 120;
const MAX_MESSAGE_CHARS = 280;
const MAX_GOALS_FREEFORM_CHARS = 500;
const MAX_DISPLAY_NAME_CHARS = 80;
const MAX_RELATIONSHIP_CHARS = 60;
const MAX_PRIVATE_REASONING_CHARS = 500;

/**
 * Substitute `[name]` (literal token) in step copy. The recipient_name is
 * cleaned + truncated for safety; if it's empty we fall back to "them".
 */
function withName(template: string, recipientName: string): string {
  const trimmed = recipientName.trim();
  if (!trimmed) return template.replaceAll('[name]', 'them');
  return template.replaceAll('[name]', trimmed);
}

// ─── Mode switcher (B+1.12 — AI-compose primary path) ────────────────────
//
// The user lands on `compose` mode (a single freeform "tell me about them"
// surface). On submit, we POST to compose-gift-profile, hydrate `answers`
// from Opus's draft, and flip to `review` mode (editable summary). On
// fallback OR on the secondary "compose by hand" link, we drop into
// `wizard` mode — the full 13-step flow #4 already built, unchanged.

type GiftSendMode = 'compose' | 'review' | 'wizard';

const COMPOSE_PLACEHOLDER =
  "your father-in-law's a retired biology professor in tampa, originally from england. loves nature, soccer, red dead redemption. gets confused when his daughters drop monorepo and rebase…";

const COMPOSE_LOADING_MESSAGES = [
  'reading…',
  'thinking…',
  'drafting…',
  'picking icons…',
];

const MAX_FREEFORM_DESCRIBE_CHARS = 2000;

/**
 * Hydrate the SenderAnswers schema from a compose-gift-profile response.
 * Used to seed the review screen AND to seed the wizard if the user bails
 * to "compose by hand" after the AI has already drafted.
 */
function applyComposeResponse(
  base: SenderAnswers,
  response: ComposeGiftProfileResponse,
): SenderAnswers {
  const p = response.proposed_profile;
  return {
    ...base,
    display_name: p.display_name ?? base.display_name,
    job: p.job ?? base.job,
    heritage: p.heritage ?? base.heritage,
    interests: p.interests ?? base.interests,
    roles: p.roles ?? base.roles,
    encounter_contexts: p.encounter_contexts ?? base.encounter_contexts,
    goals_extended: p.goals_extended ?? base.goals_extended,
    goals_freeform: p.goals_freeform ?? base.goals_freeform,
    background_text: p.background_text ?? base.background_text,
    custom_message: response.custom_message_draft || base.custom_message,
    private_reasoning: response.private_reasoning_draft || base.private_reasoning,
    // lived_icons aren't part of the local SenderAnswers schema (they live
    // separately on PrefilledProfile and are picked again at finish() via
    // pickLivedIcons). We stash them on a parallel ref so the review screen
    // can render them — see ReviewView below.
  };
}

export default function GiftSend() {
  return (
    <ErrorBoundary>
      <GiftSendContent />
    </ErrorBoundary>
  );
}

function GiftSendContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<GiftSendMode>('compose');
  const [answers, setAnswers] = useState<SenderAnswers>(() => ({
    ...EMPTY_ANSWERS,
    recipient_name: (searchParams.get('name') ?? '').slice(0, 120),
    guided_program_id: asGuidedProgramId(searchParams.get('program')),
  }));
  // lived_icons survive across modes via this ref — Opus picks them during
  // compose, the user can edit them in review (rare today; v2 will surface
  // an icon picker), and `finish()` in WizardView re-fetches them from
  // pickLivedIcons. The compose path stashes them here so review can render
  // them inline as a "this is what opus saw in them" preview.
  const [aiLivedIcons, setAiLivedIcons] = useState<string[]>([]);
  const [aiConfidence, setAiConfidence] = useState<ComposeConfidence>('medium');

  function patch<K extends keyof SenderAnswers>(key: K, value: SenderAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  if (mode === 'compose') {
    return (
      <ComposeView
        answers={answers}
        patch={patch}
        onSubmitDraft={(response) => {
          setAnswers((prev) => applyComposeResponse(prev, response));
          setAiLivedIcons(response.lived_icons);
          setAiConfidence(response.confidence);
          setMode('review');
        }}
        onFallbackToWizard={() => setMode('wizard')}
        onSwitchToWizard={() => setMode('wizard')}
        onBack={() => navigate(-1)}
      />
    );
  }

  if (mode === 'review') {
    return (
      <ReviewView
        answers={answers}
        patch={patch}
        livedIcons={aiLivedIcons}
        confidence={aiConfidence}
        onEditMore={() => setMode('wizard')}
        onBack={() => setMode('compose')}
        onSent={() => navigate('/settings', { replace: true })}
      />
    );
  }

  return (
    <WizardView
      answers={answers}
      setAnswers={setAnswers}
      onBack={() => navigate(-1)}
      onComposeSwitch={() => setMode('compose')}
    />
  );
}

/**
 * The original 13-step wizard, untouched in shape from #4's B+1.11 work.
 * Only the function name and prop wiring change — `answers` lifts to the
 * outer GiftSend wrapper so it survives mode switches.
 */
function WizardView({
  answers,
  setAnswers,
  onBack,
  onComposeSwitch,
}: {
  answers: SenderAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<SenderAnswers>>;
  onBack: () => void;
  onComposeSwitch: () => void;
}) {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const [step, setStep] = useState<StepIndex>(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [busy, setBusy] = useState(false);

  // B+1.4-C — same job-followup handle pattern as onboarding-profile. The
  // sender wizard's job step (B+1.11 step index 5, post-relationship +
  // private_reasoning shift) gets the same in-place follow-up flow because
  // the sender is also guessing at specificity ("kindergarten teacher" →
  // "Title 1 school" / "Montessori" / "private" / etc).
  const jobAdvanceHandlerRef = useRef<(() => boolean) | null>(null);

  function patch<K extends keyof SenderAnswers>(key: K, value: SenderAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  // Step 0 has its own validity gate — both name and email must be present
  // and the email must look like an email. We disable "next" until then so
  // the sender can't accidentally fire off a malformed invite.
  const step0Valid =
    answers.recipient_name.trim().length > 0 &&
    EMAIL_REGEX.test(answers.recipient_email.trim().toLowerCase());

  // B+1.11 — relationship is required (single-select; one chip MUST be picked
  // before advancing). When "other" is picked, the freeform string must be
  // non-empty too. The chip values are the canonical strings; "other" lives
  // in the SenderAnswers as the literal user-typed string (sentinel via the
  // RELATIONSHIP_OPTIONS membership check elsewhere).
  const step1Valid = answers.relationship.trim().length > 0;

  function goNext() {
    if (step === 0 && !step0Valid) return;
    if (step === 1 && !step1Valid) return;
    if (step === TOTAL_STEPS - 1) {
      // Final step is the preview — "send invite" CTA.
      void finish();
      return;
    }
    // Job step (now index 5 after relationship + private_reasoning insertions)
    // may want to interrupt to surface a follow-up.
    if (step === 5 && jobAdvanceHandlerRef.current?.()) {
      return;
    }
    setDirection('forward');
    setStep((s) => (s + 1) as StepIndex);
  }

  function goBack() {
    if (step === 0) {
      // Bail out of the wizard. If we got here via fallback / "compose by
      // hand" (entry mode = compose), this routes back to compose mode (the
      // user's freeform describe stays intact in case they want to retry
      // AI). Otherwise it routes to /settings (the entry-point wizard).
      onBack();
      return;
    }
    setDirection('back');
    setStep((s) => (s - 1) as StepIndex);
  }

  function skipStep() {
    if (step === 0) return; // Can't skip recipient
    if (step === 1) return; // Can't skip relationship — required
    if (step === TOTAL_STEPS - 1) return; // Preview has no skip — it's the send step.
    // B+1.11 step indices (post-shift):
    //   2 display_name, 3 why, 4 private_reasoning, 5 job,
    //   6 encounter, 7 interests, 8 heritage, 9 roles,
    //   10 background, 11 custom_message
    if (step === 2) patch('display_name', '');
    if (step === 3) {
      patch('goals_extended', []);
      patch('goals_freeform', '');
    }
    if (step === 4) patch('private_reasoning', '');
    if (step === 5) patch('job', null);
    if (step === 6) patch('encounter_contexts', []);
    if (step === 7) patch('interests', []);
    if (step === 8) patch('heritage', null);
    if (step === 9) patch('roles', []);
    if (step === 10) patch('background_text', null);
    if (step === 11) patch('custom_message', null);
    setDirection('forward');
    setStep((s) => (s + 1) as StepIndex);
  }

  async function finish() {
    if (!user || busy) return;
    if (!step0Valid) return;
    if (!step1Valid) return; // relationship required
    setBusy(true);
    try {
      // Build the base profile first (without lived_icons).
      const baseProfile: PrefilledProfile = {
        goals_extended: answers.goals_extended,
        goals_freeform: answers.goals_freeform.trim() || null,
        job: answers.job,
        encounter_contexts: answers.encounter_contexts,
        interests: answers.interests,
        heritage: answers.heritage,
        roles: answers.roles,
        background_text: answers.background_text,
        // B+1.10 — display_name (verbatim casing). Only the trim happens
        // here; characters in the middle (caps, special chars) are preserved
        // exactly as the sender typed.
        display_name: answers.display_name.trim() || null,
        // B+1.11 — relationship is plumbed through PrefilledProfile so
        // downstream surfaces (preview render, future onboarding rehydrate)
        // can read it from a single source. The wire goes via the dedicated
        // top-level send-gift-invite arg below — gift_invites.relationship
        // is a separate column from prefilled_profile (jsonb).
        relationship: answers.relationship.trim() || null,
        active_domain: guidedProgram(answers.guided_program_id)?.domain ?? null,
        // A guided program pins its own domain. Normal gifts keep the legacy
        // null value, which the server treats as the default coding domain.
      };
      // B+1.11 — pickLivedIcons BEFORE sending the invite so the slugs
      // make it into prefilled_profile. Recipient inherits the icons at
      // accept time (accept_gift_invite_atomic sparse-merges lived_icons
      // into user_profile per cloud-migration-033). Empty array on any
      // failure — recipient sees no strip, sender flow proceeds normally.
      // Adds ~3-6s of latency to the send button (one Opus call), which
      // we accept because gift composition is a slow, intentional moment
      // and the icon strip is a meaningful "this knows them" signal.
      //
      // B+1.14 — generateLivedIconImage IN PARALLEL with the slug pick.
      // The badge URL flows through prefilled_profile.lived_icon_url and
      // accept_gift_invite_atomic copies it onto the recipient's
      // user_profile.lived_icon_url at accept time. The Edge Function
      // routes the upload to a gift-namespace storage path
      // (`gift/<hash(email)>.png`) so the sender's own badge isn't
      // overwritten. Slow path (~10-20s) but worth it — the badge IS the
      // first thing Peter sees on his accept splash.
      const recipientEmail = answers.recipient_email.trim().toLowerCase();
      const [livedIcons, badgeResult] = await Promise.all([
        pickLivedIcons(baseProfile),
        generateLivedIconImage(baseProfile, { forRecipientEmail: recipientEmail }),
      ]);
      const profile: PrefilledProfile = {
        ...baseProfile,
        lived_icons: livedIcons,
        lived_icon_url: badgeResult.url, // null on any failure → recipient falls back to strip
      };
      await sendGiftInvite({
        recipient_email: recipientEmail,
        recipient_name: answers.recipient_name.trim(),
        custom_message: answers.custom_message,
        prefilled_profile: profile,
        guided_program_id: answers.guided_program_id,
        // B+1.11 top-level fields — go to gift_invites columns, not into
        // prefilled_profile.
        relationship: answers.relationship.trim() || null,
        private_reasoning: answers.private_reasoning.trim() || null,
      });
      pushToast(`invite sent to ${answers.recipient_email.trim().toLowerCase()}`, 'success');
      navigate('/settings', { replace: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[gift-send] finish failed', err);
      const msg = err instanceof Error ? err.message : 'something broke';
      // Surface the server message verbatim — the rate-limit + validation
      // errors are already user-friendly enough at the Edge Function level
      // (e.g. "too many active invites (max 5)"). Truncate so toasts stay
      // scannable.
      pushToast(`couldn't send invite — ${msg.slice(0, 80)}`, 'error');
      setBusy(false);
    }
  }

  // Final step (preview) is the send step — CTA reads "looks good — send invite".
  // Every other step reads "next →".
  const ctaLabel = busy
    ? 'sending…'
    : step === TOTAL_STEPS - 1
      ? 'looks good — send invite'
      : 'next →';

  return (
    <div className="h-screen flex flex-col bg-bg-base safe-top safe-bottom overflow-hidden">
      <header className="px-4 py-4 shrink-0">
        {/* Wizard chrome anchored to body's max-w column so wordmark + back
            don't orphan at the screen edges on tablet/desktop. */}
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Wordmark size={20} showDot />
          <button
            type="button"
            onClick={goBack}
            disabled={busy}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary text-sm lowercase active:text-text-primary transition-colors disabled:opacity-60"
            aria-label="back"
          >
            ‹ back
          </button>
        </div>
      </header>

      <div className="px-4 pt-2 pb-4 shrink-0 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="text-2xs uppercase tracking-wider text-text-muted font-mono">
            step {step + 1} of {TOTAL_STEPS}
          </p>
          {/* B+1.12 — escape hatch back to AI compose. Hidden once the
               sender is mid-flight (step > 1) so we don't tempt them into
               losing answers. */}
          {step <= 1 && (
            <button
              type="button"
              onClick={onComposeSwitch}
              disabled={busy}
              className="text-2xs lowercase text-text-muted underline underline-offset-2 min-h-[44px] inline-flex items-center active:text-text-secondary transition-colors disabled:opacity-60"
            >
              try AI compose →
            </button>
          )}
        </div>
        <div className="flex gap-1 w-full">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i).map((n) => (
            <span
              key={n}
              aria-hidden="true"
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= step ? 'bg-accent-jargon' : 'bg-border-default'
              }`}
            />
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 max-w-md mx-auto w-full flex flex-col overflow-hidden">
        <StepFrame key={step} direction={direction}>
          {step === 0 && (
            <StepRecipient
              name={answers.recipient_name}
              email={answers.recipient_email}
              onNameChange={(v) => patch('recipient_name', v)}
              onEmailChange={(v) => patch('recipient_email', v)}
            />
          )}
          {step === 1 && (
            <StepRelationship
              recipientName={answers.recipient_name}
              value={answers.relationship}
              onChange={(v) => patch('relationship', v)}
            />
          )}
          {step === 2 && (
            <StepDisplayName
              recipientName={answers.recipient_name}
              value={answers.display_name}
              onChange={(v) => patch('display_name', v)}
            />
          )}
          {step === 3 && (
            <StepWhy
              recipientName={answers.recipient_name}
              value={answers.goals_extended}
              onChange={(v) => patch('goals_extended', v)}
              freeformValue={answers.goals_freeform}
              onFreeformChange={(v) => patch('goals_freeform', v)}
            />
          )}
          {step === 4 && (
            <StepPrivateReasoning
              recipientName={answers.recipient_name}
              value={answers.private_reasoning}
              onChange={(v) => patch('private_reasoning', v)}
            />
          )}
          {step === 5 && (
            <StepJob
              recipientName={answers.recipient_name}
              value={answers.job ?? ''}
              onChange={(v) => patch('job', v.trim() || null)}
              registerAdvanceHandler={(fn) => {
                jobAdvanceHandlerRef.current = fn;
              }}
              onFollowupAdvance={(finalJob) => {
                patch('job', finalJob);
                setDirection('forward');
                setStep((s) => (s + 1) as StepIndex);
              }}
            />
          )}
          {step === 6 && (
            <StepEncounter
              recipientName={answers.recipient_name}
              value={answers.encounter_contexts}
              onChange={(v) => patch('encounter_contexts', v)}
            />
          )}
          {step === 7 && (
            <StepInterests
              recipientName={answers.recipient_name}
              value={answers.interests}
              onChange={(v) => patch('interests', v)}
            />
          )}
          {step === 8 && (
            <StepHeritage
              recipientName={answers.recipient_name}
              value={answers.heritage ?? ''}
              onChange={(v) => patch('heritage', v.trim() ? v : null)}
            />
          )}
          {step === 9 && (
            <StepRoles
              recipientName={answers.recipient_name}
              value={answers.roles}
              onChange={(v) => patch('roles', v)}
            />
          )}
          {step === 10 && (
            <StepBackground
              recipientName={answers.recipient_name}
              value={answers.background_text ?? ''}
              onChange={(v) => patch('background_text', v.trim() ? v : null)}
            />
          )}
          {step === 11 && (
            <StepMessage
              recipientName={answers.recipient_name}
              value={answers.custom_message ?? ''}
              onChange={(v) => patch('custom_message', v.trim() ? v : null)}
            />
          )}
          {step === 12 && (
            <StepPreview answers={answers} />
          )}
        </StepFrame>
      </main>

      <footer className="px-4 pt-4 pb-4 shrink-0 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={goNext}
          disabled={
            busy ||
            (step === 0 && !step0Valid) ||
            (step === 1 && !step1Valid)
          }
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 active:bg-accent-jargon-lo transition-colors disabled:opacity-60"
        >
          {ctaLabel}
        </button>
        {/* Skip is hidden on step 0 (recipient — required), step 1 (relationship
            — required), and the final preview step (no skip — it's the send). */}
        {step > 1 && step < TOTAL_STEPS - 1 && (
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={skipStep}
              disabled={busy}
              className="text-2xs lowercase text-text-muted underline underline-offset-2 min-h-[44px] px-2 active:text-text-secondary transition-colors disabled:opacity-60"
            >
              skip this →
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

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

// ─── Step 0: RECIPIENT ──────────────────────────────────────────────────────

interface StepRecipientProps {
  name: string;
  email: string;
  onNameChange: (next: string) => void;
  onEmailChange: (next: string) => void;
}

function StepRecipient({ name, email, onNameChange, onEmailChange }: StepRecipientProps) {
  return (
    <>
      <StepHeading
        title="who's it for?"
        helper="the magic link goes to their inbox. you can use any name (mom, dad, jesse — whatever they go by)."
      />
      <label className="block">
        <span className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2 block">
          their name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. mom · dad · jesse"
          maxLength={120}
          autoComplete="off"
          autoFocus
          className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px]"
        />
      </label>
      <label className="block mt-6">
        <span className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2 block">
          their email
        </span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="name@example.com"
          maxLength={254}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px]"
        />
      </label>
    </>
  );
}

// ─── Step 2: DISPLAY NAME (B+1.10 — what should we call them?) ──────────────

interface StepDisplayNameProps {
  recipientName: string;
  value: string;
  onChange: (next: string) => void;
}

function StepDisplayName({ recipientName, value, onChange }: StepDisplayNameProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const helper = recipientName.trim().length > 0
    ? `you put down "${recipientName.trim()}" for the email — what do they actually go by? this is what shows up in greetings ("hi {name},").`
    : 'this is what shows up in greetings ("hi {name},"). first name, nickname, whatever they go by.';
  return (
    <>
      <StepHeading
        title="what should we call them?"
        helper={helper}
      />
      <input
        type="text"
        value={local}
        onChange={(e) => {
          // No force-lower / force-upper — preserve sender input exactly.
          if (e.target.value.length <= MAX_DISPLAY_NAME_CHARS) {
            setLocal(e.target.value);
            onChange(e.target.value);
          }
        }}
        placeholder="first name, nickname, whatever they go by"
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

// ─── Step 3: WHY ─────────────────────────────────────────────────────────────

interface StepWhyProps {
  recipientName: string;
  value: string[];
  onChange: (next: string[]) => void;
  freeformValue: string;
  onFreeformChange: (next: string) => void;
}

function StepWhy({
  recipientName: _recipientName,
  value,
  onChange,
  freeformValue,
  onFreeformChange,
}: StepWhyProps) {
  // We deliberately use "them" here rather than the literal name because Q1
  // immediately follows Q0 — leading with the name three times in a row reads
  // as repetitive. The remaining Qs interpolate the name explicitly. Prop
  // shape stays symmetric across all step components for easier review.
  //
  // B+1.10: the gifted "why" is now BOTH a freeform textarea (mirrors the
  // onboarding rewrite — what the recipient's profile actually drives) AND
  // the legacy chip grid (preserved for backwards compat with the chip-based
  // confirm wizard on the recipient side; spec keeps both for now). Sender
  // can fill either or both. The freeform text wins on the personalization
  // prompt; chips contribute as goals_extended.
  const [local, setLocal] = useState(freeformValue);
  useEffect(() => setLocal(freeformValue), [freeformValue]);

  const [otherText, setOtherText] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);

  function togglePreset(chip: string) {
    const next = value.includes(chip)
      ? value.filter((v) => v !== chip)
      : [...value, chip];
    onChange(next);
  }

  function commitOther(text: string) {
    const cleaned = text.trim();
    const presetsOnly = value.filter((v) => GOAL_OPTIONS.includes(v));
    if (cleaned) onChange([...presetsOnly, cleaned]);
    else onChange(presetsOnly);
  }

  return (
    <>
      <StepHeading
        title="what do you think brings them to jargon?"
        helper="say it however it lives in your head — the real reason. you can also tap any of the common ones below."
      />
      <textarea
        value={local}
        onChange={(e) => {
          if (e.target.value.length <= MAX_GOALS_FREEFORM_CHARS) {
            setLocal(e.target.value);
            onFreeformChange(e.target.value);
          }
        }}
        placeholder="e.g. their kid keeps dropping words like 'monorepo' and 'rebase' and they nod along · they want to follow what claude code is doing in their terminal"
        rows={5}
        autoComplete="off"
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none"
      />
      <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
        {local.length} / {MAX_GOALS_FREEFORM_CHARS}
      </p>
      <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mt-6 mb-2">
        or pick from common ones
      </p>
      <div className="flex flex-wrap gap-2">
        {GOAL_OPTIONS.map((chip) => (
          <ChipToggle
            key={chip}
            label={chip}
            selected={value.includes(chip)}
            onClick={() => togglePreset(chip)}
          />
        ))}
        <ChipToggle
          label="other"
          selected={otherOpen}
          onClick={() => {
            const next = !otherOpen;
            setOtherOpen(next);
            if (!next) {
              setOtherText('');
              commitOther('');
            }
          }}
        />
      </div>
      {otherOpen && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => {
            setOtherText(e.target.value);
            commitOther(e.target.value);
          }}
          placeholder="say more"
          maxLength={120}
          autoComplete="off"
          className="mt-3 w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[44px]"
        />
      )}
    </>
  );
}

// ─── Step 5: JOB (B+1.4-C — in-place follow-up state machine) ───────────────

interface StepJobProps {
  recipientName: string;
  value: string;
  onChange: (next: string) => void;
  /**
   * Same advance-handler contract as onboarding-profile.tsx StepJob — the
   * Edge Function takes the same `{ job: string }` shape, so Opus's
   * follow-up question + chips work identically whether the typer is the
   * recipient or a guessing sender.
   */
  registerAdvanceHandler: (fn: () => boolean) => void;
  onFollowupAdvance: (finalJob: string) => void;
}

type JobPhase = 'idle' | 'fetching' | 'followup-active';

function StepJob({
  recipientName,
  value,
  onChange,
  registerAdvanceHandler,
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

  useEffect(() => {
    registerAdvanceHandler(() => {
      if (phase === 'followup-active' || phase === 'fetching') {
        return true;
      }
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
        title={withName('what does [name] do for work?', recipientName)}
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
            placeholder="e.g. middle-school art teacher in toledo · ER nurse at memorial hospital · self-employed plumber doing residential remodels"
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
              aria-label={`their job: ${committedJob}`}
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

// ─── Step 6: ENCOUNTER CONTEXTS ──────────────────────────────────────────────

interface StepEncounterProps {
  recipientName: string;
  value: string[];
  onChange: (next: string[]) => void;
}

function StepEncounter({ recipientName, value, onChange }: StepEncounterProps) {
  return (
    <>
      <StepHeading
        title={withName('where do they usually run into these terms?', recipientName)}
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

// ─── Step 7: INTERESTS ───────────────────────────────────────────────────────

interface StepInterestsProps {
  recipientName: string;
  value: string[];
  onChange: (next: string[]) => void;
}

function StepInterests({ recipientName, value, onChange }: StepInterestsProps) {
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
        title={withName('what is [name] into?', recipientName)}
        helper="hobbies, sports, shows — the more specific the better."
      />
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
          placeholder="search 500+ interests or type your own"
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

// ─── Step 8: HERITAGE ────────────────────────────────────────────────────────

interface StepHeritageProps {
  recipientName: string;
  value: string;
  onChange: (next: string) => void;
}

function StepHeritage({ recipientName, value, onChange }: StepHeritageProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title={withName('where is [name] from?', recipientName)}
        helper="country, region, city — wherever shaped them."
      />
      <input
        type="text"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="e.g. liverpool, england · tampa, FL · mexico → texas"
        maxLength={MAX_HERITAGE_CHARS}
        autoComplete="off"
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px]"
      />
    </>
  );
}

// ─── Step 9: ROLES ───────────────────────────────────────────────────────────

interface StepRolesProps {
  recipientName: string;
  value: string[];
  onChange: (next: string[]) => void;
}

function StepRoles({ recipientName, value, onChange }: StepRolesProps) {
  return (
    <>
      <StepHeading
        title={withName('any roles that define [name]?', recipientName)}
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

// ─── Step 10: BACKGROUND ─────────────────────────────────────────────────────

interface StepBackgroundProps {
  recipientName: string;
  value: string;
  onChange: (next: string) => void;
}

function StepBackground({ recipientName, value, onChange }: StepBackgroundProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title={withName(
          "anything else that'd help us translate for [name]?",
          recipientName,
        )}
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
        placeholder="hobbies, weird trivia, the way they think — what would help an analogy land?"
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

// ─── Step 11: CUSTOM MESSAGE ─────────────────────────────────────────────────

interface StepMessageProps {
  recipientName: string;
  value: string;
  onChange: (next: string) => void;
}

function StepMessage({ recipientName, value, onChange }: StepMessageProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title="want to add a note?"
        helper={withName(
          "this shows up on [name]'s welcome screen, right above the wizard.",
          recipientName,
        )}
      />
      <textarea
        value={local}
        onChange={(e) => {
          if (e.target.value.length <= MAX_MESSAGE_CHARS) {
            setLocal(e.target.value);
            onChange(e.target.value);
          }
        }}
        placeholder={withName(
          "[name] — this thing translates dev terms into the world you actually live in. wanted you to have it.",
          recipientName,
        )}
        rows={5}
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none"
      />
      <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
        {local.length} / {MAX_MESSAGE_CHARS}
      </p>
    </>
  );
}

// ─── Step 1: RELATIONSHIP (B+1.11 — required, single-select chip) ───────────

interface StepRelationshipProps {
  recipientName: string;
  value: string;
  onChange: (next: string) => void;
}

function StepRelationship({ recipientName, value, onChange }: StepRelationshipProps) {
  // Determine whether the current value matches a preset chip OR is an "other"
  // freeform entry. We track the freeform input separately so toggling between
  // a preset chip and "other" doesn't lose what the user typed.
  const isPreset = (v: string) => RELATIONSHIP_OPTIONS.includes(v) && v !== 'other';
  const valueIsPreset = isPreset(value);
  const valueIsOther = value.trim().length > 0 && !valueIsPreset;
  const [otherOpen, setOtherOpen] = useState(valueIsOther);
  const [otherText, setOtherText] = useState(valueIsOther ? value : '');

  function pickPreset(chip: string) {
    setOtherOpen(false);
    setOtherText('');
    onChange(chip);
  }

  function pickOther() {
    setOtherOpen(true);
    // If the user previously typed something, restore it; otherwise wait for input.
    onChange(otherText.trim());
  }

  function commitOther(text: string) {
    if (text.length > MAX_RELATIONSHIP_CHARS) return;
    setOtherText(text);
    onChange(text.trim());
  }

  return (
    <>
      <StepHeading
        title={withName("what's your relationship to [name]?", recipientName)}
        helper="this shapes the register and emotional distance the translator uses. one tap."
      />
      <div className="flex flex-wrap gap-2">
        {RELATIONSHIP_OPTIONS.map((chip) => {
          if (chip === 'other') {
            return (
              <ChipToggle
                key={chip}
                label="other"
                selected={otherOpen || valueIsOther}
                onClick={() => {
                  if (otherOpen || valueIsOther) {
                    setOtherOpen(false);
                    setOtherText('');
                    onChange('');
                  } else {
                    pickOther();
                  }
                }}
              />
            );
          }
          return (
            <ChipToggle
              key={chip}
              label={chip}
              selected={value === chip}
              onClick={() => pickPreset(chip)}
            />
          );
        })}
      </div>
      {(otherOpen || valueIsOther) && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => commitOther(e.target.value)}
          placeholder="say more — e.g. neighbor, in-law's parent"
          maxLength={MAX_RELATIONSHIP_CHARS}
          autoComplete="off"
          autoFocus
          className="mt-3 w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[44px]"
        />
      )}
    </>
  );
}

// ─── Step 4: PRIVATE REASONING (B+1.11 — recipient never sees this) ──────────

interface StepPrivateReasoningProps {
  recipientName: string;
  value: string;
  onChange: (next: string) => void;
}

function StepPrivateReasoning({
  recipientName,
  value,
  onChange,
}: StepPrivateReasoningProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <StepHeading
        title={withName("in your own words, why are you giving this to [name]?", recipientName)}
        helper="private — they won't see this. it helps the translator understand your relationship and intent."
      />
      <textarea
        value={local}
        onChange={(e) => {
          if (e.target.value.length <= MAX_PRIVATE_REASONING_CHARS) {
            setLocal(e.target.value);
            onChange(e.target.value);
          }
        }}
        placeholder="e.g. peter keeps asking what i do all day and i want him to be able to ask better questions · my mom watches me code and gets quiet — she shouldn't have to feel locked out"
        rows={5}
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none"
      />
      <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
        {local.length} / {MAX_PRIVATE_REASONING_CHARS}
      </p>
    </>
  );
}

// ─── Step 12: PREVIEW (B+1.11 — live recipient-facing splash render) ─────────

interface StepPreviewProps {
  answers: SenderAnswers;
}

/**
 * Renders the recipient-facing splash inline using the sender's current
 * answers. We construct a synthetic GiftPreviewResponse rather than extracting
 * SplashView from gift-accept.tsx — the in-place inline render keeps the
 * change set isolated to gift-send and matches the visual structure of the
 * real splash via the same Tailwind tokens. If SplashView ever gains
 * non-trivial logic (network calls, auth gates, side effects), revisit
 * extracting it into a shared component then.
 *
 * We deliberately render the SAME information the recipient will actually
 * see at /gift/accept — h1 greeting, sender attribution line, optional
 * custom message card, "what's jargon" copy block, "what {sender} put down
 * for you" profile preview (work / from / into). The relationship is
 * surfaced subtly under the greeting ("you're {sender}'s father-in-law").
 *
 * Capitalization is preserved verbatim across every text rendering — the
 * sender sees exactly what the recipient will see.
 */
function StepPreview({ answers }: StepPreviewProps) {
  const user = useUserStore((s) => s.user);
  const program = guidedProgram(answers.guided_program_id);

  // Prefer recipient's preferred display_name in the greeting, fall back to
  // recipient_name.
  const greetingName =
    answers.display_name.trim().length > 0
      ? answers.display_name.trim()
      : answers.recipient_name.trim() || 'friend';

  // Sender attribution — pull from the signed-in sender's auth user_metadata
  // mirroring how preview-gift-invite resolves it on the recipient side.
  const senderMeta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const senderDisplay =
    (typeof senderMeta.display_name === 'string' && senderMeta.display_name.trim()) ||
    (typeof senderMeta.full_name === 'string' && senderMeta.full_name.trim()) ||
    (typeof senderMeta.name === 'string' && senderMeta.name.trim()) ||
    (user?.email ? user.email.split('@')[0] ?? 'someone' : 'someone');
  const senderFirstName = senderDisplay.split(' ')[0] ?? senderDisplay;

  // The relationship line ("you're kevin's father-in-law"). Only renders when
  // both relationship + sender display are present. We use the sender's first
  // name because the full display_name often reads stiffly in this position.
  const relationship = answers.relationship.trim();
  const relationshipLine =
    relationship.length > 0
      ? `you're ${senderFirstName}'s ${relationship}.`
      : null;

  // Profile preview axes (work / from / into) — same selection logic as
  // gift-accept SplashView.
  const job = (answers.job ?? '').trim();
  const heritage = (answers.heritage ?? '').trim();
  const interestsList = answers.interests.filter(
    (s) => typeof s === 'string' && s.trim().length > 0,
  );
  const interestsTopFour = interestsList.slice(0, 4);
  const hasAnyPreview = job.length > 0 || heritage.length > 0 || interestsTopFour.length > 0;

  return (
    <>
      <StepHeading
        title={`preview — what ${greetingName} will see`}
        helper="this is the splash they'll land on after tapping the magic link. nothing here is editable from this screen — go back to change anything."
      />

      {/* The preview surface mirrors the real /gift/accept splash. We wrap it
          in a card-style container with a dotted top edge to signal "this is
          a preview, not the live screen." */}
      <div className="bg-surface-card border border-dashed border-border-default rounded-lg p-4 flex flex-col gap-4">
        {/* h1 greeting */}
        <div>
          <h3 className="text-2xl font-semibold text-text-primary leading-tight">
            <span className="lowercase">hi</span> {greetingName},
          </h3>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            {senderDisplay} made this — and set it up for you specifically.
          </p>
          {relationshipLine && (
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              {relationshipLine}
            </p>
          )}
        </div>

        {program && <GuidedProgramCard program={program} compact />}

        {/* Custom message card (only when the sender wrote one) */}
        {answers.custom_message && answers.custom_message.trim().length > 0 && (
          <div className="bg-bg-base border border-border-default rounded-lg p-3">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {answers.custom_message.trim()}
            </p>
          </div>
        )}

        {/* "what's jargon" copy block — lifted verbatim from gift-accept
            SplashView so the preview stays faithful. */}
        <div className="bg-bg-base border border-border-default rounded-lg p-3">
          <p className="text-2xs uppercase tracking-wider text-accent-jargon-hi font-semibold">
            what's jargon
          </p>
          <p className="text-sm text-text-primary mt-2 leading-relaxed">
            a 5-minute-a-day vocabulary game for the words your people drop
            mid-conversation. every term gets translated through{' '}
            <span className="text-text-primary font-medium">your world</span> —
            not abstract textbook stuff. you nod along less. you actually know
            what's going on more.
          </p>
        </div>

        {/* Profile preview — work / from / into */}
        {hasAnyPreview && (
          <div className="bg-bg-base border border-border-default rounded-lg p-3">
            <p className="text-2xs uppercase tracking-wider text-accent-jargon-hi font-semibold">
              what {senderFirstName} put down for you
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {job.length > 0 && (
                <li className="flex gap-2">
                  <span className="text-text-muted text-2xs uppercase tracking-wider font-mono pt-0.5 shrink-0 w-12">
                    work
                  </span>
                  <span className="text-sm text-text-primary leading-snug flex-1">{job}</span>
                </li>
              )}
              {heritage.length > 0 && (
                <li className="flex gap-2">
                  <span className="text-text-muted text-2xs uppercase tracking-wider font-mono pt-0.5 shrink-0 w-12">
                    from
                  </span>
                  <span className="text-sm text-text-primary leading-snug flex-1">{heritage}</span>
                </li>
              )}
              {interestsTopFour.length > 0 && (
                <li className="flex gap-2">
                  <span className="text-text-muted text-2xs uppercase tracking-wider font-mono pt-0.5 shrink-0 w-12">
                    into
                  </span>
                  <span className="text-sm text-text-primary leading-snug flex-1">
                    {interestsTopFour.join(' · ')}
                    {interestsList.length > interestsTopFour.length && (
                      <span className="text-text-muted">
                        {' '}· +{interestsList.length - interestsTopFour.length} more
                      </span>
                    )}
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Sender-only footer note — what the recipient won't see (private
          reasoning) is invisible in the preview by design, but we surface
          a one-line confirmation that it was captured so the sender doesn't
          worry it was dropped. */}
      {answers.private_reasoning.trim().length > 0 && (
        <p className="text-2xs text-text-muted mt-4 leading-relaxed">
          your private note is saved with this gift. they won't see it — the
          translator will use it to ground its tone.
        </p>
      )}
    </>
  );
}

// ─── Shared chip control ────────────────────────────────────────────────────

interface ChipToggleProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ChipToggle({ label, selected, onClick, disabled }: ChipToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`min-h-[44px] px-3 rounded-full text-sm border transition-colors ${
        selected
          ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
          : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi'
      } disabled:opacity-60`}
    >
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────
// B+1.12 — AI compose entry surface
// ────────────────────────────────────────────────────────────────────────

interface ComposeViewProps {
  answers: SenderAnswers;
  patch: <K extends keyof SenderAnswers>(key: K, value: SenderAnswers[K]) => void;
  onSubmitDraft: (response: ComposeGiftProfileResponse) => void;
  onFallbackToWizard: () => void;
  onSwitchToWizard: () => void;
  onBack: () => void;
}

function ComposeView({
  answers,
  patch,
  onSubmitDraft,
  onFallbackToWizard,
  onSwitchToWizard,
  onBack,
}: ComposeViewProps) {
  const user = useUserStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);

  const [describe, setDescribe] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const sessionRef = useRef<{ stop(): void } | null>(null);
  // We track whether voice was used at all (sticky once set) so the
  // request log can correlate input modality with output quality.
  const voiceUsedRef = useRef<boolean>(false);

  const voiceSupported = useMemo(() => isVoiceSupported(), []);

  // Cycle the loading message every 1.4s while busy.
  useEffect(() => {
    if (!busy) {
      setLoadingIdx(0);
      return;
    }
    const id = window.setInterval(
      () => setLoadingIdx((i) => (i + 1) % COMPOSE_LOADING_MESSAGES.length),
      1400,
    );
    return () => window.clearInterval(id);
  }, [busy]);

  // Cleanup the recognizer on unmount.
  useEffect(
    () => () => {
      sessionRef.current?.stop();
    },
    [],
  );

  function startVoice() {
    if (busy) return;
    setVoiceError(null);
    try {
      voiceUsedRef.current = true;
      const session = createVoiceSession(
        (text) => {
          // Streaming transcript REPLACES the textarea content while the
          // session is live — keeps the UX simple ("speak and watch it
          // fill"). When the user toggles voice off and types, their typed
          // text persists; when they toggle voice back on, it overwrites.
          setDescribe(text.slice(0, MAX_FREEFORM_DESCRIBE_CHARS));
        },
        (err) => {
          setVoiceError(err.message);
          setListening(false);
          sessionRef.current = null;
        },
      );
      sessionRef.current = session;
      session.start();
      setListening(true);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : String(err));
      setListening(false);
    }
  }

  function stopVoice() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setListening(false);
  }

  const nameOk = answers.recipient_name.trim().length > 0;
  const emailOk = EMAIL_REGEX.test(answers.recipient_email.trim().toLowerCase());
  const describeOk = describe.trim().length > 0;
  const ctaEnabled = !busy && nameOk && emailOk && describeOk;

  async function submit() {
    if (!user || busy) return;
    if (!nameOk || !emailOk) {
      pushToast('add a name and a valid email first', 'error');
      return;
    }
    if (!describeOk) {
      pushToast('describe them a little — anything', 'error');
      return;
    }
    setBusy(true);
    const senderName = user.email?.split('@')[0] ?? 'jargon user';
    const response = await composeGiftProfile({
      recipient_name: answers.recipient_name.trim(),
      recipient_email: answers.recipient_email.trim().toLowerCase(),
      freeform_describe: describe,
      sender_name: senderName,
      relationship: answers.relationship.trim() || null,
      voice_was_used: voiceUsedRef.current,
    });
    if (response.isFallback) {
      pushToast('AI compose unavailable — switching to manual', 'default');
      // Don't hand the empty response into `applyComposeResponse` — just
      // fall through. The user's recipient_name / email / relationship
      // already live on `answers`.
      onFallbackToWizard();
      setBusy(false);
      return;
    }
    onSubmitDraft(response);
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="px-4 py-4 shrink-0">
        {/* Compose-step chrome anchored to body's max-w column. */}
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Wordmark size={20} showDot />
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary text-sm lowercase active:text-text-primary transition-colors disabled:opacity-60"
            aria-label="back"
          >
            ‹ back
          </button>
        </div>
      </header>

      <div className="px-4 pt-2 pb-4 shrink-0 max-w-md mx-auto w-full">
        <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2">
          step 1 of 2
        </p>
        <div className="flex gap-1 w-full">
          <span aria-hidden="true" className="h-1 flex-1 rounded-full bg-accent-jargon" />
          <span aria-hidden="true" className="h-1 flex-1 rounded-full bg-border-default" />
        </div>
      </div>

      <main className="flex-1 px-4 max-w-md mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary lowercase leading-snug mb-2">
            set up jargon for someone you love
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            tell us about them — opus drafts the whole thing, you edit and send.
          </p>
        </div>

        <ReviewField label="guided start (optional)">
          <GuidedProgramChoice
            value={answers.guided_program_id}
            onChange={(value) => patch('guided_program_id', value)}
            disabled={busy}
          />
        </ReviewField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2 block">
              their name
            </span>
            <input
              type="text"
              value={answers.recipient_name}
              onChange={(e) => patch('recipient_name', e.target.value)}
              placeholder="mom · dad · jesse"
              maxLength={120}
              autoComplete="off"
              disabled={busy}
              className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px] disabled:opacity-60"
            />
          </label>
          <label className="block">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2 block">
              their email
            </span>
            <input
              type="email"
              inputMode="email"
              value={answers.recipient_email}
              onChange={(e) => patch('recipient_email', e.target.value)}
              placeholder="name@example.com"
              maxLength={254}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              disabled={busy}
              className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px] disabled:opacity-60"
            />
          </label>
        </div>

        <div>
          <span className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2 block">
            how do you know them? (optional)
          </span>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <ChipToggle
                key={opt}
                label={opt}
                selected={answers.relationship === opt}
                disabled={busy}
                onClick={() => {
                  patch('relationship', answers.relationship === opt ? '' : opt);
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-mono">
              tell me about them
            </span>
            <span className="text-2xs text-text-muted font-mono tabular-nums">
              {describe.length} / {MAX_FREEFORM_DESCRIBE_CHARS}
            </span>
          </div>
          <textarea
            value={describe}
            onChange={(e) => {
              if (e.target.value.length <= MAX_FREEFORM_DESCRIBE_CHARS) {
                setDescribe(e.target.value);
              }
            }}
            placeholder={COMPOSE_PLACEHOLDER}
            rows={7}
            disabled={busy || listening}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none disabled:opacity-60"
          />

          {voiceSupported ? (
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                disabled={busy}
                aria-pressed={listening}
                className={`self-start min-h-[44px] inline-flex items-center gap-2 px-3 rounded-full text-sm border transition-colors ${
                  listening
                    ? 'bg-accent-jargon/[0.12] border-accent-jargon text-text-primary'
                    : 'bg-surface-card border-border-default text-text-secondary active:bg-surface-card-hi'
                } disabled:opacity-60`}
              >
                {/* Inline mic glyph (one-off — no Iconify dep needed) */}
                <svg
                  aria-hidden="true"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
                {listening ? (
                  <>
                    <span className="relative flex w-2 h-2 mr-1">
                      <span className="absolute inline-flex w-full h-full rounded-full bg-accent-jargon opacity-75 animate-ping" />
                      <span className="relative inline-flex w-2 h-2 rounded-full bg-accent-jargon" />
                    </span>
                    listening… (tap to stop)
                  </>
                ) : (
                  'dictate'
                )}
              </button>
              <p className="text-2xs text-text-muted leading-relaxed">
                or use your wispr flow shortcut to dictate — works system-wide.
              </p>
              {voiceError && (
                <p className="text-2xs text-accent-jargon-hi leading-relaxed">
                  voice didn't work — {voiceError.slice(0, 80)}. type instead?
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-2xs text-text-muted leading-relaxed">
              your browser doesn't support voice input — try wispr flow or just type.
            </p>
          )}
        </div>
      </main>

      <footer className="px-4 pt-6 pb-4 shrink-0 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ctaEnabled}
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 active:bg-accent-jargon-lo transition-colors disabled:opacity-60"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2 justify-center">
              <span
                aria-hidden="true"
                className="inline-block w-3 h-3 rounded-full border-2 border-text-muted border-t-accent-jargon-hi animate-spin"
              />
              {COMPOSE_LOADING_MESSAGES[loadingIdx]}
            </span>
          ) : (
            'compose with AI →'
          )}
        </button>
        <div className="flex justify-center mt-3">
          <button
            type="button"
            onClick={onSwitchToWizard}
            disabled={busy}
            className="text-2xs lowercase text-text-muted underline underline-offset-2 min-h-[44px] px-2 active:text-text-secondary transition-colors disabled:opacity-60"
          >
            compose by hand instead →
          </button>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// B+1.12 — AI compose review surface
// ────────────────────────────────────────────────────────────────────────

interface ReviewViewProps {
  answers: SenderAnswers;
  patch: <K extends keyof SenderAnswers>(key: K, value: SenderAnswers[K]) => void;
  livedIcons: string[];
  confidence: ComposeConfidence;
  onEditMore: () => void;
  onBack: () => void;
  onSent: () => void;
}

function ReviewView({
  answers,
  patch,
  livedIcons,
  confidence,
  onEditMore,
  onBack,
  onSent,
}: ReviewViewProps) {
  const user = useUserStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function handleSend() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const recipientEmail = answers.recipient_email.trim().toLowerCase();
      const baseProfile: PrefilledProfile = {
        goals_extended: answers.goals_extended,
        goals_freeform: answers.goals_freeform.trim() || null,
        job: answers.job,
        encounter_contexts: answers.encounter_contexts,
        interests: answers.interests,
        heritage: answers.heritage,
        roles: answers.roles,
        background_text: answers.background_text,
        display_name: answers.display_name.trim() || null,
        relationship: answers.relationship.trim() || null,
        active_domain: guidedProgram(answers.guided_program_id)?.domain ?? null,
        // Use the icons Opus already picked during compose. We deliberately
        // do NOT call pickLivedIcons again here — that would either
        // re-roll Opus's choices (unwanted) or duplicate the cost. The
        // wizard finish() path still calls pickLivedIcons because the
        // wizard never had compose-time icons.
        lived_icons: livedIcons,
      };
      // B+1.14 — generate the AI badge for the recipient. The compose
      // path doesn't have a pre-rolled URL, so we fire it here — same
      // gift-namespace storage path treatment as the wizard finish().
      // Adds ~10-20s to the send tap; the busy spinner already covers it.
      const badgeResult = await generateLivedIconImage(baseProfile, {
        forRecipientEmail: recipientEmail,
      });
      const profile: PrefilledProfile = {
        ...baseProfile,
        lived_icon_url: badgeResult.url,
      };
      await sendGiftInvite({
        recipient_email: recipientEmail,
        recipient_name: answers.recipient_name.trim(),
        custom_message: answers.custom_message,
        prefilled_profile: profile,
        guided_program_id: answers.guided_program_id,
        relationship: answers.relationship.trim() || null,
        private_reasoning: answers.private_reasoning.trim() || null,
      });
      pushToast(`invite sent to ${answers.recipient_email.trim().toLowerCase()}`, 'success');
      onSent();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[gift-send/review] send failed', err);
      const msg = err instanceof Error ? err.message : 'something broke';
      pushToast(`couldn't send invite — ${msg.slice(0, 80)}`, 'error');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="px-4 py-4 shrink-0">
        {/* Review-step chrome anchored to body's max-w column. */}
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Wordmark size={20} showDot />
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary text-sm lowercase active:text-text-primary transition-colors disabled:opacity-60"
            aria-label="back to compose"
          >
            ‹ back
          </button>
        </div>
      </header>

      <div className="px-4 pt-2 pb-4 shrink-0 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <p className="text-2xs uppercase tracking-wider text-text-muted font-mono">
            step 2 of 2
          </p>
          <button
            type="button"
            onClick={onEditMore}
            disabled={busy}
            className="text-2xs lowercase text-text-muted underline underline-offset-2 min-h-[44px] inline-flex items-center active:text-text-secondary transition-colors disabled:opacity-60"
          >
            edit step-by-step →
          </button>
        </div>
        <div className="flex gap-1 w-full">
          <span aria-hidden="true" className="h-1 flex-1 rounded-full bg-accent-jargon" />
          <span aria-hidden="true" className="h-1 flex-1 rounded-full bg-accent-jargon" />
        </div>
      </div>

      <main className="flex-1 px-4 max-w-md mx-auto w-full flex flex-col gap-6 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary lowercase leading-snug mb-2">
            here's what opus drafted — edit anything
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            this all lands in {answers.recipient_name.trim() || 'their'} profile when you send.
          </p>
          {confidence !== 'high' && (
            <p className="mt-3 text-2xs text-accent-jargon-hi leading-relaxed">
              {confidence === 'low'
                ? '▸ sparse input — extra editing recommended.'
                : '▸ verifier flagged this draft — give it a closer read.'}
            </p>
          )}
        </div>

        <ReviewField label="display name (what to call them)">
          <input
            type="text"
            value={answers.display_name}
            onChange={(e) => patch('display_name', e.target.value.slice(0, MAX_DISPLAY_NAME_CHARS))}
            placeholder="first name, nickname"
            disabled={busy}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px] disabled:opacity-60"
          />
        </ReviewField>

        <ReviewField label="guided start">
          <GuidedProgramChoice
            value={answers.guided_program_id}
            onChange={(value) => patch('guided_program_id', value)}
            disabled={busy}
          />
        </ReviewField>

        <ReviewField label="job">
          <input
            type="text"
            value={answers.job ?? ''}
            onChange={(e) => patch('job', e.target.value || null)}
            placeholder="what they do for work"
            disabled={busy}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px] disabled:opacity-60"
          />
        </ReviewField>

        <ReviewField label="where they're from">
          <input
            type="text"
            value={answers.heritage ?? ''}
            onChange={(e) =>
              patch('heritage', e.target.value.slice(0, MAX_HERITAGE_CHARS) || null)
            }
            placeholder="country, region, city"
            disabled={busy}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px] disabled:opacity-60"
          />
        </ReviewField>

        <ReviewField label="interests">
          <ChipArrayEditor
            value={answers.interests}
            onChange={(v) => patch('interests', v)}
            placeholder="add an interest…"
            disabled={busy}
            useDictionary
          />
        </ReviewField>

        <ReviewField label="roles">
          <ChipArrayEditor
            value={answers.roles}
            onChange={(v) => patch('roles', v)}
            placeholder="add a role…"
            options={ROLE_OPTIONS}
            disabled={busy}
          />
        </ReviewField>

        <ReviewField label="encounter contexts">
          <ChipArrayEditor
            value={answers.encounter_contexts}
            onChange={(v) => patch('encounter_contexts', v)}
            placeholder="add a context…"
            options={ENCOUNTER_OPTIONS}
            disabled={busy}
          />
        </ReviewField>

        <ReviewField label="why are they here?">
          <textarea
            value={answers.goals_freeform}
            onChange={(e) => {
              if (e.target.value.length <= MAX_GOALS_FREEFORM_CHARS) {
                patch('goals_freeform', e.target.value);
              }
            }}
            placeholder="what brings them to jargon"
            rows={3}
            disabled={busy}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none disabled:opacity-60"
          />
        </ReviewField>

        <ReviewField label="background">
          <textarea
            value={answers.background_text ?? ''}
            onChange={(e) => {
              if (e.target.value.length <= MAX_BACKGROUND_CHARS) {
                patch('background_text', e.target.value || null);
              }
            }}
            placeholder="anything else that'd help us translate for them"
            rows={4}
            disabled={busy}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none disabled:opacity-60"
          />
        </ReviewField>

        <ReviewField label="lived icons (visual shorthand)">
          <LivedIconsStrip slugs={livedIcons} />
          <p className="mt-2 text-2xs text-text-muted leading-relaxed">
            edit these later from settings → profile.
          </p>
        </ReviewField>

        <ReviewField label="welcome message (recipient sees this)">
          <textarea
            value={answers.custom_message ?? ''}
            onChange={(e) => {
              if (e.target.value.length <= MAX_MESSAGE_CHARS) {
                patch('custom_message', e.target.value || null);
              }
            }}
            placeholder="what shows up on their splash screen"
            rows={4}
            disabled={busy}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none disabled:opacity-60"
          />
          <p className="mt-1 text-2xs text-text-muted font-mono tabular-nums text-right">
            {(answers.custom_message ?? '').length} / {MAX_MESSAGE_CHARS}
          </p>
        </ReviewField>

        <ReviewField label="why this person, for you (private — they never see this)">
          <textarea
            value={answers.private_reasoning}
            onChange={(e) => {
              if (e.target.value.length <= MAX_PRIVATE_REASONING_CHARS) {
                patch('private_reasoning', e.target.value);
              }
            }}
            placeholder="your unfiltered why — opus uses it, the recipient doesn't see it"
            rows={3}
            disabled={busy}
            className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none disabled:opacity-60"
          />
        </ReviewField>

        {/* Optional preview disclosure — uses the existing StepPreview block. */}
        <div>
          <button
            type="button"
            onClick={() => setPreviewOpen((o) => !o)}
            disabled={busy}
            className="w-full text-left min-h-[44px] flex items-center justify-between px-3 rounded-lg bg-surface-card border border-border-default text-text-primary text-sm disabled:opacity-60"
            aria-expanded={previewOpen}
          >
            <span className="lowercase">preview what they'll see</span>
            <span aria-hidden="true" className="text-text-muted text-xs">
              {previewOpen ? '▴' : '▾'}
            </span>
          </button>
          {previewOpen && (
            <div className="mt-3">
              <StepPreview answers={answers} />
            </div>
          )}
        </div>
      </main>

      <footer className="px-4 pt-4 pb-4 shrink-0 max-w-md mx-auto w-full border-t border-border-default">
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={busy}
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 active:bg-accent-jargon-lo transition-colors disabled:opacity-60"
        >
          {busy ? 'sending…' : 'looks good — send invite'}
        </button>
      </footer>
    </div>
  );
}

// Helpers used by ReviewView only.

function GuidedProgramChoice({
  value,
  onChange,
  disabled,
}: {
  value: GuidedProgramId | null;
  onChange: (next: GuidedProgramId | null) => void;
  disabled?: boolean;
}) {
  const program = value ? GUIDED_PROGRAMS[value] : null;
  const defaultProgram = GUIDED_PROGRAMS['agentic-era-operator'];

  if (program) {
    return (
      <GuidedProgramCard
        program={program}
        action={
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="min-h-[44px] text-xs lowercase text-text-secondary underline underline-offset-2 disabled:opacity-60"
          >
            use normal jargon instead
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-text-secondary">
        normal jargon opens the full domain. attach a course when you want a
        smaller, facilitator-led starting point.
      </p>
      <button
        type="button"
        onClick={() => onChange(defaultProgram.id)}
        disabled={disabled}
        className="min-h-[44px] rounded-lg border border-border-default bg-surface-card px-3 text-left text-sm font-medium lowercase text-text-primary transition-colors active:bg-surface-card-hi disabled:opacity-60"
      >
        attach {defaultProgram.title} →
      </button>
    </div>
  );
}

function ReviewField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2 block">
        {label}
      </span>
      {children}
    </div>
  );
}

interface ChipArrayEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
  options?: readonly string[];
  useDictionary?: boolean;
}

function ChipArrayEditor({
  value,
  onChange,
  placeholder,
  disabled,
  options,
  useDictionary,
}: ChipArrayEditorProps) {
  const [input, setInput] = useState('');
  const pickedLower = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const dictSuggestions = useMemo(
    () =>
      useDictionary
        ? searchInterests(input, { excludeLower: pickedLower, limit: 8 })
        : [],
    [input, pickedLower, useDictionary],
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

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => remove(v)}
              disabled={disabled}
              aria-label={`remove ${v}`}
              className="min-h-[44px] px-3 rounded-full text-sm bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              <span>{v}</span>
              <span aria-hidden="true" className="text-text-secondary">
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={placeholder}
          maxLength={60}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          disabled={disabled}
          className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[44px] disabled:opacity-60"
        />
        {input.trim().length > 0 && useDictionary && dictSuggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="suggestions"
            className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface-card border border-border-default rounded-lg overflow-y-auto max-h-[200px] shadow-lg"
          >
            {dictSuggestions.map((s) => (
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
      {options && (
        <div className="flex flex-wrap gap-2 mt-2">
          {options
            .filter((opt) => !pickedLower.has(opt.toLowerCase()))
            .map((opt) => (
              <ChipToggle
                key={opt}
                label={`+ ${opt}`}
                selected={false}
                disabled={disabled}
                onClick={() => add(opt)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function LivedIconsStrip({ slugs }: { slugs: string[] }) {
  if (slugs.length === 0) {
    return (
      <p className="text-sm text-text-muted lowercase">
        opus didn't pick any icons — they'll be picked when their profile fills out.
      </p>
    );
  }
  return (
    <div className="flex gap-2">
      {slugs.map((slug) => (
        <div
          key={slug}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-surface-card border border-border-default p-2"
          title={slug}
        >
          <img
            src={`https://api.iconify.design/ph/${slug}.svg?color=%239D80FF`}
            alt={slug}
            width={24}
            height={24}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
