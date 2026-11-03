import { Link, useLocation } from 'react-router-dom';
import { feedbackButtonLabel, useFeedbackUnread } from '../features/feedback/unread-store';
import { showsDesktopAppBar } from '../lib/desktop-chrome';
import { useUserStore } from '../stores/user-store';
import { Wordmark } from './wordmark';

// The desktop app bar (lg and up, signed-in only). Search and feedback live
// here, inside the layout, instead of floating over the page (Kevin,
// 2026-11-03). Phones keep the floating buttons. The buttons send the same
// window events the floating buttons' components listen for. Focused flows
// with their own header get no bar (see desktop-chrome.ts).
export function DesktopAppBar() {
  const user = useUserStore((s) => s.user);
  const { pathname } = useLocation();
  const unread = useFeedbackUnread((s) => s.unread);
  if (!user || !showsDesktopAppBar(pathname)) return null;
  const buttonClass =
    'inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 text-sm text-text-secondary transition-colors hover:bg-surface-card hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon-hi';
  return (
    <div data-desktop-app-bar="" className="hidden lg:block border-b border-border-default bg-bg-base">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-8">
        <Link to="/home" aria-label="jargon home" className="inline-flex min-h-[44px] items-center text-text-primary">
          <Wordmark size={18} showDot />
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" className={buttonClass} onClick={() => window.dispatchEvent(new Event('jargon:open-search'))}>
            search terms
            <kbd className="rounded-sm border border-border-default px-1 font-mono text-2xs text-text-muted">⌘K</kbd>
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-label={feedbackButtonLabel(unread, 'send a note')}
            onClick={() => window.dispatchEvent(new Event('jargon:open-feedback'))}
          >
            send a note
            {unread > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-jargon px-2 font-mono text-xs text-text-primary">
                {unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
