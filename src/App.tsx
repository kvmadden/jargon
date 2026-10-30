import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useUserStore } from './stores/user-store';
import { useSettingsStore } from './stores/settings-store';
import { fetchStreakLog, fetchUserProfile } from './lib/data';
import { hasSeenProfileStep, hasSeenGoalsStep } from './lib/onboarding-session';
import { shouldPromptFreeze } from './lib/streak-engine';
import { checkAndRefillStreakFreezes, DEFAULT_FREEZE_CAP } from './lib/streak-freeze';
import { useToastStore, ToastHost } from './components/toast';
import { StreakFreezeSheet } from './components/streak-freeze-sheet';
import { CommandPaletteHost } from './components/command-palette-host';
import { VersionPill } from './components/version-pill';
import { FeedbackLauncher } from './features/feedback/feedback-launcher';
import { ErrorBoundary } from './routes/error-boundary';

// Eager imports — hot paths the user hits on every session.
import Splash from './routes/splash';
import OnboardingGoals from './routes/onboarding-goals';
import OnboardingDiagnostic from './routes/onboarding-diagnostic';
import Home from './routes/home';
import PathDetail from './routes/path-detail';
import LessonSummary from './routes/lesson-summary';
import Review from './routes/review';
import Profile from './routes/profile';
import TermDetail from './routes/term-detail';
import WhatsNew from './routes/whats-new';

// Lazy imports — heavy wizards (~3k LOC combined) that fire at most a few
// times per user lifetime. Splitting these drops the initial bundle by
// ~40-50kb gzipped, which matters most for first-paint on mobile.
// Suspense fallback is the same "loading…" shell used elsewhere.
//
// B+1.5.6: Settings split too — became substantial after gaining the
// diagnostic panel (personalize stats + spending tile + ingestion stats).
// Users open Settings occasionally, not every navigation.
const LessonRunner = lazy(() => import('./routes/lesson-runner'));
const OnboardingProfile = lazy(() => import('./routes/onboarding-profile'));
const GiftSend = lazy(() => import('./routes/gift-send'));
const GiftAccept = lazy(() => import('./routes/gift-accept'));
const Settings = lazy(() => import('./routes/settings'));
// B+1.6 Batch 2: "spotted in the wild" paste-mode route. Pulls the
// dictionary + user_progress + lazy personalization. Lives off the
// main bundle since it's only opened deliberately (from Settings).
const Spotted = lazy(() => import('./routes/spotted'));
// B+1.6 Batch 3: mastered-terms gallery + print-friendly view. Same
// rationale for splitting — opened deliberately from profile.
const Mastered = lazy(() => import('./routes/mastered'));
// 2026-05-31: atlas — standalone concept-atlas reference page (public, no auth).
const Atlas = lazy(() => import('./routes/atlas'));
// 2026-07-15: /questions — reviewable inbox for questions saved via
// <LessonQuestionButton> during a lesson. Same lazy-split rationale as
// Mastered/Spotted — opened deliberately, not a hot path.
const Questions = lazy(() => import('./routes/questions'));
const DeleteAccount = lazy(() => import('./routes/delete-account'));
const Feedback = lazy(() => import('./routes/feedback'));
const GuidedProgram = lazy(() => import('./routes/guided-program'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <p className="text-sm text-text-muted">loading…</p>
    </div>
  );
}

/**
 * Stage B+1.4-B: AuthGate now checks ONLY for an authenticated session. The
 * dynamic allowlist (`allowed_users` table) is enforced by:
 *   1) /splash via the `check-allowlist` Edge Function — denied users see
 *      "invite-only" instead of routing into /home.
 *   2) Every Edge Function (grade-sentence, personalize-term, send-gift-invite,
 *      etc.) which calls `isAllowlisted` server-side before doing any work.
 * The previous client-side `ALLOWED_EMAIL` comparison was a duplicate gate
 * that had to be kept in sync — now the server is the single source of truth.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useUserStore((s) => s.user);
  const loading = useUserStore((s) => s.loading);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// streak-freeze refill logic now lives in ./lib/streak-freeze (shared with the
// settings screen). re-exported here for back-compat with existing imports/tests.
export { checkAndRefillStreakFreezes, DEFAULT_FREEZE_CAP };

function NeedsOnboarding({ children }: { children: React.ReactNode }) {
  const user = useUserStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);
  const updateSettings = useSettingsStore((s) => s.update);
  const [checked, setChecked] = useState(false);
  // Stage B+1 — onboarding now has a 3rd step (profile / personalized translator).
  // We treat "profile step done" as "the user has either filled it OR explicitly
  // skipped it in this session." A skip leaves no row in user_profile (canonical
  // mode), so we mark a session flag rather than write a placeholder row.
  const [profileStepDone, setProfileStepDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await loadSettings(user.id);
      if (cancelled) return;
      const currentSettings = useSettingsStore.getState().settings;
      if (currentSettings) {
        await checkAndRefillStreakFreezes(user.id, currentSettings, updateSettings);
      }
      // Profile-step completion check: row exists in user_profile OR the user
      // skipped the screen earlier this session.
      const profile = await fetchUserProfile(user.id).catch(() => null);
      if (cancelled) return;
      // Note: cross-device skip-persistence is a future item (needs a settings column).
      const skipped = hasSeenProfileStep(user.id);
      setProfileStepDone(profile !== null || skipped);
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadSettings, updateSettings]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <p className="text-sm text-text-muted">loading…</p>
      </div>
    );
  }
  // Goals → diagnostic → profile → home. If diagnostic isn't done, send the
  // user to whichever earlier step they haven't seen yet — bouncing them all
  // the way back to /onboarding/goals when they only bailed on the diagnostic
  // would force a redo of toggles they already set. Pre-deploy review B3.
  if (!settings || !settings.diagnostic_completed) {
    if (!user || !hasSeenGoalsStep(user.id)) {
      return <Navigate to="/onboarding/goals" replace />;
    }
    return <Navigate to="/onboarding/diagnostic" replace />;
  }
  // Order: goals → diagnostic → profile → home. Profile is the only optional step
  // (skip = canonical mode), but we still gate on it being seen so a returning
  // user without a profile row doesn't get repeatedly bounced into the form.
  if (!profileStepDone) {
    return <Navigate to="/onboarding/profile" replace />;
  }
  return <>{children}</>;
}

function StreakFreezeWatcher() {
  const user = useUserStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const pushToast = useToastStore((s) => s.push);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [gap, setGap] = useState(0);
  const [checked, setChecked] = useState(false);

  // Check once per session, only after user lands somewhere inside the app
  useEffect(() => {
    if (!user || !settings || checked) return;
    if (
      location.pathname === '/' ||
      location.pathname === '/welcome' ||
      location.pathname.startsWith('/onboarding')
    ) return;
    let cancelled = false;
    (async () => {
      await checkAndRefillStreakFreezes(user.id, settings, updateSettings);
      if (cancelled) return;
      const log = await fetchStreakLog(user.id);
      if (cancelled) return;
      const lastDate = log[0]?.local_date ?? null;
      const latestSettings = useSettingsStore.getState().settings ?? settings;
      const result = shouldPromptFreeze(lastDate, latestSettings.streak_freezes_available);
      if (result.prompt) {
        setGap(result.gap);
        setOpen(true);
      }
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, settings, location.pathname, checked, updateSettings]);

  async function useFreeze() {
    if (!user || !settings) return;
    const cost = Math.max(0, gap - 1);
    const remaining = Math.max(0, settings.streak_freezes_available - cost);
    await updateSettings(user.id, { streak_freezes_available: remaining });
    pushToast(`streak saved — ${cost} freeze${cost === 1 ? '' : 's'} used`, 'success');
    setOpen(false);
  }

  return (
    <StreakFreezeSheet
      open={open}
      gap={gap}
      freezesAvailable={settings?.streak_freezes_available ?? 0}
      onUseFreeze={useFreeze}
      onDecline={() => setOpen(false)}
    />
  );
}

export default function App() {
  const init = useUserStore((s) => s.init);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    init().then((u) => {
      if (cancelled) {
        // StrictMode double-invoke / HMR re-mount: drop the subscription we just made
        // since the cleanup below has already fired.
        u();
        return;
      }
      unsubscribe = u;
    });
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [init]);

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Splash />} />
            {/* Backwards-compat alias — Stage A's /welcome (the "let's go" shim) now
                routes through to the goals screen. New users come in via /onboarding/goals
                directly. Kept so existing magic links / bookmarks don't 404. */}
            <Route path="/welcome" element={<Navigate to="/onboarding/goals" replace />} />
            <Route
              path="/onboarding/goals"
              element={
                <AuthGate>
                  <OnboardingGoals />
                </AuthGate>
              }
            />
            <Route
              path="/onboarding/diagnostic"
              element={
                <AuthGate>
                  <OnboardingDiagnostic />
                </AuthGate>
              }
            />
            <Route
              path="/onboarding/profile"
              element={
                <AuthGate>
                  <OnboardingProfile />
                </AuthGate>
              }
            />
            <Route
              path="/home"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Home />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/path/:pathId"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <PathDetail />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/lesson"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <LessonRunner />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/lesson/summary"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <LessonSummary />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            {/* /review — dedicated SRS-only refresh surface. Pulls
                previously-mastered + overdue terms across all paths in the
                user's active domain. Reuses the lesson-runner via
                lesson-store mode 'review'; the route itself only owns
                term selection + the empty state when nothing is due. */}
            <Route
              path="/review"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Review />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/profile"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Profile />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/term/:termId"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <TermDetail />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/whats-new"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <WhatsNew />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/settings"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Settings />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            {/* B+1.6 Batch 2: "spotted in the wild" — paste a transcript,
                see which terms you know. Wrapped by NeedsOnboarding so the
                user has at least a stub profile before the page tries to
                fetch personalized renderings. */}
            <Route
              path="/spotted"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Spotted />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            {/* B+1.6 Batch 3: mastered-terms gallery. Linked from profile;
                also surfaceable via the cmd+K palette (route entry below). */}
            <Route
              path="/mastered"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Mastered />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            {/* 2026-07-15: /questions — the lesson-question queue's reviewable
                inbox. On-ramps: the in-lesson "ask" button (lesson-runner),
                an answer-ready banner + "N lesson questions" chip on /home, and
                a cmd+K palette entry. */}
            <Route
              path="/questions"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Questions />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/delete-account"
              element={
                <AuthGate>
                  <DeleteAccount />
                </AuthGate>
              }
            />
            <Route
              path="/feedback"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <Feedback />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/program/:programId"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <GuidedProgram />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            {/* Stage B+1.4-B: gift-mode routes.
                /gift/send is wrapped by NeedsOnboarding so a brand-new sender who
                hasn't completed their own onboarding gets nudged through it first
                (otherwise the wizard would leak to people without a profile).
                /gift/accept is NOT wrapped by NeedsOnboarding — gift acceptance IS
                the recipient's onboarding equivalent (they confirm a pre-filled
                profile and land at /home directly afterward). */}
            <Route
              path="/gift/send"
              element={
                <AuthGate>
                  <NeedsOnboarding>
                    <GiftSend />
                  </NeedsOnboarding>
                </AuthGate>
              }
            />
            <Route
              path="/gift/accept"
              element={
                <AuthGate>
                  <GiftAccept />
                </AuthGate>
              }
            />
            {/* 2026-05-31: /atlas — standalone concept-atlas reference page.
                Public (no AuthGate); links back to / (sign in). */}
            <Route path="/atlas" element={<Atlas />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <ToastHost />
      <StreakFreezeWatcher />
      {/* B+1.6 Batch 3 — global Cmd+K palette. Lives outside <Routes>
          so the keyboard shortcut works on every page. Suppresses
          itself when the user isn't signed in. */}
      <CommandPaletteHost />
      <FeedbackLauncher />
      {/* 2026-05-31: floating version / changelog pill. */}
      <VersionPill />
    </>
  );
}
