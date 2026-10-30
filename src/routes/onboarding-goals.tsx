import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { Wordmark } from '../components/wordmark';
import { markGoalsStepSeen } from '../lib/onboarding-session';
import { ErrorBoundary } from './error-boundary';

export default function OnboardingGoals() {
  return (
    <ErrorBoundary>
      <OnboardingGoalsContent />
    </ErrorBoundary>
  );
}

function OnboardingGoalsContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const ensureExists = useSettingsStore((s) => s.ensureExists);
  const update = useSettingsStore((s) => s.update);
  const [followClaude, setFollowClaude] = useState(true);
  const [talkToFamily, setTalkToFamily] = useState(true);
  const [busy, setBusy] = useState(false);

  async function letsGo() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await ensureExists(user.id);
      await update(user.id, {
        goal_follow_claude: followClaude,
        goal_talk_to_family: talkToFamily,
      });
      markGoalsStepSeen(user.id);
      navigate('/onboarding/diagnostic', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await ensureExists(user.id);
      // Skip carries the implicit "I don't want either gate" — we lock both
      // goals to true (the defaults) AND mark the diagnostic done so the user
      // doesn't get bounced into a second skipped screen.
      await update(user.id, {
        goal_follow_claude: true,
        goal_talk_to_family: true,
        diagnostic_completed: true,
      });
      markGoalsStepSeen(user.id);
      navigate('/home', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      <header className="px-4 py-6 flex items-center justify-center">
        <Wordmark size={24} showDot />
      </header>

      <main className="flex-1 flex flex-col px-4 py-6 max-w-md mx-auto w-full">
        <h2 className="text-2xl font-semibold text-text-primary lowercase">
          what brings you here?
        </h2>
        <p className="text-sm text-text-secondary mt-2">
          we’ll tune lessons toward whichever goals you pick.
        </p>

        <div className="flex flex-col gap-3 mt-8">
          <GoalToggle
            label="follow what claude code is doing"
            checked={followClaude}
            onChange={setFollowClaude}
          />
          <GoalToggle
            label="talk to dev family without flinching"
            checked={talkToFamily}
            onChange={setTalkToFamily}
          />
        </div>

        <div className="mt-auto pt-12 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={letsGo}
            disabled={busy}
            className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] active:bg-accent-jargon-lo transition-colors disabled:opacity-60"
          >
            let’s go
          </button>
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="text-xs text-text-muted underline underline-offset-2 min-h-[44px] px-4 active:text-text-secondary transition-colors disabled:opacity-60"
          >
            skip for now
          </button>
        </div>
      </main>
    </div>
  );
}

interface GoalToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Button-style toggle (per Kevin's "button toggles, not iOS switches" rule).
 * Whole row is the touch target — 56pt min height. Checkbox glyph is rendered
 * inline so we don't take an icon dep.
 */
function GoalToggle({ label, checked, onChange }: GoalToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 transition-colors border ${
        checked
          ? 'bg-accent-jargon/[0.12] border-accent-jargon'
          : 'bg-surface-card border-border-default'
      }`}
    >
      <span
        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
          checked
            ? 'bg-accent-jargon border-accent-jargon'
            : 'bg-bg-base border-border-default'
        }`}
        aria-hidden="true"
      >
        {checked && (
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-bg-base"
          >
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        )}
      </span>
      <span className="text-base text-text-primary font-medium leading-snug">{label}</span>
    </button>
  );
}
