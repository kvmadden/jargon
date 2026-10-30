// CommandPaletteHost — top-level mount point for the Cmd+K palette.
//
// Builds the command index from the live dictionary + a hardcoded route
// list + a hardcoded action list. Listens for Cmd+K (Mac) / Ctrl+K
// (Win/Linux) at the window level and toggles the palette open/closed.
// Sits inside <AuthGate> in App.tsx so we don't fire dictionary fetches
// before sign-in.
//
// Action dispatch: the palette dispatches a `jargon:command` event with
// the action target ("sign-out", "start-lesson", etc.). This component
// listens for it + does the work. Keeps the palette component pure /
// store-agnostic so it's easy to test.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/user-store';
import { fetchAllTerms } from '../lib/data';
import type { TermRow } from '../lib/database.types';
import type { Command } from '../lib/command-palette';
import { CommandPalette } from './command-palette';

const ROUTES: Command[] = [
  { id: '/home', kind: 'route', name: 'home', subtitle: 'path map + next-up', target: '/home' },
  { id: '/profile', kind: 'route', name: 'profile', subtitle: 'streak + xp + path mastery', target: '/profile' },
  { id: '/settings', kind: 'route', name: 'settings', subtitle: 'all preferences + diagnostic', target: '/settings' },
  { id: '/questions', kind: 'route', name: 'lesson questions', subtitle: 'saved lesson questions and answers', keywords: ['questions', 'ask', 'inbox'], target: '/questions' },
  { id: '/feedback', kind: 'route', name: 'feedback loop', subtitle: 'your notes, replies, check-ins, and shipped changes', keywords: ['feedback', 'reply', 'check-in', 'inbox'], target: '/feedback' },
  { id: '/spotted', kind: 'route', name: 'spotted in the wild', subtitle: 'paste a transcript, see what you know', keywords: ['paste', 'transcript', 'scan'], target: '/spotted' },
  { id: '/mastered', kind: 'route', name: 'mastered terms', subtitle: 'every term you\'ve internalized, printable', keywords: ['gallery', 'print', 'pdf'], target: '/mastered' },
  { id: '/whats-new', kind: 'route', name: "what's new", subtitle: 'newly ingested terms', keywords: ['new'], target: '/whats-new' },
  { id: '/gift/send', kind: 'route', name: 'gift jargon', subtitle: 'set up a profile for someone you love', keywords: ['share', 'invite'], target: '/gift/send' },
  { id: '/program/agentic-era-operator', kind: 'route', name: 'agentic era course', subtitle: 'eight guided modules on working with AI agents', keywords: ['second sword', 'agents'], target: '/program/agentic-era-operator' },
  { id: '/atlas', kind: 'route', name: 'concept atlas', subtitle: 'standalone concept-atlas reference page', keywords: ['atlas', 'reference', 'concepts'], target: '/atlas' },
];

const ACTIONS: Command[] = [
  { id: 'action:sign-out', kind: 'action', name: 'sign out', subtitle: 'leave + clear local session', target: 'sign-out' },
];

export function CommandPaletteHost() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<TermRow[]>([]);

  // Lazy-load the dictionary the FIRST time the palette opens. Cheap to
  // hold the whole list in memory after that — at ~210 rows × ~600 bytes
  // each, the in-memory cost is well under 200kb.
  useEffect(() => {
    if (!open || !user || terms.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const all = await fetchAllTerms();
        if (!cancelled) setTerms(all);
      } catch {
        /* swallow — palette stays usable without terms */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, terms.length]);

  // Global Cmd+K / Ctrl+K listener. Capture phase so a focused input
  // doesn't swallow the chord.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isToggle) return;
      e.preventDefault();
      setOpen((o) => !o);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Action dispatcher — the palette emits `jargon:command` events with
  // the action target. We resolve the target here so the palette stays
  // store-agnostic.
  useEffect(() => {
    function onCommand(e: Event) {
      const target = (e as CustomEvent<string>).detail;
      if (target === 'sign-out') {
        void signOut().then(() => navigate('/'));
      }
      // Future actions land here as new `if` branches.
    }
    window.addEventListener('jargon:command', onCommand as EventListener);
    return () => window.removeEventListener('jargon:command', onCommand as EventListener);
  }, [navigate, signOut]);

  const commands = useMemo<Command[]>(() => {
    const termCommands: Command[] = terms.map((t) => ({
      id: t.id,
      kind: 'term',
      name: t.term,
      subtitle: t.one_line_definition,
      keywords: [t.path],
      target: `/term/${t.id}`,
    }));
    return [...ROUTES, ...ACTIONS, ...termCommands];
  }, [terms]);

  // Suppress the palette entirely until sign-in — pre-auth surfaces
  // (splash) shouldn't see Cmd+K do anything useful.
  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="open command palette"
        className="fixed bottom-16 right-4 z-40 flex items-center justify-center w-12 h-12 min-w-[44px] min-h-[44px] rounded-full bg-surface-card border border-border-default text-text-primary shadow-lg hover:border-accent-jargon active:bg-surface-card-hi focus:outline-none cursor-pointer select-none transition-colors"
      >
        <svg
          className="w-6 h-6 text-accent-jargon-hi"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        commands={commands}
      />
    </>
  );
}
