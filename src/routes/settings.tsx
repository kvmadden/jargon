import { VersionPill } from '../components/version-pill';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { useToastStore } from '../components/toast';
import { supabase } from '../lib/supabase';
import {
  fetchUserProfile,
  upsertUserProfile,
  pickLivedIcons,
  generateLivedIconImage,
  generateLivedIconImageFromPrompt,
} from '../lib/data';
import { ProfileForm, type ProfileFormValue } from '../components/profile-form';
import { DiagnosticPanel } from '../components/diagnostic-panel';
import { LivedIconPanel } from '../components/lived-icon-panel';
import { DEFAULT_DOMAIN, asDomain } from '../lib/domains';
import type { IngestionCadence, UserProfileRow } from '../lib/database.types';
import { ErrorBoundary } from './error-boundary';
// refill logic is shared with App via ../lib/streak-freeze (single source of truth).
import { checkAndRefillStreakFreezes } from '../lib/streak-freeze';

const CADENCE_OPTIONS: Array<{ value: IngestionCadence; label: string; helper: string }> = [
  { value: 'daily', label: 'daily', helper: 'a small drip every morning' },
  { value: 'weekly', label: 'weekly', helper: 'sundays · the default' },
  { value: 'biweekly', label: 'biweekly', helper: 'every other sunday' },
  { value: 'monthly', label: 'monthly', helper: 'first of the month' },
];

const PULL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * /settings — ingestion cadence radio + manual pull + (disabled) notifications +
 * account block. Profile overflow → settings is the entry point.
 *
 * Stage B+1: "your translator" section above ingestion cadence:
 *   - "personalize my translator" toggle (single source of truth — off = always
 *     show canonical entries, even if a profile row exists. Helper text spells
 *     this out explicitly).
 *   - "edit profile" chevron row → flips the screen to an embedded ProfileForm
 *     (pre-filled). Save bumps profile_version via the DB trigger.
 *
 * The "show original" per-term toggle lives on /term/:id (ephemeral).
 */
export default function Settings() {
  return (
    <ErrorBoundary>
      <SettingsContent />
    </ErrorBoundary>
  );
}

function SettingsContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const ensureExists = useSettingsStore((s) => s.ensureExists);
  const signOut = useUserStore((s) => s.signOut);
  const pushToast = useToastStore((s) => s.push);

  const [pulling, setPulling] = useState(false);
  // Stage B+1 — translator block state.
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  // B+1.14 — lived-icon badge state. Motifs aren't persisted (they live
  // in the audit log); the panel surfaces only the most recent set
  // returned by the Edge Function. URL itself comes from
  // user_profile.lived_icon_url. `badgeBusy` covers both the regenerate
  // button and the from-prompt path.
  const [badgeMotifs, setBadgeMotifs] = useState<string[]>([]);
  const [badgeBusy, setBadgeBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const s = await ensureExists(user.id);
      if (s) {
        await checkAndRefillStreakFreezes(user.id, s, updateSettings);
      }
    })();
  }, [user, ensureExists, updateSettings]);

  // Load the profile row once on mount so the toggle reflects truth even if the
  // user has never opened the onboarding profile screen this session.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const p = await fetchUserProfile(user.id).catch(() => null);
      if (cancelled) return;
      setProfile(p);
      setProfileLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Toggle "personalize my translator". Three branches:
  //   - No profile row + tapping ON → open the embedded edit form so we can
  //     INSERT meaningful content rather than an empty placeholder row.
  //   - Profile row exists → flip personalization_enabled in place (UPDATE).
  //   - No profile row + tapping OFF → impossible (toggle reads as off
  //     when there's no row, so the next tap is ON).
  async function handlePersonalizationToggle(next: boolean) {
    if (!user) return;
    if (!profile && next) {
      // Open the form so the user can fill it — the row is created on save.
      setEditingProfile(true);
      return;
    }
    if (profile && profile.personalization_enabled !== next) {
      try {
        const updated = await upsertUserProfile(user.id, { personalization_enabled: next });
        setProfile(updated);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[settings] personalization toggle failed', err);
        pushToast('couldn’t save — try again', 'error');
      }
    }
  }

  // B+1.11 — regenerate lived icons via the Edge Function. Re-fires
  // pickLivedIcons against the CURRENT persisted profile (so unsaved form
  // edits aren't reflected — that's intentional; the regenerate button is
  // about "the profile you have on file"). Persists the result via
  // upsertUserProfile and re-fetches so the form's `initial` re-primes.
  // Returns the new slugs to the form so it can show an immediate preview.
  async function handleRegenerateLivedIcons(): Promise<string[]> {
    if (!user || !profile) return profile?.lived_icons ?? [];
    try {
      const slugs = await pickLivedIcons({
        job: profile.job,
        goals_freeform: profile.goals_freeform,
        encounter_contexts: profile.encounter_contexts,
        interests: profile.interests,
        heritage: profile.heritage,
        roles: profile.roles,
        background_text: profile.background_text,
        display_name: profile.display_name,
        relationship: profile.relationship,
        active_domain: profile.active_domain,
      });
      const updated = await upsertUserProfile(user.id, { lived_icons: slugs });
      setProfile(updated);
      pushToast(
        slugs.length > 0 ? 'icons regenerated' : 'no icons picked — try filling more profile',
        slugs.length > 0 ? 'success' : 'error',
      );
      return slugs;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[settings] regenerate lived icons failed', err);
      pushToast('couldn’t regenerate — try again', 'error');
      return profile.lived_icons ?? [];
    }
  }

  // B+1.14 — regenerate the AI badge using the CURRENT persisted profile.
  // Same input as last time; fresh take from Opus + Gemini. Edge Function
  // self-persists the URL to user_profile.lived_icon_url, so we re-fetch
  // the profile to pick up the new URL after the call. Toast on outcome.
  async function handleRegenerateBadge(): Promise<void> {
    if (!user || !profile || badgeBusy) return;
    setBadgeBusy(true);
    try {
      const result = await generateLivedIconImage({
        job: profile.job,
        goals_freeform: profile.goals_freeform,
        encounter_contexts: profile.encounter_contexts,
        interests: profile.interests,
        heritage: profile.heritage,
        roles: profile.roles,
        background_text: profile.background_text,
        display_name: profile.display_name,
        relationship: profile.relationship,
        active_domain: profile.active_domain,
      });
      if (result.url) {
        setBadgeMotifs(result.motifs);
        // Refetch profile so the URL surfaces. The Edge Function already
        // persisted, but our local copy is stale.
        const fresh = await fetchUserProfile(user.id).catch(() => null);
        if (fresh) setProfile(fresh);
        pushToast('badge regenerated', 'success');
      } else {
        pushToast(
          result.motifs.length > 0
            ? "couldn't draw — try again or change a profile field"
            : "couldn't draw — try again",
          'error',
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[settings] regenerate badge failed', err);
      pushToast("couldn't regenerate — try again", 'error');
    } finally {
      setBadgeBusy(false);
    }
  }

  // B+1.14 — same as handleRegenerateBadge but with a freeform user
  // request that biases the motif pick (e.g. "make it more about birds").
  async function handleRegenerateBadgeFromPrompt(request: string): Promise<void> {
    if (!user || !profile || badgeBusy) return;
    const cleaned = request.trim();
    if (cleaned.length === 0) return;
    setBadgeBusy(true);
    try {
      const result = await generateLivedIconImageFromPrompt(
        {
          job: profile.job,
          goals_freeform: profile.goals_freeform,
          encounter_contexts: profile.encounter_contexts,
          interests: profile.interests,
          heritage: profile.heritage,
          roles: profile.roles,
          background_text: profile.background_text,
          display_name: profile.display_name,
          relationship: profile.relationship,
          active_domain: profile.active_domain,
        },
        cleaned,
      );
      if (result.url) {
        setBadgeMotifs(result.motifs);
        const fresh = await fetchUserProfile(user.id).catch(() => null);
        if (fresh) setProfile(fresh);
        pushToast('badge redrawn', 'success');
      } else {
        pushToast("couldn't draw — try again", 'error');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[settings] regenerate badge from prompt failed', err);
      pushToast("couldn't redraw — try again", 'error');
    } finally {
      setBadgeBusy(false);
    }
  }

  async function handleProfileSave(value: ProfileFormValue) {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updated = await upsertUserProfile(user.id, {
        active_domain: value.active_domain,
        // B+1.10 — display_name (capitalization preserved verbatim).
        display_name: value.display_name,
        goals_freeform: value.goals_freeform,
        // B+1.11 — relationship (single-select chip + "other" freeform).
        relationship: value.relationship,
        education_level: value.education_level,
        job: value.job,
        interests: value.interests,
        heritage: value.heritage,
        roles: value.roles,
        background_text: value.background_text,
        // Saving from settings always means "I'm engaged with this feature" —
        // we re-enable personalization unless the user explicitly toggled it
        // off recently (then `value.personalization_enabled` carries the prior).
        personalization_enabled: value.personalization_enabled,
      });
      setProfile(updated);
      setEditingProfile(false);
      pushToast('translator updated', 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[settings] profile save failed', err);
      pushToast('couldn’t save — try again', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  const cadence = settings?.ingestion_cadence ?? 'weekly';
  const lastPullAt = settings?.last_manual_pull_at ?? null;
  const sinceLastPullMs = lastPullAt ? Date.now() - new Date(lastPullAt).getTime() : Infinity;
  const canPull = sinceLastPullMs >= PULL_COOLDOWN_MS && !pulling;
  const hoursLeft = canPull ? 0 : Math.ceil((PULL_COOLDOWN_MS - sinceLastPullMs) / (60 * 60 * 1000));

  async function handleCadenceChange(next: IngestionCadence) {
    if (!user || next === cadence) return;
    try {
      await updateSettings(user.id, { ingestion_cadence: next });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[settings] cadence update failed', err);
      pushToast('couldn’t save — try again', 'error');
    }
  }

  /**
   * Manual ingestion trigger. POSTs to the ingest-terms Edge Function with the
   * user's session JWT (the Edge Function checks for the service role internally,
   * but the dashboard "manual" trigger just records the auth source). Rate limit
   * gated client-side by `last_manual_pull_at`.
   *
   * Cooldown is gated strictly on successful response (`res.ok`), ensuring failed
   * requests do not lock the user out of retrying.
   */
  async function handlePullNow() {
    if (!user || !canPull) return;
    setPulling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
      const url = `${base}/functions/v1/ingest-terms`;
      const activeDomain = asDomain(profile?.active_domain ?? DEFAULT_DOMAIN);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${jwt ?? ''}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'manual', domain: activeDomain }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`ingest-terms ${res.status}: ${text}`);
      }
      await updateSettings(user.id, { last_manual_pull_at: new Date().toISOString() });
      pushToast('ingestion cycle started — check what’s new in a minute', 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[settings] pull now failed', err);
      pushToast('couldn’t kick off ingestion — see console', 'error');
    } finally {
      setPulling(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  // Sub-screen: edit profile form. Shares the chrome with /settings but swaps
  // the body for the embedded form. Back button cancels the edit (reverts).
  if (editingProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-12">
        <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3">
          {/* Edit-profile chrome anchored to body's max-w column. */}
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
              aria-label="back to settings"
            >
              ‹
            </button>
            <h1 className="text-base font-semibold text-text-primary lowercase">edit profile</h1>
          </div>
        </header>
        {/* W5 fix (code-reviewer): full ProfileForm has 6 sections — overflows
            390×844 viewport. Without overflow-y-auto, content clips. The wizard
            avoided this by being one-question-per-screen; Settings → edit
            profile doesn't have that luxury. */}
        <main className="flex-1 overflow-y-auto px-4 py-4 max-w-md mx-auto w-full">
          <p className="text-sm text-text-secondary mb-8 leading-relaxed">
            we’ll re-translate every term you open from here on out.
          </p>
          <ProfileForm
            initial={profile}
            onSave={handleProfileSave}
            busy={savingProfile}
            saveLabel={profile ? 'save changes' : 'save'}
            onRegenerateLivedIcons={profile ? handleRegenerateLivedIcons : undefined}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-12">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3">
        {/* Settings chrome anchored to body's max-w column. */}
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate('/profile');
            }}
            className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors"
            aria-label="back"
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-text-primary lowercase">settings</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-md mx-auto w-full flex flex-col gap-8">
        {/* Section: spotted in the wild (B+1.6 Batch 2).
            Lives at the top because it's the surface that most directly
            reflects Kevin's stated Goal A — follow Claude Code in real
            time. Lightweight tap from settings, opens the paste-mode
            route. */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            spotted in the wild
          </h2>
          <button
            type="button"
            onClick={() => navigate('/spotted')}
            className="w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 bg-surface-card border border-border-default active:bg-surface-card-hi transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary leading-snug">
                paste a transcript, see what you know
              </p>
              <p className="text-xs text-text-secondary mt-1 leading-snug">
                drop in a claude code session, slack thread, or anything
                with dev vocabulary. jargon highlights every term it knows.
              </p>
            </div>
            <span aria-hidden="true" className="text-accent-jargon-hi text-base shrink-0">›</span>
          </button>
        </section>

        {/* Section: share jargon (Stage B+1.4-B — gift-profile mode).
            Sits ABOVE "your translator" because gift-mode is the biggest
            product wedge — Kevin's pitch to the world is "set up a profile
            for someone you love", not "personalize your own translator". */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            share jargon
          </h2>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate('/gift/send')}
              className="w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 bg-surface-card border border-border-default active:bg-surface-card-hi transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary leading-snug">
                  set up a profile for someone you love
                </p>
                <p className="text-xs text-text-secondary mt-1 leading-snug">
                  translate the full domain through someone else's world.
                </p>
              </div>
              <span aria-hidden="true" className="text-accent-jargon-hi text-base shrink-0">›</span>
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/gift/send?program=agentic-era-operator')
              }
              className="w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 bg-accent-jargon/[0.08] border border-accent-jargon/40 active:bg-accent-jargon/[0.12] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi">
                  guided start
                </p>
                <p className="mt-1 text-sm font-medium text-text-primary leading-snug">
                  gift the Agentic Era operator course
                </p>
                <p className="text-xs text-text-secondary mt-1 leading-snug">
                  eight modules · 30 terms
                </p>
              </div>
              <span aria-hidden="true" className="text-accent-jargon-hi text-base shrink-0">›</span>
            </button>
          </div>
        </section>

        {/* Section: your translator (Stage B+1) */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            your translator
          </h2>
          <div className="flex flex-col gap-2">
            {/* Personalize toggle — ONE source of truth.
                State: derived from `user_profile.personalization_enabled`.
                No row OR row.personalization_enabled === false → off.
                Tapping ON when no row exists opens the embedded edit form. */}
            <button
              type="button"
              onClick={() => {
                const currentlyOn = profile?.personalization_enabled === true;
                void handlePersonalizationToggle(!currentlyOn);
              }}
              aria-pressed={profile?.personalization_enabled === true}
              disabled={!profileLoaded}
              className={`w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 transition-colors border ${
                profile?.personalization_enabled === true
                  ? 'bg-accent-jargon/[0.12] border-accent-jargon'
                  : 'bg-surface-card border-border-default'
              } disabled:opacity-60`}
            >
              <span
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
                  profile?.personalization_enabled === true
                    ? 'bg-accent-jargon border-accent-jargon'
                    : 'bg-bg-base border-border-default'
                }`}
                aria-hidden="true"
              >
                {profile?.personalization_enabled === true && (
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary leading-snug">
                  personalize my translator
                </p>
                <p className="text-xs text-text-secondary mt-1 leading-snug">
                  off = always show canonical entries
                </p>
              </div>
            </button>

            {/* Edit profile chevron row */}
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              disabled={!profileLoaded}
              className="w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 bg-surface-card border border-border-default active:bg-surface-card-hi transition-colors disabled:opacity-60"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary leading-snug">
                  edit profile
                </p>
                <p className="text-xs text-text-secondary mt-1 leading-snug truncate">
                  {profile
                    ? `v${profile.profile_version} · ${profile.interests.length} interests`
                    : 'fill out your translator'}
                </p>
              </div>
              <span aria-hidden="true" className="text-accent-jargon-hi text-base shrink-0">›</span>
            </button>
          </div>
        </section>

        {/* Section: your jargon badge (B+1.14).
            Sits between "your translator" and "ingestion cadence" because
            the badge is part of HOW the user is identified by jargon —
            adjacent to the translator, distinct from the system-level
            ingestion cadence settings. The panel handles both regenerate
            and from-prompt redraws (with optional voice). The hero badge
            renders at 96pt; the same image shows up at 32pt on /home and
            96pt on /gift/accept. */}
        {profile && (
          <section>
            <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
              your jargon badge
            </h2>
            <LivedIconPanel
              url={profile.lived_icon_url}
              motifs={badgeMotifs}
              fallbackSlugs={profile.lived_icons}
              onRegenerate={handleRegenerateBadge}
              onRegenerateFromPrompt={handleRegenerateBadgeFromPrompt}
              busy={badgeBusy}
            />
          </section>
        )}

        {/* Section: streak freezes */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            streak freezes
          </h2>
          <div className="bg-surface-card border border-border-default rounded-lg p-4 flex items-center justify-between min-h-[56px]">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary leading-snug">
                {settings?.streak_freezes_available ?? 2} freeze{(settings?.streak_freezes_available ?? 2) === 1 ? '' : 's'} available
              </p>
              <p className="text-xs text-text-muted mt-1 leading-snug">
                refills monthly (up to 2)
              </p>
            </div>
          </div>
        </section>

        {/* Section: ingestion cadence */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            ingestion cadence
          </h2>
          <div className="flex flex-col gap-2">
            {CADENCE_OPTIONS.map((opt) => {
              const selected = opt.value === cadence;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleCadenceChange(opt.value)}
                  aria-pressed={selected}
                  className={`w-full text-left rounded-lg p-4 min-h-[56px] flex items-center gap-3 transition-colors border ${
                    selected
                      ? 'bg-accent-jargon/[0.12] border-accent-jargon'
                      : 'bg-surface-card border-border-default'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full shrink-0 border-2 ${
                      selected
                        ? 'border-accent-jargon bg-accent-jargon'
                        : 'border-border-default bg-bg-base'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{opt.label}</p>
                    <p className="text-xs text-text-secondary mt-1">{opt.helper}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handlePullNow}
            disabled={!canPull}
            className="w-full mt-4 bg-accent-jargon text-text-primary font-semibold rounded-lg py-3 min-h-[56px] active:bg-accent-jargon-lo transition-colors disabled:bg-surface-card disabled:text-text-muted"
          >
            {pulling
              ? 'starting…'
              : canPull
              ? 'pull now'
              : `wait ${hoursLeft}h to pull again`}
          </button>
          <p className="text-xs text-text-muted mt-2 px-1">
            kicks off an ingestion cycle right now. limited to one per 24 hours.
          </p>
        </section>

        {/* Section: diagnostic — post-deploy reachability + version surface */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            diagnostic
          </h2>
          <DiagnosticPanel
            activeDomain={asDomain(profile?.active_domain ?? DEFAULT_DOMAIN)}
            homeDomain={asDomain(profile?.home_domain ?? DEFAULT_DOMAIN)}
          />
          <p className="text-xs text-text-muted px-1 mt-3 leading-relaxed">
            shows what the client thinks is deployed. ping the edge function
            if a personalization renders stale or you suspect the auth gate
            is mis-wired.
          </p>
        </section>

        {/* Section: notifications (disabled until iOS app) */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            notifications
          </h2>
          <div className="bg-surface-card border border-border-default rounded-lg p-4 flex items-center justify-between min-h-[56px] opacity-60">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-muted">push notifications</p>
              <p className="text-xs text-text-muted mt-1">coming with the iOS app.</p>
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-text-muted shrink-0 ml-3">
              soon
            </span>
          </div>
        </section>

        {/* Section: closed-loop pilot feedback */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            feedback
          </h2>
          <button
            type="button"
            onClick={() => navigate('/feedback')}
            aria-label="open field-note replies and check-ins"
            className="w-full min-h-[56px] rounded-lg border border-border-default bg-surface-card p-4 text-left transition-colors active:bg-bg-base"
          >
            <span className="block text-sm font-medium text-text-primary">my feedback loop</span>
            <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
              see replies, changes your notes drove, and Jargon check-ins waiting for you.
            </span>
          </button>
        </section>

        {/* Section: account */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted px-1 mb-3">
            account
          </h2>
          <div className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-2 min-h-[56px]">
            <p className="text-xs uppercase tracking-wider text-text-muted">signed in as</p>
            <p className="text-sm font-mono text-text-primary truncate">
              {user?.email ?? '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full mt-3 bg-surface-card border border-border-default text-text-primary font-medium rounded-lg py-3 min-h-[44px] active:bg-bg-base transition-colors"
          >
            sign out
          </button>
          <button
            type="button"
            onClick={() => navigate('/delete-account')}
            className="w-full mt-3 bg-surface-card border border-border-default text-text-secondary font-medium rounded-lg py-3 min-h-[44px] active:bg-bg-base transition-colors text-xs cursor-pointer"
          >
            delete account & data
          </button>
        </section>
        {/* The build version lives here, not floating over every page (Kevin, 2026-11-03). */}
        <section aria-label="about this build" className="mt-6">
          <VersionPill inline />
        </section>
      </main>
    </div>
  );
}
