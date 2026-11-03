import { useState } from 'react';
import { useUserStore } from '../stores/user-store';
import { useModalA11y } from './use-modal-a11y';

const APP_VERSION = '0.4.3';
const ITERATION_NUMBER = 47;

const RECENT_CHANGES = [
  {
    iteration: 47,
    title: 'AI platform source map',
    update:
      'adds source-backed AI platform, coding-agent, app-builder, local-model, and content-freshness concepts, plus a Kevin-first feedback loop for AI-drafted updates.',
  },
  {
    iteration: 46,
    title: 'Excel, Power BI, and Fabric analytics',
    update:
      'adds Excel, Power BI, and Microsoft Fabric vocabulary, surfaces existing API gateway/WebSocket/GraphQL rows in the atlas, and expands the map to 22 lanes and 612 concepts.',
  },
  {
    iteration: 45,
    title: 'platform operating-system vocabulary',
    update:
      'adds Microsoft 365, Dataverse, Power Platform, Azure, GitHub Actions, Copilot Studio, and Claude tooling terms, then expands the atlas to 21 lanes and 541 concepts.',
  },
] as const;

export function VersionPill({ inline = false }: { inline?: boolean } = {}) {
  const user = useUserStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useModalA11y(open, () => setOpen(false));

  // Gated to signed-in users — keeps the dev-flavored version pill off the
  // public splash so gift recipients don't see it pre-auth (mirrors
  // CommandPaletteHost's suppression).
  if (!user) return null;

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="dismiss version notes backdrop"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-bg-base/70 backdrop-blur-[2px] sm:hidden"
        />
      )}
      <div className={inline ? "relative flex flex-col-reverse items-start gap-2" : "fixed right-4 z-50 flex flex-col-reverse items-end gap-2 [top:calc(env(safe-area-inset-top,0px)+1rem)]"}>
        {open && (
          <section
            ref={ref}
            tabIndex={-1}
            id="version-pill-panel"
            role="dialog"
            aria-modal="true"
            aria-label="version notes"
            className="max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-md border border-border-default bg-surface-card/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-md sm:max-h-[calc(100vh-5rem)] sm:w-[22rem] focus:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xs font-mono uppercase tracking-wide text-accent-jargon-hi">
                  v{APP_VERSION} / iteration {ITERATION_NUMBER}
                </p>
                <h2 className="mt-1 text-sm font-semibold text-text-primary">
                  latest changes
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-md border border-border-default bg-surface-card-hi px-2 font-mono text-sm text-text-secondary transition-colors hover:border-accent-jargon/50 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-jargon"
                aria-label="close version notes"
              >
                x
              </button>
            </div>
            <ol className="mt-4 space-y-3">
              {RECENT_CHANGES.map((change) => (
                <li
                  key={change.iteration}
                  className="border-t border-border-default pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="font-mono text-2xs uppercase tracking-wide text-text-muted">
                    iteration {change.iteration}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-text-primary">
                    {change.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    {change.update}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="min-h-[44px] rounded-full border border-border-default bg-surface-card px-3 py-2 font-mono text-[11px] font-semibold text-text-primary shadow-lg shadow-black/30 transition-colors hover:border-accent-jargon/50 hover:bg-surface-card-hi focus:outline-none focus:ring-2 focus:ring-accent-jargon sm:px-4 sm:text-xs"
          aria-controls="version-pill-panel"
          aria-expanded={open}
          aria-label={`v${APP_VERSION} / iteration ${ITERATION_NUMBER}`}
        >
          <span className="sm:hidden">v{APP_VERSION} / i{ITERATION_NUMBER}</span>
          <span className="hidden sm:inline">
            v{APP_VERSION} / iteration {ITERATION_NUMBER}
          </span>
        </button>
      </div>
    </>
  );
}
