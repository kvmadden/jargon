import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../components/toast';
import {
  acknowledgeProductFeedback,
  answerProductFeedback,
  askJargonPilot,
  isJargonOwner,
  listJargonPilots,
  listProductFeedback,
  replyToProductFeedback,
  subscribeToProductFeedback,
} from '../features/feedback/data';
import { ChevronLeftIcon, FeedbackBubbleIcon } from '../features/feedback/icons';
import type { FeedbackRow, PilotUser } from '../features/feedback/types';
import { useUserStore } from '../stores/user-store';
import { ErrorBoundary } from './error-boundary';

type View = 'mine' | 'check-in' | 'inbox' | 'replied' | 'sent' | 'ask';

const ASK_TEMPLATES = [
  {
    label: 'first five minutes',
    message: 'What felt confusing or unexpectedly clear in your first five minutes with Jargon?',
  },
  {
    label: 'first lesson',
    message: 'Think about your first Jargon lesson. Where did the pace, wording, or controls get in your way?',
  },
  {
    label: 'real-world transfer',
    message: 'Has Jargon helped you follow a real technical conversation yet? What did you recognize?',
  },
  {
    label: 'agentic era',
    message: 'In Jargon’s agentic era path, which idea changed how you think about AI, and which term still feels slippery?',
  },
  {
    label: 'agent teach-back',
    message: 'In your own words, how would you explain the difference between an AI assistant, an agentic workflow, and an agent?',
  },
  {
    label: 'missing piece',
    message: 'What is the one thing you expected Jargon to do that it does not do yet?',
  },
] as const;

function relativeTime(value: string | null) {
  if (!value) return 'just now';
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
export default function FeedbackRoute() {
  return (
    <ErrorBoundary>
      <FeedbackCenter />
    </ErrorBoundary>
  );
}

function FeedbackCenter() {
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.push);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [pilots, setPilots] = useState<PilotUser[]>([]);
  const [owner, setOwner] = useState(false);
  const [view, setView] = useState<View>('mine');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [nextRows, ownerStatus] = await Promise.all([
        listProductFeedback(),
        isJargonOwner().catch(() => false),
      ]);
      setRows(nextRows);
      setOwner(ownerStatus);
      if (ownerStatus) {
        setPilots(await listJargonPilots());
      }
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'couldn’t load feedback.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const channel = subscribeToProductFeedback(refresh);
    return () => {
      void channel.unsubscribe();
    };
  }, [refresh]);

  const mySubmissions = useMemo(
    () =>
      rows.filter(
        (row) => row.kind === 'submission' && row.author_user_id === user?.id,
      ),
    [rows, user],
  );
  const myQuestions = useMemo(
    () => rows.filter((row) => row.kind === 'question' && row.asked_user_id === user?.id),
    [rows, user],
  );
  const inbox = useMemo(
    () => rows.filter((row) => row.kind === 'submission' && !row.owner_reply),
    [rows],
  );
  const replied = useMemo(
    () => rows.filter((row) => row.kind === 'submission' && !!row.owner_reply),
    [rows],
  );
  const sent = useMemo(
    () => rows.filter((row) => row.kind === 'question'),
    [rows],
  );

  useEffect(() => {
    if (!user || view !== 'mine') return;
    const unseen = mySubmissions.filter((row) => row.owner_reply && !row.acknowledged_at);
    if (unseen.length === 0) return;
    void Promise.all(unseen.map((row) => acknowledgeProductFeedback(row.id))).then(refresh);
  }, [mySubmissions, refresh, user, view]);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/settings');
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border-default bg-bg-base/95 backdrop-blur">
        <div className="safe-x safe-top mx-auto flex max-w-4xl items-center gap-3 pb-3">
          <button
            type="button"
            onClick={goBack}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border-default text-text-secondary"
            aria-label="go back"
          >
            <ChevronLeftIcon />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
              feedback loop
            </p>
            <h1 className="truncate text-lg font-semibold">what Jargon hears</h1>
          </div>
          {owner && (
            <span className="rounded-full border border-accent-jargon/50 bg-accent-jargon/10 px-3 py-2 font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
              owner
            </span>
          )}
        </div>
      </header>

      <main className="safe-x mx-auto max-w-4xl pb-16 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="feedback views">
          <ViewTab active={view === 'mine'} label="my loop" count={mySubmissions.length} onClick={() => setView('mine')} />
          <ViewTab
            active={view === 'check-in'}
            label="check-in"
            count={myQuestions.filter((row) => !row.answer).length}
            onClick={() => setView('check-in')}
          />
          {owner && (
            <>
              <ViewTab active={view === 'inbox'} label="inbox" count={inbox.length} onClick={() => setView('inbox')} />
              <ViewTab active={view === 'replied'} label="replied" count={replied.length} onClick={() => setView('replied')} />
              <ViewTab active={view === 'sent'} label="sent" count={sent.length} onClick={() => setView('sent')} />
              <ViewTab active={view === 'ask'} label="ask" onClick={() => setView('ask')} />
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-md border border-accent-triage/50 bg-surface-card p-3 text-sm text-accent-triage">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center text-sm text-text-muted">loading the loop…</p>
        ) : (
          <div className="mt-4">
            {view === 'mine' && <MyLoop rows={mySubmissions} />}
            {view === 'check-in' && (
              <CheckIn
                rows={myQuestions}
                onSaved={async () => {
                  pushToast('answer saved', 'success');
                  await refresh();
                }}
              />
            )}
            {owner && view === 'inbox' && (
              <OwnerList rows={inbox} pilots={pilots} onSaved={refresh} />
            )}
            {owner && view === 'replied' && (
              <OwnerList rows={replied} pilots={pilots} onSaved={refresh} />
            )}
            {owner && view === 'sent' && (
              <SentQuestions rows={sent} pilots={pilots} />
            )}
            {owner && view === 'ask' && (
              <AskPilot
                pilots={pilots.filter((pilot) => pilot.user_id !== user?.id)}
                onSent={async () => {
                  pushToast('question sent', 'success');
                  await refresh();
                  setView('sent');
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ViewTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-semibold ${
        active
          ? 'border-accent-jargon bg-accent-jargon/20 text-text-primary'
          : 'border-border-default bg-surface-card text-text-secondary'
      }`}
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className="font-mono text-2xs text-text-muted">{count}</span>
      )}
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-card p-6 text-center">
      <FeedbackBubbleIcon className="mx-auto h-8 w-8 text-accent-jargon-hi" />
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}

function MyLoop({ rows }: { rows: FeedbackRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="no notes yet"
        body="Use the feedback button anywhere in Jargon. Replies and changes driven by your notes will collect here."
      />
    );
  }
  const wins = rows.filter((row) => row.resulted_in);
  return (
    <div className="space-y-4">
      {wins.length > 0 && (
        <section className="rounded-lg border border-accent-jargon/40 bg-accent-jargon/10 p-4">
          <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
            changes from your feedback
          </p>
          <div className="mt-3 space-y-2">
            {wins.map((row) => (
              <p key={row.id} className="text-sm leading-relaxed text-text-primary">
                {row.resulted_in}
              </p>
            ))}
          </div>
        </section>
      )}
      {rows.map((row) => (
        <FeedbackCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }) {
  return (
    <article className="rounded-lg border border-border-default bg-surface-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border-default bg-bg-base px-2 py-1 text-2xs font-semibold text-text-secondary">
          {row.category}
        </span>
        <span className="font-mono text-2xs text-text-muted">{relativeTime(row.created_at)}</span>
        {row.status === 'closed' && (
          <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">closed</span>
        )}
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{row.message}</p>
      {row.screenshot_data && (
        <a
          href={row.screenshot_data}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-md border border-border-default p-2 focus:outline-none focus:ring-2 focus:ring-accent-jargon"
        >
          <img
            src={row.screenshot_data}
            alt="screenshot attached to feedback"
            className="max-h-[192px] w-full rounded-sm object-cover object-top"
          />
          <span className="mt-2 block text-xs text-accent-jargon-hi">open screenshot</span>
        </a>
      )}
      {row.owner_reply ? (
        <div className="mt-4 rounded-md border border-accent-jargon/30 bg-bg-base p-3">
          <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
            reply
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {row.owner_reply}
          </p>
          {row.resulted_in && (
            <div className="mt-3 border-t border-border-default pt-3">
              <p className="text-xs font-semibold text-accent-jargon-hi">
                because of your feedback, we’re shipping this
              </p>
              <p className="mt-1 text-sm text-text-primary">{row.resulted_in}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-text-muted">received — reply pending.</p>
      )}
    </article>
  );
}

function CheckIn({
  rows,
  onSaved,
}: {
  rows: FeedbackRow[];
  onSaved: () => Promise<void>;
}) {
  const ordered = useMemo(
    () => [...rows.filter((row) => !row.answer), ...rows.filter((row) => !!row.answer)],
    [rows],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= ordered.length) setIndex(Math.max(0, ordered.length - 1));
  }, [index, ordered.length]);

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="no check-in waiting"
        body="When the Jargon owner sends a follow-up question, it will appear here one at a time."
      />
    );
  }

  const current = ordered[index];
  const answered = rows.filter((row) => !!row.answer).length;
  const percent = Math.round((answered / rows.length) * 100);

  return (
    <section>
      <div
        className="rounded-full bg-surface-card"
        role="progressbar"
        aria-label="check-in progress"
        aria-valuemin={0}
        aria-valuemax={rows.length}
        aria-valuenow={answered}
      >
        <div
          className="h-2 rounded-full bg-accent-jargon transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-2xs text-text-muted">
        <span>{answered}/{rows.length} answered</span>
        <span>{index + 1}/{ordered.length}</span>
      </div>
      <QuestionCard key={current.id} row={current} onSaved={onSaved} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setIndex((currentIndex) => Math.max(0, currentIndex - 1))}
          disabled={index === 0}
          className="min-h-[44px] rounded-md border border-border-default text-sm font-semibold text-text-secondary disabled:opacity-40"
        >
          previous
        </button>
        <button
          type="button"
          onClick={() =>
            setIndex((currentIndex) => Math.min(ordered.length - 1, currentIndex + 1))
          }
          disabled={index === ordered.length - 1}
          className="min-h-[44px] rounded-md border border-border-default text-sm font-semibold text-text-secondary disabled:opacity-40"
        >
          next
        </button>
      </div>
    </section>
  );
}

function QuestionCard({
  row,
  onSaved,
}: {
  row: FeedbackRow;
  onSaved: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState(row.answer ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!answer.trim()) {
      setError('write or dictate an answer first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await answerProductFeedback(row.id, answer.trim());
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'couldn’t save this answer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="mt-4 rounded-lg border border-accent-jargon/40 bg-surface-card p-4">
      <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
        {row.prompt_label || 'quick check-in'}
      </p>
      <h2 className="mt-3 text-lg font-semibold leading-snug">{row.message}</h2>
      <p className="mt-2 text-xs text-text-muted">asked {relativeTime(row.created_at)}</p>
      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wider text-text-muted">your answer</span>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          maxLength={4000}
          rows={7}
          placeholder="just ramble. no polish needed."
          className="mt-2 w-full resize-none rounded-lg border border-border-default bg-bg-base p-3 text-base leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent-jargon focus:outline-none focus:ring-2 focus:ring-accent-jargon/30"
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-text-muted">{answer.length}/4000</span>
        {row.answered_at && (
          <span className="text-xs text-text-muted">saved {relativeTime(row.answered_at)}</span>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-accent-triage">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 min-h-[48px] w-full rounded-lg bg-accent-jargon px-4 text-sm font-semibold text-text-primary active:bg-accent-jargon-lo disabled:opacity-50"
      >
        {saving ? 'saving…' : row.answer ? 'save edited answer' : 'save answer'}
      </button>
    </article>
  );
}

function OwnerList({
  rows,
  pilots,
  onSaved,
}: {
  rows: FeedbackRow[];
  pilots: PilotUser[];
  onSaved: () => Promise<void>;
}) {
  if (rows.length === 0) {
    return <EmptyState title="nothing here" body="This mailbox view is clear." />;
  }
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <OwnerFeedbackCard key={row.id} row={row} pilots={pilots} onSaved={onSaved} />
      ))}
    </div>
  );
}

function pilotLabel(pilots: PilotUser[], userId: string) {
  const pilot = pilots.find((candidate) => candidate.user_id === userId);
  return pilot ? `${pilot.display_name} · ${pilot.email}` : 'pilot user';
}

function OwnerFeedbackCard({
  row,
  pilots,
  onSaved,
}: {
  row: FeedbackRow;
  pilots: PilotUser[];
  onSaved: () => Promise<void>;
}) {
  const [reply, setReply] = useState(row.owner_reply ?? '');
  const [resultedIn, setResultedIn] = useState(row.resulted_in ?? '');
  const [close, setClose] = useState(row.status === 'closed');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!reply.trim()) {
      setError('write a reply first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await replyToProductFeedback(row.id, reply.trim(), resultedIn.trim(), close);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'couldn’t save the reply.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-lg border border-border-default bg-surface-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border-default bg-bg-base px-2 py-1 text-2xs font-semibold text-text-secondary">
          {row.category}
        </span>
        <span className="text-xs text-text-secondary">{pilotLabel(pilots, row.author_user_id)}</span>
        <span className="font-mono text-2xs text-text-muted">{relativeTime(row.created_at)}</span>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{row.message}</p>
      {row.screen && <p className="mt-2 font-mono text-2xs text-text-muted">{row.screen}</p>}
      {row.screenshot_data && (
        <a href={row.screenshot_data} target="_blank" rel="noreferrer" className="mt-3 block">
          <img
            src={row.screenshot_data}
            alt="feedback screenshot"
            className="max-h-[224px] w-full rounded-md border border-border-default object-cover object-top"
          />
        </a>
      )}
      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wider text-text-muted">reply</span>
        <textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          maxLength={4000}
          rows={4}
          className="mt-2 w-full resize-none rounded-md border border-border-default bg-bg-base p-3 text-sm text-text-primary focus:border-accent-jargon focus:outline-none"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          what this is driving <span className="normal-case text-text-muted">(optional)</span>
        </span>
        <textarea
          value={resultedIn}
          onChange={(event) => setResultedIn(event.target.value)}
          maxLength={500}
          rows={2}
          placeholder="the change they’ll see in their feedback loop"
          className="mt-2 w-full resize-none rounded-md border border-border-default bg-bg-base p-3 text-sm text-text-primary focus:border-accent-jargon focus:outline-none"
        />
      </label>
      <label className="mt-3 flex min-h-[44px] items-center justify-between rounded-md border border-border-default px-3 text-sm">
        close this thread
        <input
          type="checkbox"
          checked={close}
          onChange={(event) => setClose(event.target.checked)}
          className="h-6 w-6 accent-accent-jargon"
        />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-accent-triage">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 min-h-[48px] w-full rounded-lg bg-accent-jargon text-sm font-semibold text-text-primary active:bg-accent-jargon-lo disabled:opacity-50"
      >
        {saving ? 'saving…' : row.owner_reply ? 'update reply' : 'send reply'}
      </button>
    </article>
  );
}

function SentQuestions({ rows, pilots }: { rows: FeedbackRow[]; pilots: PilotUser[] }) {
  if (rows.length === 0) {
    return <EmptyState title="no questions sent" body="Use Ask to send a pilot a focused follow-up." />;
  }
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <article key={row.id} className="rounded-lg border border-border-default bg-surface-card p-4">
          <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
            {row.prompt_label || 'question'} · {pilotLabel(pilots, row.asked_user_id ?? '')}
          </p>
          <p className="mt-3 text-sm leading-relaxed">{row.message}</p>
          {row.answer ? (
            <div className="mt-4 rounded-md border border-accent-jargon/30 bg-bg-base p-3">
              <p className="text-xs font-semibold text-accent-jargon-hi">their answer</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{row.answer}</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-text-muted">waiting for an answer.</p>
          )}
        </article>
      ))}
    </div>
  );
}

function AskPilot({
  pilots,
  onSent,
}: {
  pilots: PilotUser[];
  onSent: () => Promise<void>;
}) {
  const [userId, setUserId] = useState(pilots[0]?.user_id ?? '');
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId && pilots[0]) setUserId(pilots[0].user_id);
  }, [pilots, userId]);

  async function send() {
    if (!userId || !message.trim()) {
      setError('choose a pilot and write a question.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await askJargonPilot(userId, message.trim(), label.trim());
      setLabel('');
      setMessage('');
      await onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'couldn’t send the question.');
    } finally {
      setSending(false);
    }
  }

  if (pilots.length === 0) {
    return (
      <EmptyState
        title="no pilot recipient yet"
        body="Invite a named pilot first. Once their allowlisted account exists, they will appear here."
      />
    );
  }

  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-4">
      <p className="font-mono text-2xs uppercase tracking-wider text-accent-jargon-hi">
        ask one useful thing
      </p>
      <h2 className="mt-2 text-lg font-semibold">send a Jargon check-in</h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        The pilot gets one focused question at a time, with save-and-return answers.
      </p>
      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wider text-text-muted">pilot</span>
        <select
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="mt-2 min-h-[48px] w-full rounded-md border border-border-default bg-bg-base px-3 text-sm text-text-primary focus:border-accent-jargon focus:outline-none"
        >
          {pilots.map((pilot) => (
            <option key={pilot.user_id} value={pilot.user_id}>
              {pilot.display_name} · {pilot.email}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4">
        <p className="text-xs uppercase tracking-wider text-text-muted">starting points</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ASK_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => {
                setLabel(template.label);
                setMessage(template.message);
              }}
              className="min-h-[48px] rounded-md border border-border-default bg-bg-base px-3 text-left text-xs font-semibold text-text-secondary hover:border-accent-jargon/50 hover:text-text-primary"
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>
      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wider text-text-muted">short label</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          placeholder="first lesson"
          className="mt-2 min-h-[48px] w-full rounded-md border border-border-default bg-bg-base px-3 text-sm text-text-primary focus:border-accent-jargon focus:outline-none"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-wider text-text-muted">question</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={4000}
          rows={6}
          className="mt-2 w-full resize-none rounded-md border border-border-default bg-bg-base p-3 text-base leading-relaxed text-text-primary focus:border-accent-jargon focus:outline-none"
        />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-accent-triage">{error}</p>}
      <button
        type="button"
        onClick={() => void send()}
        disabled={sending}
        className="mt-4 min-h-[48px] w-full rounded-lg bg-accent-jargon text-sm font-semibold text-text-primary active:bg-accent-jargon-lo disabled:opacity-50"
      >
        {sending ? 'sending…' : 'send question'}
      </button>
    </section>
  );
}
