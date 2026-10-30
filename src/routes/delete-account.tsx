import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { useToastStore } from '../components/toast';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './error-boundary';

const CONFIRMATION_PHRASE = 'delete my account';

export default function DeleteAccount() {
  return (
    <ErrorBoundary>
      <DeleteAccountContent />
    </ErrorBoundary>
  );
}

function DeleteAccountContent() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const pushToast = useToastStore((s) => s.push);

  const [confirmText, setConfirmText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isConfirmed = confirmText.trim().toLowerCase() === CONFIRMATION_PHRASE;

  async function handleExportData() {
    if (!user || exporting || deleting) return;
    setExporting(true);

    try {
      const [
        { data: profile },
        { data: settings },
        { data: streakLog },
        { data: userProgress },
        { data: lessonQuestions },
        { data: reports },
      ] = await Promise.all([
        supabase.from('user_profile').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('streak_log').select('*').eq('user_id', user.id),
        supabase.from('user_progress').select('*').eq('user_id', user.id),
        supabase.from('lesson_question_log').select('*').eq('user_id', user.id),
        supabase.from('reports').select('*').eq('user_id', user.id),
      ]);

      const exportPayload = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email ?? null,
        user_profile: profile ?? null,
        settings: settings ?? null,
        streak_log: streakLog ?? [],
        user_progress: userProgress ?? [],
        lesson_question_log: lessonQuestions ?? [],
        reports: reports ?? [],
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jargon-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      pushToast('data export downloaded', 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[delete-account] export error:', err);
      pushToast('couldn’t export data — try again', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user || !isConfirmed || deleting) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) throw new Error('no active session token found');

      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${jwt}`,
          'content-type': 'application/json',
        },
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result?.ok) {
        const errorMsg = result?.error || `deletion failed with status ${res.status}`;
        throw new Error(errorMsg);
      }

      await signOut();
      pushToast('your account has been deleted', 'success');
      navigate('/');
    } catch (err) {
      const message = (err as Error).message || 'an unexpected error occurred';
      // eslint-disable-next-line no-console
      console.error('[delete-account] deletion error:', err);
      setDeleteError(message);
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom pb-12">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-text-secondary text-lg active:bg-surface-card transition-colors cursor-pointer"
            aria-label="back to settings"
            disabled={deleting}
          >
            ‹
          </button>
          <h1 className="text-base font-semibold text-text-primary lowercase">
            delete account & data
          </h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-md mx-auto w-full flex flex-col gap-6">
        {deleteError && (
          <div
            role="alert"
            className="bg-surface-card border border-accent-triage/50 rounded-lg p-4 text-sm text-text-primary"
          >
            <p className="font-semibold text-accent-triage mb-1">deletion failed</p>
            <p className="text-xs text-text-secondary">{deleteError}</p>
          </div>
        )}

        {/* Section 1: Data export */}
        <section className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary lowercase">
              download a summary of your data
            </h2>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              get a copy of your progress, streak history, settings, profile, and saved questions in json format before deleting.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportData}
            disabled={exporting || deleting}
            className="w-full bg-surface-card border border-border-default text-text-primary font-medium rounded-lg py-3 min-h-[44px] active:bg-bg-base transition-colors text-sm disabled:opacity-50 cursor-pointer"
          >
            {exporting ? 'exporting…' : 'download my data'}
          </button>
        </section>

        {/* Section 2: Permanent deletion info */}
        <section className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary lowercase">
              permanent deletion
            </h2>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              deleting your account is permanent and cannot be undone. all of the following will be erased:
            </p>
          </div>
          <ul className="text-xs text-text-muted flex flex-col gap-1.5 list-disc pl-4">
            <li>spaced-repetition term progress & mastery scores</li>
            <li>streak logs, xp history & freeze state</li>
            <li>personalized translator profile & custom definitions</li>
            <li>saved lesson questions & feedback reports</li>
            <li>account sign-in access & invite allowlist entry</li>
          </ul>
        </section>

        {/* Section 3: Confirmation form */}
        <section className="bg-surface-card border border-border-default rounded-lg p-4 flex flex-col gap-4">
          <div>
            <label htmlFor="confirm-input" className="block text-xs font-medium text-text-primary mb-1">
              type <span className="font-mono text-accent-jargon-hi">delete my account</span> to confirm:
            </label>
            <input
              id="confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete my account"
              disabled={deleting}
              className="w-full bg-bg-base border border-border-default rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-jargon min-h-[44px]"
              autoComplete="off"
            />
          </div>

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={!isConfirmed || deleting}
            className="w-full bg-surface-card border border-accent-triage/60 text-accent-triage font-semibold rounded-lg py-3 min-h-[44px] active:bg-bg-base transition-colors text-sm disabled:opacity-40 disabled:border-border-default disabled:text-text-muted cursor-pointer"
          >
            {deleting ? 'deleting account…' : 'permanently delete my account'}
          </button>
        </section>
      </main>
    </div>
  );
}
