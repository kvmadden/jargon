import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../../components/bottom-sheet';
import { floatingButtonDesktopClass } from '../../lib/desktop-chrome';
import { useToastStore } from '../../components/toast';
import { useUserStore } from '../../stores/user-store';
import { captureFeedbackScreenshot } from './capture';
import {
  flushFeedbackQueue,
  listProductFeedback,
  submitProductFeedback,
  subscribeToProductFeedback,
} from './data';
import { CameraIcon, FeedbackBubbleIcon, MicrophoneIcon } from './icons';
import { createFeedbackSpeech } from './speech';
import { feedbackButtonLabel, useFeedbackUnread } from './unread-store';
import {
  clearFeedbackDraft,
  enqueueFeedback,
  loadFeedbackDraft,
  saveFeedbackDraft,
  useFeedbackRateSlot,
} from './storage';
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackDraft,
} from './types';

function freshDraft(pathname: string): FeedbackDraft {
  return {
    category: 'confusing',
    message: '',
    includeScreenshot: false,
    includeContext: true,
    screenshotData: null,
    screen: pathname,
    context: {
      pathname,
      url: typeof window === 'undefined' ? undefined : window.location.href,
      viewport:
        typeof window === 'undefined' ? undefined : `${window.innerWidth}x${window.innerHeight}`,
      userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
    },
  };
}

export function FeedbackLauncher() {
  const user = useUserStore((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.push);
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const unread = useFeedbackUnread((state) => state.unread);
  const setUnread = useFeedbackUnread((state) => state.setUnread);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<FeedbackDraft>(() => freshDraft(location.pathname));

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await listProductFeedback();
      setUnread(
        rows.filter(
          (row) =>
            (row.kind === 'submission' &&
              row.author_user_id === user.id &&
              row.owner_reply &&
              !row.acknowledged_at) ||
            (row.kind === 'question' &&
              row.asked_user_id === user.id &&
              !row.answer),
        ).length,
      );
    } catch {
      // The launcher remains usable if the badge query is temporarily offline.
    }
  }, [setUnread, user]);

  useEffect(() => {
    if (!user) return;
    const saved = loadFeedbackDraft(user.id);
    setDraft(saved ?? freshDraft(location.pathname));
    void refreshUnread();
    void flushFeedbackQueue(user.id).then((sent) => {
      if (sent > 0) pushToast(`${sent} queued note${sent === 1 ? '' : 's'} sent`, 'success');
    });
  }, [user, location.pathname, pushToast, refreshUnread]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => saveFeedbackDraft(user.id, draft), 250);
    return () => window.clearTimeout(timer);
  }, [draft, user]);

  useEffect(() => {
    if (!user) return;
    const sendQueued = () => {
      void flushFeedbackQueue(user.id).then((sent) => {
        if (sent > 0) pushToast(`${sent} queued note${sent === 1 ? '' : 's'} sent`, 'success');
      });
    };
    window.addEventListener('online', sendQueued);
    const channel = subscribeToProductFeedback(refreshUnread);
    return () => {
      window.removeEventListener('online', sendQueued);
      void channel.unsubscribe();
    };
  }, [pushToast, refreshUnread, user]);

  const speech = useMemo(
    () =>
      createFeedbackSpeech(
        (transcript) =>
          setDraft((current) => ({
            ...current,
            message: `${current.message}${current.message.trim() ? ' ' : ''}${transcript}`.slice(0, 4000),
          })),
        setListening,
      ),
    [],
  );

  useEffect(() => () => speech.stop(), [speech]);

  // The desktop app bar's feedback button. The ref is filled in below, after
  // the signed-out early return, so every hook here runs on every render.
  const beginFeedbackRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const onOpen = () => void beginFeedbackRef.current();
    window.addEventListener('jargon:open-feedback', onOpen);
    return () => window.removeEventListener('jargon:open-feedback', onOpen);
  }, []);

  if (!user) return null;
  const userId = user.id;

  async function beginFeedback() {
    setCapturing(true);
    setError('');
    let screenshotData: string | null = null;
    try {
      screenshotData = await captureFeedbackScreenshot();
    } catch {
      screenshotData = null;
    }
    setDraft((current) => ({
      ...current,
      screenshotData,
      screen: location.pathname,
      context: {
        pathname: location.pathname,
        url: window.location.href,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
      },
    }));
    setCapturing(false);
    setOpen(true);
  }
  beginFeedbackRef.current = beginFeedback;

  function close() {
    speech.stop();
    setOpen(false);
    setError('');
  }

  async function submit() {
    const message = draft.message.trim();
    if (!message) {
      setError('write or dictate a note first.');
      return;
    }
    const slot = useFeedbackRateSlot(userId);
    if (!slot.allowed) {
      setError(`slow down for ${slot.secondsLeft}s, then try again.`);
      return;
    }

    setSubmitting(true);
    setError('');
    const ready = { ...draft, message };
    try {
      if (!navigator.onLine) throw new Error('offline');
      await submitProductFeedback(userId, ready);
      clearFeedbackDraft(userId);
      setDraft(freshDraft(location.pathname));
      setOpen(false);
      pushToast('feedback sent — thank you', 'success');
      await refreshUnread();
    } catch {
      try {
        enqueueFeedback(userId, ready);
        clearFeedbackDraft(userId);
        setDraft(freshDraft(location.pathname));
        setOpen(false);
        pushToast('saved offline — it’ll send when you reconnect', 'warn');
      } catch {
        setError('couldn’t send or save this note. copy it before closing.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-feedback-ui="true"
        onClick={() => void beginFeedback()}
        disabled={capturing}
        className={`fixed bottom-16 right-4 z-40 flex ${floatingButtonDesktopClass(location.pathname)} h-12 w-12 min-h-[48px] min-w-[48px] -translate-y-16 items-center justify-center gap-2 rounded-full border border-accent-jargon/50 bg-surface-card-hi text-sm font-semibold text-text-primary shadow-xl shadow-black/30 transition-colors hover:border-accent-jargon hover:bg-surface-card focus:outline-none focus:ring-2 focus:ring-accent-jargon disabled:opacity-60 sm:w-auto sm:px-4`}
        aria-label={feedbackButtonLabel(unread, 'send field note')}
      >
        <FeedbackBubbleIcon />
        <span className="hidden sm:inline">{capturing ? 'capturing…' : 'feedback'}</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-jargon px-2 font-mono text-xs text-text-primary">
            {unread}
          </span>
        )}
      </button>

      <BottomSheet open={open} onClose={close} ariaLabel="send feedback">
        <div data-feedback-ui="true" className="max-h-[78vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
                field note
              </p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">what happened?</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                rough is useful. don’t include health, work, or other sensitive details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                close();
                navigate('/feedback');
              }}
              className="min-h-[44px] shrink-0 rounded-md border border-border-default px-3 text-xs font-semibold text-text-primary"
            >
              my loop
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs uppercase tracking-wider text-text-muted">kind</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FEEDBACK_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  aria-pressed={draft.category === category.value}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      category: category.value as FeedbackCategory,
                    }))
                  }
                  className={`min-h-[44px] rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                    draft.category === category.value
                      ? 'border-accent-jargon bg-accent-jargon/20 text-text-primary'
                      : 'border-border-default bg-surface-card text-text-secondary'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="text-xs uppercase tracking-wider text-text-muted">your note</span>
            <textarea
              value={draft.message}
              onChange={(event) =>
                setDraft((current) => ({ ...current, message: event.target.value }))
              }
              maxLength={4000}
              rows={6}
              placeholder="what felt wrong, slow, confusing, or unexpectedly good?"
              className="mt-2 w-full resize-none rounded-lg border border-border-default bg-bg-base p-3 text-base leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent-jargon focus:outline-none focus:ring-2 focus:ring-accent-jargon/30"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={speech.toggle}
              disabled={!speech.supported}
              aria-pressed={listening}
              className={`flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-xs font-semibold ${
                listening
                  ? 'border-accent-jargon bg-accent-jargon/20 text-text-primary'
                  : 'border-border-default text-text-secondary'
              } disabled:opacity-40`}
            >
              <MicrophoneIcon />
              {speech.supported ? (listening ? 'stop dictating' : 'dictate') : 'dictation unavailable'}
            </button>
            <span className="font-mono text-xs text-text-muted">{draft.message.length}/4000</span>
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex min-h-[48px] items-center justify-between gap-3 rounded-md border border-border-default bg-surface-card px-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
                <CameraIcon className="h-5 w-5 shrink-0" />
                attach this screen
                {!draft.screenshotData && <span className="text-xs text-text-muted">unavailable</span>}
              </span>
              <input
                type="checkbox"
                checked={draft.includeScreenshot && !!draft.screenshotData}
                disabled={!draft.screenshotData}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    includeScreenshot: event.target.checked,
                  }))
                }
                className="h-5 w-5 accent-accent-jargon"
              />
            </label>
            <label className="flex min-h-[48px] items-center justify-between gap-3 rounded-md border border-border-default bg-surface-card px-3">
              <span className="text-sm text-text-primary">
                include page and browser context
              </span>
              <input
                type="checkbox"
                checked={draft.includeContext}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, includeContext: event.target.checked }))
                }
                className="h-5 w-5 accent-accent-jargon"
              />
            </label>
          </div>

          {draft.includeScreenshot && draft.screenshotData && (
            <img
              src={draft.screenshotData}
              alt="screen attached to this feedback"
              className="mt-3 max-h-40 w-full rounded-md border border-border-default object-cover object-top"
            />
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-accent-triage">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={close}
              className="min-h-[48px] flex-1 rounded-lg border border-border-default bg-surface-card text-sm font-semibold text-text-secondary"
            >
              keep draft
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="min-h-[48px] flex-[1.4] rounded-lg bg-accent-jargon px-4 text-sm font-semibold text-text-primary active:bg-accent-jargon-lo disabled:opacity-50"
            >
              {submitting ? 'sending…' : 'send note'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
