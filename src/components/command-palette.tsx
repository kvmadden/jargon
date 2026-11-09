// Cmd+K command palette (B+1.6 Batch 3 — power-user trajectory).
//
// Opens via Cmd+K (Mac) or Ctrl+K (Windows/Linux). Renders a modal
// overlay with a search input and a ranked list of commands: terms +
// routes + actions. Up/Down to navigate, Enter to select, Esc to close.
//
// The keyboard handler lives in `useCommandPalette` (a hook) so it can
// be wired at App.tsx level. The component is a pure renderer that
// takes `open` + `onClose` + the command list — no global state.
//
// Brand-coherent: the modal sits on bg-base/80 backdrop, the panel is
// surface-card with the violet accent border on the active row. No
// other colors. Lowercase voice throughout.
//
// Mobile: the keyboard shortcut won't fire on touch. A dedicated
// "search" button on home (deferred — see memory) opens this same
// component as a full-screen sheet. For now, desktop-first.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  rankCommands,
  type Command,
  type RankedCommand,
} from '../lib/command-palette';
import { useModalA11y } from './use-modal-a11y';

interface Props {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  /**
   * Optional override for routing. Default is react-router's navigate.
   * Tests inject a mock so we don't need a Router wrapping the palette.
   */
  onSelectAction?: (target: string) => void;
}

const MAX_RESULTS = 20;

export function CommandPalette({ open, onClose, commands, onSelectAction }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const ref = useModalA11y(open, onClose);

  const results = useMemo<RankedCommand[]>(
    () => rankCommands(query, commands, MAX_RESULTS),
    [query, commands],
  );

  // Reset query + active row whenever the palette opens fresh.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Defer focus to next tick so the input is mounted before we focus it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp activeIndex when the result list shrinks (e.g. user types more
  // and fewer matches remain). Otherwise Enter could fire on a stale row.
  useEffect(() => {
    if (activeIndex >= results.length) {
      setActiveIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, activeIndex]);

  // Scroll the active row into view as the user arrows through.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleSelect(cmd: RankedCommand) {
    onClose();
    if (onSelectAction) {
      onSelectAction(cmd.target);
      return;
    }
    if (cmd.kind === 'route' || cmd.kind === 'term') {
      navigate(cmd.target);
    } else {
      // Actions broadcast a custom event — the App-level handler
      // dispatches them so we don't pull store dependencies into the
      // palette component itself.
      window.dispatchEvent(new CustomEvent('jargon:command', { detail: cmd.target }));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const sel = results[activeIndex];
      if (sel) handleSelect(sel);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-bg-base/80 backdrop-blur-sm p-0 sm:pt-[10vh] sm:px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="command palette"
        className="w-full h-full sm:h-auto max-w-xl bg-surface-card border-0 sm:border border-border-default rounded-none sm:rounded-xl overflow-hidden shadow-2xl focus:outline-none flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="relative flex items-center border-b border-border-default px-4">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-label="search commands"
            aria-controls="command-palette-list"
            aria-activedescendant={results.length > 0 ? `cmd-option-${activeIndex}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="type a term, route, or action…"
            className="w-full bg-transparent py-4 pr-2 text-base text-text-primary placeholder:text-text-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="close command palette"
            className="sm:hidden flex items-center justify-center w-[44px] h-[44px] text-text-secondary hover:text-text-primary min-w-[44px] min-h-[44px] select-none shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {open ? `${results.length} ${results.length === 1 ? 'result' : 'results'} found` : ''}
        </div>
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="commands"
          className="max-h-none sm:max-h-[60vh] flex-1 sm:flex-initial overflow-y-auto py-1"
        >
          {results.length === 0 ? (
            <p className="text-sm text-text-muted text-center px-4 py-6">
              nothing matches. try a term name, route, or "sign out".
            </p>
          ) : (
            results.map((r, i) => (
              <CommandRow
                key={`${r.kind}-${r.id}`}
                cmd={r}
                active={i === activeIndex}
                index={i}
                onSelect={() => handleSelect(r)}
                onHover={() => setActiveIndex(i)}
              />
            ))
          )}
        </div>

        {/* Hint footer — tells users the keyboard contract without
            requiring discovery via trial & error. */}
        <div className="border-t border-border-default px-4 py-2 flex items-center justify-between text-2xs font-mono uppercase tracking-wider text-text-muted">
          <span>↑ ↓ navigate · ⏎ select · esc close</span>
          <span>{results.length} {results.length === 1 ? 'result' : 'results'}</span>
        </div>
      </div>
    </div>
  );
}

function CommandRow({
  cmd,
  active,
  index,
  onSelect,
  onHover,
}: {
  cmd: RankedCommand;
  active: boolean;
  index: number;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      id={`cmd-option-${index}`}
      aria-selected={active}
      tabIndex={-1}
      data-index={index}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 min-h-[44px] ${
        active ? 'bg-accent-jargon/[0.12]' : 'hover:bg-bg-base'
      } transition-colors`}
    >
      <KindPill kind={cmd.kind} />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm truncate ${
            active ? 'text-accent-jargon-hi font-medium' : 'text-text-primary'
          }`}
        >
          {cmd.name}
        </p>
        {cmd.subtitle && (
          <p className="text-xs text-text-muted truncate">{cmd.subtitle}</p>
        )}
      </div>
    </button>
  );
}

function KindPill({ kind }: { kind: Command['kind'] }) {
  const label =
    kind === 'route' ? 'go' : kind === 'action' ? 'do' : 'term';
  return (
    <span className="text-2xs font-mono uppercase tracking-wider text-text-muted shrink-0 w-8 text-right">
      {label}
    </span>
  );
}
