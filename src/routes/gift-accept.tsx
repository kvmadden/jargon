import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useToastStore } from '../components/toast';
import {
  acceptGiftInvite,
  previewGiftInvite,
  type GiftPreviewResponse,
  type PrefilledProfile,
} from '../lib/data';
import { markProfileStepSeen } from '../lib/onboarding-session';
import { searchInterests } from '../lib/interest-dictionary';
import { Wordmark } from '../components/wordmark';
import { ErrorBoundary } from './error-boundary';
import { LivedIconBadge } from '../components/lived-icon-badge';
import { GuidedProgramCard } from '../components/guided-program-card';
import { guidedProgram } from '../lib/guided-programs';

/**
 * /gift/accept?inviteId=xxx — recipient acceptance flow for B+1.4-B.
 *
 * Two phases (state-driven, no nested routes):
 *
 *   1) splash: shows sender display name + custom message + "let's check it"
 *      vs "maybe later". This is the recipient's first impression after the
 *      magic-link sign-in lands them here.
 *
 *   2) wizard (only on accept): an 8-step confirmation flow that pre-loads
 *      the sender's prefilled_profile. Each step renders the sender's guess
 *      with a "yep that's right" / "nope, change it" pattern. "yep" advances
 *      preserving the value; "nope" clears the field and lets the recipient
 *      type/select their own. Plain "next →" treats as confirm. Final CTA
 *      is "save and start" → POSTs accept-gift-invite → /home.
 *
 *      B+1.10 (display_name push): step 1 is "what should we call you?"
 *      (the display_name confirmer); subsequent steps shift +1.
 *
 * "maybe later" still hits accept-gift-invite with declined=true, which
 * allowlists the recipient (so they CAN use the app) but does NOT write a
 * profile row. They land in canonical-only mode.
 *
 * Failure modes (route-level):
 *   - missing/invalid inviteId → "invite expired or invalid" graceful screen
 *   - 404 (invite not found) → same
 *   - 403 (wrong recipient JWT) → "this invite was sent to a different email"
 *   - 410 (expired) / accepted/declined already → graceful messaging
 *
 * Spec: B+1.4-B brief §"Recipient flow (`/gift/accept?inviteId=xxx`)".
 */

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'splash'; preview: GiftPreviewResponse }
  | { kind: 'wizard'; preview: GiftPreviewResponse }
  | { kind: 'submitting' };

// B+1.10 (display_name push) — step 1 is now "what to call you" (the display
// name confirmer); subsequent steps shift +1.
//   1 display_name  ← NEW
//   2 why
//   3 job
//   4 encounter
//   5 interests
//   6 heritage
//   7 roles
//   8 background
type StepIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const TOTAL_STEPS: StepIndex = 8;

const GOAL_OPTIONS = [
  'follow what Claude Code is doing',
  'talk to my dev family without flinching',
  'sound credible at work',
  'just curious how software really works',
];

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
const MAX_DISPLAY_NAME_CHARS = 80;

export default function GiftAccept() {
  return (
    <ErrorBoundary>
      <GiftAcceptContent />
    </ErrorBoundary>
  );
}

function GiftAcceptContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const [params] = useSearchParams();
  const inviteId = params.get('inviteId') ?? '';
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

  useEffect(() => {
    if (!user) return; // AuthGate handles redirect; nothing to do until session lands.
    if (!inviteId) {
      setPhase({ kind: 'error', message: 'no invite id in this link' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const preview = await previewGiftInvite(inviteId);
        if (cancelled) return;
        // Already accepted/declined or expired? Tell the user and offer a way out.
        if (preview.expired) {
          setPhase({ kind: 'error', message: 'this invite has expired' });
          return;
        }
        if (preview.accepted) {
          setPhase({ kind: 'error', message: 'this invite was already accepted' });
          return;
        }
        if (preview.declined) {
          setPhase({ kind: 'error', message: 'this invite was already declined' });
          return;
        }
        setPhase({ kind: 'splash', preview });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'invite lookup failed';
        // The Edge Function returns 403 on "wrong recipient" — surface a
        // friendlier copy than the raw error text would give us.
        const friendly = msg.includes('403')
          ? 'this invite was sent to a different email. sign out + back in with the address it was sent to.'
          : msg.includes('404')
            ? 'invite not found — it may have been deleted or never existed.'
            : 'invite expired or invalid';
        setPhase({ kind: 'error', message: friendly });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, inviteId]);

  async function handleDecline() {
    if (!user) return;
    if (phase.kind !== 'splash') return;
    setPhase({ kind: 'submitting' });
    try {
      const result = await acceptGiftInvite({
        invite_id: phase.preview.invite_id,
        declined: true,
      });
      // "maybe later" — recipient is allowlisted but no profile written.
      // They land in canonical-only mode at /home and can fill profile later.
      markProfileStepSeen(user.id);
      pushToast(
        result.alreadyResolved
          ? "you're already in — translator stays generic"
          : "you're in — translator stays generic for now",
        'success',
      );
      navigate('/home', { replace: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[gift-accept] decline failed', err);
      pushToast("couldn't save — try again", 'error');
      // Re-show the splash so the user can retry.
      const preview = phase.preview;
      setPhase({ kind: 'splash', preview });
    }
  }

  async function handleAccept(finalProfile: PrefilledProfile) {
    if (!user) return;
    if (phase.kind !== 'wizard') return;
    const previewSnapshot = phase.preview;
    setPhase({ kind: 'submitting' });
    try {
      const result = await acceptGiftInvite({
        invite_id: previewSnapshot.invite_id,
        final_profile: finalProfile,
      });
      markProfileStepSeen(user.id);
      // B+1.10 (display_name push): prefer the recipient's confirmed
      // display_name in the toast. The wizard guarantees finalProfile
      // carries display_name (the user just confirmed it on step 1) —
      // fall back to the snapshot's display_name, then recipient_name.
      // Capitalization preserved verbatim — toast trusts the input.
      const greetingName =
        (finalProfile.display_name && finalProfile.display_name.trim().length > 0
          ? finalProfile.display_name
          : previewSnapshot.display_name && previewSnapshot.display_name.trim().length > 0
            ? previewSnapshot.display_name
            : previewSnapshot.recipient_name);
      pushToast(
        result.alreadyResolved
          ? `welcome back, ${greetingName}`
          : `welcome to jargon, ${greetingName}`,
        'success',
      );
      navigate(
        previewSnapshot.guided_program_id
          ? `/program/${previewSnapshot.guided_program_id}`
          : '/home',
        { replace: true },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[gift-accept] accept failed', err);
      pushToast("couldn't save — try again", 'error');
      setPhase({ kind: 'wizard', preview: previewSnapshot });
    }
  }

  if (phase.kind === 'loading' || phase.kind === 'submitting') {
    // B+1.15: brand the wait — recipient tapping a magic link from email
    // sees the wordmark immediately, not a bare loading line on a black
    // screen. "setting things up…" reads more recipient-aware than
    // "saving…" (recipient doesn't know what they're saving).
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base safe-top safe-bottom px-6">
        <Wordmark size={32} showDot className="text-accent-jargon mb-6" />
        <p className="text-sm text-text-muted">
          {phase.kind === 'submitting' ? 'setting things up…' : 'loading your invite…'}
        </p>
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg-base">
        <div className="w-full max-w-sm flex flex-col items-center">
          <Wordmark size={48} className="mb-6 text-accent-jargon" />
          <div className="bg-surface-card border border-border-default rounded-lg p-4 text-center w-full">
            <h2 className="text-base font-semibold text-text-primary">
              hmm, something's off
            </h2>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              {phase.message}
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="text-xs text-accent-jargon-hi mt-3 underline underline-offset-2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2"
            >
              go to splash
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === 'splash') {
    return (
      <SplashView
        preview={phase.preview}
        // B+1.10 — primary path: trust the sender's pre-fill, accept as-is,
        // land at /home. Recipient can edit anything from Settings later.
        // B+1.11 — removedFields is the set of profile keys the recipient
        // explicitly excluded via the transparency card-list. We strip them
        // from the final_profile before sending so the DB never stores them.
        onAcceptAsIs={(removedFields) => {
          if (!user) return;
          const previewSnapshot = phase.preview;
          // Map ROW keys (used in the transparency UI) to PROFILE keys.
          // Most are 1:1; 'background' → 'background_text'.
          const profileKeyForRow = (rowKey: string): keyof PrefilledProfile => {
            if (rowKey === 'background') return 'background_text';
            return rowKey as keyof PrefilledProfile;
          };
          const stripKeys = new Set<keyof PrefilledProfile>();
          for (const rk of removedFields) stripKeys.add(profileKeyForRow(rk));
          const baseProfile = { ...previewSnapshot.prefilled_profile };
          for (const k of stripKeys) {
            // Empty out the field — the atomic accept function will
            // sparse-merge so unset → DB default. Strings → null,
            // arrays → [].
            if (Array.isArray(baseProfile[k])) {
              (baseProfile as Record<string, unknown>)[k as string] = [];
            } else {
              (baseProfile as Record<string, unknown>)[k as string] = null;
            }
          }
          const finalProfile: PrefilledProfile = baseProfile;
          setPhase({ kind: 'submitting' });
          (async () => {
            try {
              const result = await acceptGiftInvite({
                invite_id: previewSnapshot.invite_id,
                final_profile: finalProfile,
              });
              markProfileStepSeen(user.id);
              const greetingName =
                previewSnapshot.display_name && previewSnapshot.display_name.trim().length > 0
                  ? previewSnapshot.display_name
                  : previewSnapshot.recipient_name;
              pushToast(
                result.alreadyResolved
                  ? `welcome back, ${greetingName}`
                  : `welcome to jargon, ${greetingName}`,
                'success',
              );
              navigate(
                previewSnapshot.guided_program_id
                  ? `/program/${previewSnapshot.guided_program_id}`
                  : '/home',
                { replace: true },
              );
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[gift-accept] one-tap accept failed', err);
              pushToast("couldn't save — try again", 'error');
              setPhase({ kind: 'splash', preview: previewSnapshot });
            }
          })();
        }}
        // Secondary path: open the 7-step confirm wizard for editing.
        onOpenWizard={() => setPhase({ kind: 'wizard', preview: phase.preview })}
        onDecline={handleDecline}
      />
    );
  }

  // phase.kind === 'wizard'
  return (
    <ConfirmWizard
      preview={phase.preview}
      onSubmit={handleAccept}
      onBackToSplash={() => setPhase({ kind: 'splash', preview: phase.preview })}
    />
  );
}

// ─── Splash ──────────────────────────────────────────────────────────────────

interface SplashViewProps {
  preview: GiftPreviewResponse;
  /** Single-tap accept — bypasses the 7-step wizard, accepts the prefilled
   *  profile as-is (minus any fields the recipient tapped "remove" on),
   *  lands at /home. Recipient can re-add anything from Settings later.
   *  removedFieldKeys is the set of profile keys the recipient excluded
   *  via the transparency card-list. */
  onAcceptAsIs: (removedFieldKeys: Set<string>) => void;
  /** Opens the 7-step confirm wizard for the recipient to edit fields. */
  onOpenWizard: () => void;
  onDecline: () => void;
}

function SplashView({ preview, onAcceptAsIs, onOpenWizard, onDecline }: SplashViewProps) {
  // B+1.11 (transparency push): tracks fields the recipient explicitly
  // excluded via the transparency card-list. On accept-as-is, the parent
  // builds the final_profile excluding these keys.
  const [removedFields, setRemovedFields] = useState<Set<string>>(() => new Set());
  const program = guidedProgram(preview.guided_program_id);
  // B+1.10: surface the sender-picked domain (if any) so the recipient knows
  // up-front which vocabulary they're learning. Read-only on the recipient
  // side — domain choice is part of the gift, not the wizard.
  const activeDomain = (preview.prefilled_profile.active_domain ?? '').trim();
  // Prefer display_name over recipient_name in the greeting. display_name
  // is what the sender said to call them ("Pop"); recipient_name is often
  // the formal email-derived full name. Capitalization
  // is preserved verbatim — only the literal "hi" stays lowercase via
  // a span wrapper.
  const greetingName =
    preview.display_name && preview.display_name.trim().length > 0
      ? preview.display_name
      : preview.recipient_name;
  // Sender attribution — when known, surface as "{sender} made this — and
  // set it up for you specifically." so recipient knows the SENDER built
  // jargon, not just shared an account.
  const senderAttribution =
    preview.sender_display === 'Someone'
      ? 'someone made this — and set it up for you specifically.'
      : `${preview.sender_display} made this — and set it up for you specifically.`;
  // Sender first-name for the preview-card eyebrow ("what kevin put down for you")
  const senderFirstName =
    preview.sender_display === 'Someone' ? 'they' : preview.sender_display.split(' ')[0];
  // B+1.11 — surface the sender's relationship label subtly under the
  // attribution line ("you're {sender}'s {relationship}"). Only renders when
  // BOTH the relationship is set AND the sender_display is known (otherwise
  // the line reads as a strange floating fact). Uses the sender first name
  // for the same readability reason as the preview-card eyebrow above.
  const relationshipLabel = (preview.prefilled_profile.relationship ?? '').trim();
  const relationshipLine =
    relationshipLabel.length > 0 && preview.sender_display !== 'Someone'
      ? `you're ${senderFirstName}'s ${relationshipLabel}.`
      : null;

  // Transparency card-list — surface EVERY non-empty field the sender
  // pre-filled, each as its own row, with a tap-to-remove button.
  // Design call (B+1.11): "show the recipient exactly what we know about them.
  // each row tappable to remove. casual privacy copy at the bottom."
  // private_reasoning is INTENTIONALLY excluded — sender's note to
  // themselves, never flows to the recipient (gift_invites column only).
  const profile = preview.prefilled_profile;
  type Row = { key: string; label: string; render: () => React.ReactNode };
  const interestsList = (profile.interests ?? []).filter(
    (s) => typeof s === 'string' && s.trim().length > 0,
  );
  // Used by the alternative non-card layout further down — first 4 only,
  // remainder rendered as "+N more". (Pre-existing #4 reference fix.)
  // (interestsTopFour was used by the prior 3-axis preview; transparency
  // card-list now shows the FULL interest list, so this slicing is obsolete.)
  void interestsList;
  const rolesList = (profile.roles ?? []).filter(
    (s) => typeof s === 'string' && s.trim().length > 0,
  );
  const goalsFreeform = (profile.goals_freeform ?? '').trim();
  const job = (profile.job ?? '').trim();
  const heritage = (profile.heritage ?? '').trim();
  const background = (profile.background_text ?? '').trim();
  const displayNamePref = (profile.display_name ?? '').trim();
  const allRows: Row[] = [
    displayNamePref.length > 0 && {
      key: 'display_name',
      label: 'what to call you',
      render: () => <span>{displayNamePref}</span>,
    },
    job.length > 0 && {
      key: 'job',
      label: 'work',
      render: () => <span>{job}</span>,
    },
    heritage.length > 0 && {
      key: 'heritage',
      label: 'from',
      render: () => <span>{heritage}</span>,
    },
    interestsList.length > 0 && {
      key: 'interests',
      label: 'into',
      render: () => <span>{interestsList.join(' · ')}</span>,
    },
    rolesList.length > 0 && {
      key: 'roles',
      label: 'roles',
      render: () => <span>{rolesList.join(' · ')}</span>,
    },
    goalsFreeform.length > 0 && {
      key: 'goals_freeform',
      label: 'why jargon',
      render: () => <span className="whitespace-pre-wrap">{goalsFreeform}</span>,
    },
    background.length > 0 && {
      key: 'background',
      label: 'extra',
      render: () => <span className="whitespace-pre-wrap">{background}</span>,
    },
  ].filter(Boolean) as Row[];
  const hasAnyPreview = allRows.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="px-4 py-4 shrink-0">
        {/* Wordmark left-aligned but anchored to the body's max-w column so
            on tablet/desktop it doesn't orphan in the top-left corner of a
            wide viewport while the body sits centered. */}
        <div className="max-w-md mx-auto w-full">
          <Wordmark size={20} showDot />
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-md mx-auto w-full flex flex-col">
        <div className="mt-4">
          <h1 className="text-3xl font-semibold text-text-primary leading-tight">
            <span className="lowercase">hi</span> {greetingName},
          </h1>
          <p className="text-sm text-text-secondary mt-3 leading-relaxed">
            {senderAttribution}
          </p>
          {relationshipLine && (
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              {relationshipLine}
            </p>
          )}
        </div>

        {preview.custom_message && (
          <div className="mt-6 bg-surface-card border border-border-default rounded-lg p-4">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {preview.custom_message}
            </p>
          </div>
        )}

        {program && (
          <div className="mt-6">
            <GuidedProgramCard program={program} />
            <p className="mt-2 px-1 text-xs leading-relaxed text-text-muted">
              accepting attaches this course to your profile and keeps your
              learning view focused on its vocabulary.
            </p>
          </div>
        )}

        {/* "what's jargon" — sharper, more personal copy */}
        <div className="mt-6 bg-surface-card border border-border-default rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-accent-jargon-hi font-semibold">
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

        {/* B+1.14 — AI badge above the transparency card-list. The single
            generated mark is the FIRST visual element under the greeting,
            sized 96pt for hero placement. Falls back to the legacy 1-3
            Phosphor strip when the sender's gift-send didn't yet have a
            generated URL (race window between background generation and
            invite send). */}
        <LivedIconBadge
          url={preview.prefilled_profile.lived_icon_url ?? null}
          fallbackSlugs={preview.prefilled_profile.lived_icons ?? []}
          size={96}
          fallbackTone="accent-hi"
          className="mt-6 self-center"
        />

        {/* B+1.11 — transparency card-list. Every non-empty profile field
            as its own row, each with a remove/keep toggle. Casual privacy
            reassurance at the bottom. Per Kevin's AskUserQuestion. */}
        {hasAnyPreview && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wider text-accent-jargon-hi font-semibold px-1">
              this is what {senderFirstName} shared about you
            </p>
            {allRows.map((row) => {
              const isRemoved = removedFields.has(row.key);
              return (
                <div
                  key={row.key}
                  className={[
                    'rounded-lg p-3 flex items-start gap-2 border transition-colors',
                    isRemoved
                      ? 'bg-bg-base border-border-default opacity-50'
                      : 'bg-surface-card border-border-default',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-2xs uppercase tracking-wider text-text-muted font-mono">
                      {row.label}
                    </p>
                    <div
                      className={[
                        'text-sm leading-snug mt-1 break-words',
                        isRemoved ? 'text-text-muted line-through' : 'text-text-primary',
                      ].join(' ')}
                    >
                      {row.render()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRemovedFields((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.key)) next.delete(row.key);
                        else next.add(row.key);
                        return next;
                      });
                    }}
                    aria-label={isRemoved ? `keep ${row.label}` : `remove ${row.label}`}
                    className={[
                      'shrink-0 min-h-[44px] min-w-[44px] px-2 text-xs lowercase font-mono rounded-md transition-colors',
                      isRemoved
                        ? 'text-accent-jargon-hi bg-accent-jargon/[0.12] border border-accent-jargon'
                        : 'text-text-muted hover:text-text-secondary',
                    ].join(' ')}
                  >
                    {isRemoved ? 'keep' : 'remove'}
                  </button>
                </div>
              );
            })}
            <p className="text-xs text-text-muted leading-relaxed mt-2 px-1">
              this is everything {senderFirstName} told us. that's it. no surprise data.
            </p>
            {activeDomain.length > 0 && (
              <p className="text-xs text-text-secondary leading-relaxed mt-3 px-1">
                jargon will translate every term through{' '}
                <span className="text-text-primary font-medium">your world</span> —
                grounded in what you actually know.
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-8 flex flex-col gap-2">
          {/* Primary: one-tap accept (with any "removed" fields excluded).
              B+1.16: hover lifts 1pt + brightens to accent-jargon-hi for
              the first-impression-of-jargon moment. Subtle pressure-feedback
              shadow says "this button is pressable." */}
          <button
            type="button"
            onClick={() => onAcceptAsIs(removedFields)}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 transition-all duration-200 hover:bg-accent-jargon-hi hover:-translate-y-[2px] hover:shadow-lg hover:shadow-accent-jargon/30 active:translate-y-0 active:bg-accent-jargon-lo active:shadow-none"
          >
            {program ? 'looks right — start the course' : "looks right — let's go"}
          </button>
          {/* Secondary: open wizard for editing. */}
          <button
            type="button"
            onClick={onOpenWizard}
            className="group w-full bg-surface-card border border-border-default text-text-secondary font-medium rounded-lg min-h-[44px] px-4 transition-all duration-200 hover:border-accent-jargon/40 hover:bg-surface-card-hi hover:text-text-primary active:bg-surface-card-hi text-sm inline-flex items-center justify-center gap-1"
          >
            edit something first
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </button>
          {/* Tertiary decline. */}
          <button
            type="button"
            onClick={onDecline}
            className="w-full text-text-muted text-xs min-h-[44px] px-4 transition-colors hover:text-text-secondary active:text-text-secondary mt-1"
          >
            maybe later
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Confirm wizard ──────────────────────────────────────────────────────────

interface ConfirmWizardProps {
  preview: GiftPreviewResponse;
  onSubmit: (final: PrefilledProfile) => Promise<void> | void;
  onBackToSplash: () => void;
}

interface WizardAnswers extends PrefilledProfile {}

function ConfirmWizard({ preview, onSubmit, onBackToSplash }: ConfirmWizardProps) {
  // Pre-load the sender's guesses. The recipient can edit any of them via the
  // "nope, change it" path on each step, or accept via "yep that's right" /
  // plain "next →".
  const [answers, setAnswers] = useState<WizardAnswers>(() => {
    const p = preview.prefilled_profile;
    return {
      goals_extended: p.goals_extended ?? [],
      // B+1.10: PrefilledProfile gained goals_freeform. Old payloads (gifts
      // sent before this deploy) won't have the key — fall through to ''.
      goals_freeform: p.goals_freeform ?? '',
      job: p.job ?? null,
      encounter_contexts: p.encounter_contexts ?? [],
      interests: p.interests ?? [],
      heritage: p.heritage ?? null,
      roles: p.roles ?? [],
      background_text: p.background_text ?? null,
      // active_domain is sender-controlled, recipient-readonly. Stored on the
      // wizard answers so it round-trips into the final_profile payload
      // without needing extra plumbing.
      active_domain: p.active_domain ?? null,
      // B+1.10 (display_name push): seed from sender pick OR from the
      // top-level preview.display_name (same value, two paths). Recipient
      // gets to confirm or edit via the new step 1.
      display_name: p.display_name ?? preview.display_name ?? null,
    };
  });
  const [step, setStep] = useState<StepIndex>(1);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  // Per-step "editing mode": when the recipient taps "nope, change it", we
  // clear that step's value and switch the step into editable mode. Tapping
  // "yep that's right" (or "next →" without changing) keeps the prefilled
  // value as-is.
  const [editing, setEditing] = useState<Set<StepIndex>>(new Set());

  function patch<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function isEditing(s: StepIndex) {
    return editing.has(s);
  }

  function setEditingFor(s: StepIndex, on: boolean) {
    setEditing((prev) => {
      const next = new Set(prev);
      if (on) next.add(s);
      else next.delete(s);
      return next;
    });
  }

  function clearStepValue(s: StepIndex) {
    // B+1.10 (display_name push): step 1 is now display_name; the rest
    // shifted +1.
    if (s === 1) patch('display_name', null);
    if (s === 2) {
      patch('goals_extended', []);
      patch('goals_freeform', '');
    }
    if (s === 3) patch('job', null);
    if (s === 4) patch('encounter_contexts', []);
    if (s === 5) patch('interests', []);
    if (s === 6) patch('heritage', null);
    if (s === 7) patch('roles', []);
    if (s === 8) patch('background_text', null);
  }

  function goNext() {
    if (step === TOTAL_STEPS) {
      void onSubmit(answers);
      return;
    }
    setDirection('forward');
    setStep((s) => (s + 1) as StepIndex);
  }

  function goBack() {
    if (step === 1) {
      onBackToSplash();
      return;
    }
    setDirection('back');
    setStep((s) => (s - 1) as StepIndex);
  }

  // Whether this step has a non-empty pre-filled value. Drives whether we
  // render the "yep that's right" / "nope, change it" pair vs the plain
  // editable input (when the field was empty in the original prefilled
  // profile, there's nothing to confirm — show the editor directly).
  const stepHasPrefill = useMemo(() => {
    switch (step) {
      // B+1.10 (display_name push): step 1 is now display_name confirm.
      case 1: return Boolean(answers.display_name && answers.display_name.trim().length > 0);
      case 2: return (
        answers.goals_extended.length > 0 ||
        Boolean(answers.goals_freeform && answers.goals_freeform.trim().length > 0)
      );
      case 3: return Boolean(answers.job && answers.job.trim().length > 0);
      case 4: return answers.encounter_contexts.length > 0;
      case 5: return answers.interests.length > 0;
      case 6: return Boolean(answers.heritage && answers.heritage.trim().length > 0);
      case 7: return answers.roles.length > 0;
      case 8: return Boolean(answers.background_text && answers.background_text.trim().length > 0);
    }
  }, [step, answers]);

  // If the step has no prefilled value, jump it straight into editing mode
  // — there's nothing to confirm.
  useEffect(() => {
    if (!stepHasPrefill) {
      setEditingFor(step, true);
    }
  }, [step, stepHasPrefill]);

  const showConfirmer = stepHasPrefill && !isEditing(step);

  return (
    <div className="h-screen flex flex-col bg-bg-base safe-top safe-bottom overflow-hidden">
      <header className="px-4 py-4 shrink-0">
        {/* Wizard header anchored to body's max-w column so wordmark + back
            don't orphan at the screen edges on tablet/desktop. */}
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Wordmark size={20} showDot />
          <button
            type="button"
            onClick={goBack}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary text-sm lowercase active:text-text-primary transition-colors"
            aria-label="back"
          >
            ‹ back
          </button>
        </div>
      </header>

      <div className="px-4 pt-2 pb-4 shrink-0 max-w-md mx-auto w-full">
        <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2">
          step {step} of {TOTAL_STEPS}
        </p>
        <div className="flex gap-1 w-full">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
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
          <ConfirmStep
            step={step}
            answers={answers}
            recipientName={preview.recipient_name}
            showConfirmer={showConfirmer}
            onYep={() => setEditingFor(step, false)}
            onNope={() => {
              clearStepValue(step);
              setEditingFor(step, true);
            }}
            onPatch={patch}
          />
        </StepFrame>
      </main>

      <footer className="px-4 pt-4 pb-4 shrink-0 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={goNext}
          className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 active:bg-accent-jargon-lo transition-colors"
        >
          {step === TOTAL_STEPS ? 'save and start' : 'next →'}
        </button>
      </footer>
    </div>
  );
}

// ─── Step body (shared between confirmer + editor surfaces) ──────────────────

interface ConfirmStepProps {
  step: StepIndex;
  answers: WizardAnswers;
  recipientName: string;
  showConfirmer: boolean;
  onYep: () => void;
  onNope: () => void;
  onPatch: <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => void;
}

function ConfirmStep({
  step,
  answers,
  recipientName: _recipientName,
  showConfirmer,
  onYep,
  onNope,
  onPatch,
}: ConfirmStepProps) {
  // recipientName is reserved for future per-step copy interpolation; the
  // current confirmer copy stays second-person ("you"), so we don't use it
  // yet but keep the prop on the shape.
  const stepConfig = STEP_CONFIG[step];

  if (showConfirmer) {
    return (
      <>
        <StepHeading title={stepConfig.title} helper={stepConfig.confirmHelper} />
        <div className="bg-surface-card border border-border-default rounded-lg p-4">
          <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mb-2">
            their guess
          </p>
          <PreviewValue step={step} answers={answers} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onYep}
            className="w-full bg-accent-jargon/[0.12] border border-accent-jargon text-text-primary font-semibold rounded-lg min-h-[56px] px-4 active:bg-accent-jargon/20 transition-colors"
          >
            yep, that's right
          </button>
          <button
            type="button"
            onClick={onNope}
            className="w-full bg-surface-card border border-border-default text-text-secondary font-medium rounded-lg min-h-[56px] px-4 active:bg-surface-card-hi transition-colors text-sm"
          >
            nope, change it
          </button>
        </div>
      </>
    );
  }

  // Editor mode — re-uses the same input components as the sender wizard
  // (kept here directly to avoid a ProfileForm split that'd add coupling
  // for a one-off variant).
  return (
    <>
      <StepHeading title={stepConfig.title} helper={stepConfig.editHelper} />
      <StepEditor step={step} answers={answers} onPatch={onPatch} />
    </>
  );
}

// ─── Per-step config (titles + helpers) ──────────────────────────────────────

const STEP_CONFIG: Record<StepIndex, { title: string; confirmHelper: string; editHelper: string }> = {
  // B+1.10 (display_name push) — new step 1 is the display-name confirmer.
  // Confirmer copy uses "they put down" / "yep / nope, change it" pattern.
  1: {
    title: 'what should we call you?',
    confirmHelper: "they put this down for you. yep — or nope, change it.",
    editHelper: 'whatever you want greetings + welcome notes to use. capitalization stays exactly as you type it.',
  },
  2: {
    title: 'what brings you to jargon?',
    confirmHelper: 'they took a guess at why you might be here.',
    editHelper: 'say it however it lives in your head — or tap any of the common ones below.',
  },
  3: {
    title: 'what do you do for work?',
    confirmHelper: 'this is what they put down for you.',
    editHelper: 'this is the analogy domain we lean on first.',
  },
  4: {
    title: 'where do you usually run into these terms?',
    confirmHelper: 'they took a guess at where you bump into dev jargon.',
    editHelper: 'pick all that apply.',
  },
  5: {
    title: 'what are you into?',
    confirmHelper: 'their best read on what you nerd out about.',
    editHelper: 'tap as many as you want, or type your own.',
  },
  6: {
    title: 'where are you from?',
    confirmHelper: 'this is what they put down for where you grew up.',
    editHelper: 'country, region, city — wherever shaped you.',
  },
  7: {
    title: 'any roles that define you?',
    confirmHelper: 'their take on roles that shape how you see the world.',
    editHelper: 'tap any that fit.',
  },
  8: {
    title: 'anything else that helps us translate?',
    confirmHelper: "their note about anything else we'd want to know.",
    editHelper: 'optional. the more specific the better.',
  },
};

interface PreviewValueProps {
  step: StepIndex;
  answers: WizardAnswers;
}

function PreviewValue({ step, answers }: PreviewValueProps) {
  // Render the prefilled value in a read-only way — chips for arrays, plain
  // text for text fields. The confirmer screen needs to be glanceable.
  // Capitalization is preserved verbatim across every case — no force-lower
  // / force-upper class anywhere. The display_name case (step 1) is the
  // load-bearing one per the B+1.10 capitalization rule.
  switch (step) {
    // B+1.10 (display_name push) — step 1 is now display_name. Render
    // verbatim; trust whatever the sender typed.
    case 1:
      return (
        <p className="text-base text-text-primary leading-relaxed">
          {answers.display_name}
        </p>
      );
    case 2: {
      // freeform-first goals. Show the freeform "why" if the sender wrote
      // one; show any chips below as a secondary signal.
      const freeform = answers.goals_freeform?.trim() ?? '';
      const chips = answers.goals_extended;
      return (
        <div className="flex flex-col gap-3">
          {freeform.length > 0 && (
            <p className="text-base text-text-primary leading-relaxed whitespace-pre-wrap">
              {freeform}
            </p>
          )}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center min-h-[36px] px-3 rounded-full text-sm bg-bg-base border border-border-default text-text-primary"
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 4:
    case 7: {
      const arr = step === 4 ? answers.encounter_contexts : answers.roles;
      return (
        <div className="flex flex-wrap gap-2">
          {arr.map((v) => (
            <span
              key={v}
              className="inline-flex items-center min-h-[36px] px-3 rounded-full text-sm bg-bg-base border border-border-default text-text-primary"
            >
              {v}
            </span>
          ))}
        </div>
      );
    }
    case 5:
      return (
        <div className="flex flex-wrap gap-2">
          {answers.interests.map((v) => (
            <span
              key={v}
              className="inline-flex items-center min-h-[36px] px-3 rounded-full text-sm bg-bg-base border border-border-default text-text-primary"
            >
              {v}
            </span>
          ))}
        </div>
      );
    case 3:
      return (
        <p className="text-base text-text-primary leading-relaxed">{answers.job}</p>
      );
    case 6:
      return (
        <p className="text-base text-text-primary leading-relaxed">{answers.heritage}</p>
      );
    case 8:
      return (
        <p className="text-base text-text-primary leading-relaxed whitespace-pre-wrap">
          {answers.background_text}
        </p>
      );
  }
}

// ─── Editor components (same shape as onboarding wizard) ─────────────────────

interface StepEditorProps {
  step: StepIndex;
  answers: WizardAnswers;
  onPatch: <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => void;
}

function StepEditor({ step, answers, onPatch }: StepEditorProps) {
  switch (step) {
    // B+1.10 (display_name push) — step 1 is now display_name. SingleTextField
    // pattern preserves capitalization verbatim; user can clear by deleting
    // and tapping NEXT (the recipient's "nope, change it" path already
    // cleared the value before we got here).
    case 1:
      return (
        <SingleTextField
          value={answers.display_name ?? ''}
          maxLength={MAX_DISPLAY_NAME_CHARS}
          placeholder="first name, nickname, whatever feels right"
          onChange={(v) => onPatch('display_name', v.trim() ? v : null)}
        />
      );
    case 2:
      return (
        <>
          <TextareaField
            value={answers.goals_freeform ?? ''}
            maxLength={MAX_GOALS_FREEFORM_CHARS}
            rows={5}
            placeholder="say it however it lives in your head — the real reason"
            onChange={(v) => onPatch('goals_freeform', v)}
            showCounter
          />
          <p className="text-2xs uppercase tracking-wider text-text-muted font-mono mt-6 mb-2">
            or pick from common ones
          </p>
          <ChipMultiSelect
            options={GOAL_OPTIONS}
            value={answers.goals_extended}
            onChange={(v) => onPatch('goals_extended', v)}
          />
        </>
      );
    case 3:
      return (
        <TextareaField
          value={answers.job ?? ''}
          maxLength={240}
          rows={5}
          placeholder="e.g. middle-school art teacher in toledo · ER nurse at memorial hospital"
          onChange={(v) => onPatch('job', v.trim() || null)}
        />
      );
    case 4:
      return (
        <ChipMultiSelect
          options={ENCOUNTER_OPTIONS}
          value={answers.encounter_contexts}
          onChange={(v) => onPatch('encounter_contexts', v)}
        />
      );
    case 5:
      return (
        <InterestsField
          value={answers.interests}
          onChange={(v) => onPatch('interests', v)}
        />
      );
    case 6:
      return (
        <SingleTextField
          value={answers.heritage ?? ''}
          maxLength={MAX_HERITAGE_CHARS}
          placeholder="e.g. glasgow, scotland · denver, CO · mexico → texas"
          onChange={(v) => onPatch('heritage', v.trim() ? v : null)}
        />
      );
    case 7:
      return (
        <ChipMultiSelect
          options={ROLE_OPTIONS}
          value={answers.roles}
          onChange={(v) => onPatch('roles', v)}
        />
      );
    case 8:
      return (
        <TextareaField
          value={answers.background_text ?? ''}
          maxLength={MAX_BACKGROUND_CHARS}
          rows={4}
          placeholder="hobbies, weird trivia — the more specific the better"
          onChange={(v) => onPatch('background_text', v.trim() ? v : null)}
          showCounter
        />
      );
  }
}

// ─── Reusable atoms ──────────────────────────────────────────────────────────

interface ChipMultiSelectProps {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}

function ChipMultiSelect({ options, value, onChange }: ChipMultiSelectProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((chip) => (
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
  );
}

interface SingleTextFieldProps {
  value: string;
  maxLength: number;
  placeholder: string;
  onChange: (next: string) => void;
}

function SingleTextField({ value, maxLength, placeholder, onChange }: SingleTextFieldProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      maxLength={maxLength}
      autoComplete="off"
      autoFocus
      className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px]"
    />
  );
}

interface TextareaFieldProps {
  value: string;
  maxLength: number;
  rows: number;
  placeholder: string;
  onChange: (next: string) => void;
  showCounter?: boolean;
}

function TextareaField({
  value,
  maxLength,
  rows,
  placeholder,
  onChange,
  showCounter,
}: TextareaFieldProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <>
      <textarea
        value={local}
        onChange={(e) => {
          if (e.target.value.length <= maxLength) {
            setLocal(e.target.value);
            onChange(e.target.value);
          }
        }}
        placeholder={placeholder}
        rows={rows}
        autoFocus
        className="w-full bg-surface-card border border-border-default rounded-lg px-3 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon resize-none"
      />
      {showCounter && (
        <p className="text-2xs text-text-muted mt-2 font-mono tabular-nums text-right">
          {local.length} / {maxLength}
        </p>
      )}
    </>
  );
}

interface InterestsFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
}

function InterestsField({ value, onChange }: InterestsFieldProps) {
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

// ─── Frame + heading + chip ──────────────────────────────────────────────────

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
