import { Link, useLocation } from 'react-router-dom';
import { FeedbackBubbleIcon } from '../features/feedback/icons';
import { feedbackButtonLabel, useFeedbackUnread } from '../features/feedback/unread-store';
import { appBarShowsWordmark, showsAppBar } from '../lib/app-chrome';
import { useUserStore } from '../stores/user-store';
import { Wordmark } from './wordmark';

// The app bar, signed in, at every size (Kevin, 2026-11-03): the wordmark,
// search and feedback sit in a bar at the top of the page, so nothing floats
// over the content. It scrolls away with the page, and each screen's own
// header stays pinned below it. The buttons send the same window events the
// command palette and the feedback sheet listen for.
export function AppBar() {
  const user = useUserStore((s) => s.user);
  const { pathname } = useLocation();
  const unread = useFeedbackUnread((s) => s.unread);
  if (!user || !showsAppBar(pathname)) return null;
  const buttonClass =
    'inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm text-text-secondary transition-colors hover:bg-surface-card hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon-hi';
  return (
    <div data-app-bar="" className="border-b border-border-default bg-bg-base">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 lg:px-8">
        {appBarShowsWordmark(pathname) ? (
          <Link to="/home" aria-label="jargon home" className="inline-flex min-h-[44px] items-center text-text-primary">
            <Wordmark size={18} showDot />
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={buttonClass}
            aria-label="search terms"
            onClick={() => window.dispatchEvent(new Event('jargon:open-search'))}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>search</span>
            <span className="hidden text-text-muted lg:inline">⌘K</span>
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label={feedbackButtonLabel(unread, 'send feedback')}
            onClick={() => window.dispatchEvent(new Event('jargon:open-feedback'))}
          >
            <FeedbackBubbleIcon />
            <span>feedback</span>
            {unread > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-jargon px-2 font-mono text-sm text-text-primary">
                {unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
