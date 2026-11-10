import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/user-store';
import { checkAllowlist } from '../lib/data';
import { signInWithGoogle } from '../lib/google-auth';
import { Wordmark } from '../components/wordmark';
import { Landing } from '../components/landing';
import { ErrorBoundary } from './error-boundary';


const SEEN_LANDING_KEY = 'jargon-seen-landing';
const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';

type Mode = 'landing' | 'idle' | 'sending' | 'sent' | 'error' | 'denied' | 'checking' | 'check_timed_out' | 'check_failed';

export default function Splash() {
  return (
    <ErrorBoundary>
      <SplashContent />
    </ErrorBoundary>
  );
}

function SplashContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const loading = useUserStore((s) => s.loading);
  const [email, setEmail] = useState('');
  const [signingInWithGoogle, setSigningInWithGoogle] = useState(false);
  // Default landing for first-time visitors; returning visitors (who've
  // already tapped through the landing once) skip straight to the email
  // form via the seen-landing flag in localStorage. Authenticated users
  // bypass both — the user-effect below routes them through the
  // allowlist check instead of ever showing landing or the form.
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === 'undefined') return 'idle';
    return window.localStorage.getItem(SEEN_LANDING_KEY) ? 'idle' : 'landing';
  });
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Stage B+1.4-B: dynamic allowlist via check-allowlist Edge Function. We
  // only run the check once per user-session-mount — duplicate hits would
  // stack network requests under StrictMode / HMR re-renders.
  const checkedRef = useRef<string | null>(null);
  // Bumping this re-runs the allowlist-check effect below. A ref reset alone
  // won't re-run it (the effect's deps don't otherwise change), so the timeout
  // "try again" needs a state bump to actually re-issue the check + re-arm the
  // timeout.
  const [retryToken, setRetryToken] = useState(0);

  // Cooldown countdown effect for magic link resend.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Surface an OAuth error redirected back from Supabase (e.g. the Google
  // provider isn't configured yet). Supabase reports this on the redirect via
  // `error`/`error_description` on EITHER the hash or the query string
  // depending on flow — the client-side `signInWithOAuth` call itself resolves
  // with no error before the redirect happens, so this is the only place that
  // sees it. Runs once on mount, independent of `user` (a failed OAuth attempt
  // never creates a session). Clears the params from the URL after reading so
  // a refresh doesn't re-show a stale error.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const oauthError = hashParams.get('error_description') || hashParams.get('error')
      || searchParams.get('error_description') || searchParams.get('error');
    if (!oauthError) return;
    setError(decodeURIComponent(oauthError.replace(/\+/g, ' ')));
    setMode('error');
    const clean = new URL(window.location.href);
    clean.hash = '';
    clean.searchParams.delete('error');
    clean.searchParams.delete('error_description');
    clean.searchParams.delete('error_code');
    window.history.replaceState({}, '', clean.toString());
  }, []);

  // If already signed in, route via the dynamic allowlist check instead of the
  // legacy hardcoded ALLOWED_EMAIL comparison. Recipients who land here from a
  // gift magic link with `?inviteId=xxx` go to /gift/accept regardless — that
  // route owns its own allowlist (the accept-gift-invite Edge Function adds
  // them to allowed_users on tap).
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    // If the session URL hash carries an inviteId search param, bounce to
    // /gift/accept and let it handle the allowlist + profile flow. We check
    // both query-string and hash because the Supabase magic-link redirect
    // shape varies by environment.
    const url = new URL(window.location.href);
    const inviteId = url.searchParams.get('inviteId');
    if (inviteId) {
      navigate(`/gift/accept?inviteId=${encodeURIComponent(inviteId)}`, { replace: true });
      return;
    }
    if (checkedRef.current === user.id) return;
    checkedRef.current = user.id;
    setMode('checking');

    // Ignore completion of a superseded check (retry, user switch, unmount).
    // A stale denial must never sign out a newer authenticated session.
    let active = true;
    const timeoutTimer = setTimeout(() => {
      if (active) setMode('check_timed_out');
    }, 8000);

    (async () => {
      try {
        const result = await checkAllowlist();
        clearTimeout(timeoutTimer);
        if (!active) return;
        if (result.allowed) {
          navigate('/home', { replace: true });
        } else {
          // Showing the "invite-only" card is NOT enough on its own. Without
          // this sign-out the denied account keeps a live, auto-refreshing
          // Supabase session — a renewing JWT that outlives the screen it was
          // refused on. The DB-side allowlist predicate on the user tables is
          // the real boundary; revoking the credential here is what stops a
          // refused account from holding one at all.
          await supabase.auth.signOut();
          if (!active) return;
          checkedRef.current = null;
          setMode('denied');
        }
      } catch (err) {
        clearTimeout(timeoutTimer);
        if (!active) return;
        // eslint-disable-next-line no-console
        console.error('[splash] allowlist check failed', err);
        // Deliberately NO sign-out here: this branch is an INCONCLUSIVE check
        // (network hiccup, cold function), not a refusal. Evicting a legitimate
        // user on a transient error would cost them a fresh magic link, and the
        // RLS predicate already denies data to anyone off the allowlist.
        setMode('check_failed');
      }
    })();

    return () => {
      active = false;
      clearTimeout(timeoutTimer);
    };
  }, [user, loading, navigate, retryToken]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setMode('sending');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/' },
    });
    if (err) {
      setError(err.message);
      setMode('error');
    } else {
      setMode('sent');
      setResendCooldown(60);
    }
  }

  async function resendLink() {
    if (!email || resendCooldown > 0 || mode === 'sending' || signingInWithGoogle) return;
    setMode('sending');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/' },
    });
    if (err) {
      setError(err.message);
      setMode('error');
    } else {
      setMode('sent');
      setResendCooldown(60);
    }
  }

  /**
   * Google OAuth sign-in handler.
   *
   * REMAINING MANUAL STEP FOR KEVIN:
   * 1. Create a GCP OAuth 2.0 Client ID (in Google Cloud Console -> APIs & Services -> Credentials).
   *    Note: Reusing an existing GCP project or creating a new one is up to you.
   * 2. Configure authorized redirect URI in GCP Console:
   *    https://<your-supabase-project-id>.supabase.co/auth/v1/callback
   * 3. In Supabase Dashboard -> Authentication -> Providers -> Google:
   *    Enable Google provider, paste Client ID + Client Secret, and save.
   */
  async function handleGoogleSignIn() {
    if (mode === 'sending' || signingInWithGoogle) return;
    setSigningInWithGoogle(true);
    setError(null);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) {
        setError(err.message || "google sign-in isn't quite wired up yet");
        setMode('error');
      }
    } catch (catchedErr: any) {
      setError(catchedErr?.message || "google sign-in isn't quite wired up yet");
      setMode('error');
    } finally {
      setSigningInWithGoogle(false);
    }
  }

  // Landing is its own full-screen surface — render it before the
  // splash chrome so the layout doesn't fight the centered hero.
  if (mode === 'landing' && !user) {
    return (
      <Landing
        onContinue={() => {
          try {
            window.localStorage.setItem(SEEN_LANDING_KEY, '1');
          } catch {
            // safari private mode etc. — no-op, user just sees landing again next visit
          }
          setMode('idle');
        }}
      />
    );
  }

  return (
    // BLOCKER FIX (B+1.10 visual-qa): previous layout used flex justify-center
    // so the form sat centered in a 932pt void (40% dead black above + below).
    // Switched to flex with header padding so the hero rides higher, matching
    // the landing page's vertical rhythm. CTA + input still reach the visual
    // upper-middle on iPhone 16 Pro Max instead of the dead-center.
    <div className="min-h-screen flex flex-col items-center px-6 bg-bg-base safe-top safe-bottom pt-16">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Brand v0.1: large signature mark + locked tagline. The wordmark renders
            as `// jargon` in IBM Plex Mono Medium at 64px (brand-sheet hero spec). */}
        <Wordmark size={64} className="mb-6 text-accent-jargon" />
        <h1 className="text-2xl font-light italic text-text-primary text-center tracking-tight leading-tight">
          Speak the room.
        </h1>

        <div className="w-full mt-12">
          {mode === 'denied' ? (
            <div className="bg-surface-card border border-border-default rounded-lg p-4 text-center">
              <h2 className="text-base font-semibold text-text-primary">invite-only</h2>
              <p className="text-sm text-text-secondary mt-2">
                jargon is invite-only for now. ask kevin if you want in — or check
                your inbox for a gift invite from someone in your life.
              </p>
              <button
                type="button"
                onClick={async () => {
                  // Sign out so the next tap reaches the email form, not a
                  // half-stuck "checking" loop.
                  await supabase.auth.signOut();
                  checkedRef.current = null;
                  setMode('idle');
                  setEmail('');
                }}
                // Expanded hit area for thumb reliability — visual stays compact.
                className="text-xs text-accent-jargon-hi mt-3 underline underline-offset-2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2"
              >
                go back
              </button>
            </div>
          ) : mode === 'sent' ? (
            <div className="bg-surface-card border border-border-default rounded-lg p-4 text-center">
              <h2 className="text-base font-semibold text-text-primary">check your email</h2>
              <p className="text-sm text-text-secondary mt-2">
                we sent a magic link to <span className="font-mono">{email}</span>.
              </p>
              {import.meta.env.DEV && (
                <p className="text-xs text-text-muted mt-2">
                  local dev: open mailpit at{' '}
                  {/* py-[15px] lifts the ~15px-tall inline link to a 45px hit
                      area — vertical padding on an inline element expands the
                      tappable box without moving any line boxes (no visual
                      change). 44px floor, visual-qa touch-target invariant. */}
                  <a className="text-accent-jargon-hi underline py-[15px]" href="http://127.0.0.1:54324" target="_blank" rel="noreferrer">
                    127.0.0.1:54324
                  </a>
                </p>
              )}
              <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={resendLink}
                  disabled={resendCooldown > 0}
                  className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-2.5 min-h-[44px] active:bg-accent-jargon-lo transition-colors text-sm disabled:opacity-40"
                >
                  {resendCooldown > 0
                    ? `resend link (${resendCooldown}s)`
                    : 'resend magic link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('idle');
                  }}
                  className="text-xs text-text-muted underline underline-offset-2 inline-flex items-center justify-center min-h-[44px] px-2 active:text-text-secondary transition-colors"
                >
                  use a different email
                </button>
              </div>
            </div>
          ) : (mode === 'check_timed_out' || mode === 'check_failed') ? (
            <div className="bg-surface-card border border-border-default rounded-lg p-4 text-center">
              <h2 className="text-base font-semibold text-text-primary">
                {mode === 'check_failed' ? "couldn't check your invite" : 'taking longer than expected'}
              </h2>
              <p role="alert" className="text-sm text-text-secondary mt-2">
                {mode === 'check_failed'
                  ? "we couldn't verify your invite right now. check your connection and try again."
                  : 'checking your invite timed out. check your connection or try again.'}
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    checkedRef.current = null;
                    setRetryToken((t) => t + 1);
                  }}
                  className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-2.5 min-h-[44px] active:bg-accent-jargon-lo transition-colors text-sm"
                >
                  try again
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    checkedRef.current = null;
                    setMode('idle');
                    setEmail('');
                  }}
                  className="text-xs text-text-muted underline underline-offset-2 inline-flex items-center justify-center min-h-[44px] px-2 active:text-text-secondary transition-colors"
                >
                  sign out
                </button>
              </div>
            </div>
          ) : mode === 'checking' ? (
            <div className="bg-surface-card border border-border-default rounded-lg p-4 text-center">
              {/* POLISH FIX (B+1.10 designer P10): added inline spinner so
                  the user sees motion + brand-color confirmation that work
                  is happening. Static text alone reads as frozen. */}
              <p
                className="text-sm text-text-secondary inline-flex items-center justify-center gap-2"
                role="status"
                aria-live="polite"
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-3 h-3 rounded-full border-2 border-text-muted border-t-accent-jargon animate-spin"
                />
                <span>checking your invite…</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <form onSubmit={sendLink} className="flex flex-col gap-3">
                <input
                  type="email"
                  aria-label="your email"
                  autoFocus
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your email"
                  // BLOCKER FIX (B+1.10 designer B2): bumped py-3/min-h-44 →
                  // py-4/min-h-56 so the input + CTA share the 56pt primary
                  // bar used everywhere else in the app (landing, gift,
                  // onboarding). Prior 44pt sizing read as a downgrade after
                  // tapping "let's go" on the 56pt landing CTA.
                  className="w-full bg-surface-card border border-border-default rounded-lg px-4 py-4 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[56px]"
                  required
                />
                {/* CTA renders white-on-signature per brand sheet §05 (.practice-button).
                    Large/bold text qualifies for WCAG AA's 3:1 large-text bar. */}
                <button
                  type="submit"
                  disabled={mode === 'sending' || signingInWithGoogle}
                  className="w-full bg-accent-jargon text-text-primary font-semibold rounded-lg py-4 min-h-[56px] active:bg-accent-jargon-lo transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {mode === 'sending' && !signingInWithGoogle ? 'sending…' : 'send magic link'}
                </button>
              </form>

              {GOOGLE_AUTH_ENABLED && (
                <>
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-border-default" />
                    <span className="text-xs text-text-muted">or</span>
                    <div className="flex-1 h-px bg-border-default" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={mode === 'sending' || signingInWithGoogle}
                    className="w-full bg-surface-card border border-border-default hover:border-text-muted text-text-primary font-medium rounded-lg py-4 min-h-[56px] flex items-center justify-center gap-3 transition-colors disabled:opacity-40 cursor-pointer text-sm"
                  >
                    <span>{signingInWithGoogle ? 'connecting to google…' : 'continue with google'}</span>
                  </button>
                </>
              )}

              {/* WARNING FIX (B+1.10 reviewer W3): role=alert announces error
                  to screen readers; the visible "error:" prefix carries the
                  signal for users who can't perceive accent-triage red. */}
              {error && (
                <p role="alert" className="text-xs text-accent-triage text-center mt-1">
                  <span className="font-semibold">error:</span> {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 safe-bottom p-4 text-center">
        <p className="text-xs text-text-muted">
          a <span className="lowercase">side reaction</span> by kevin madden
        </p>
      </div>
    </div>
  );
}
