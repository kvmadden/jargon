

import { Wordmark } from './wordmark';

/**
 * Landing — the marketing surface for first-time visitors.
 *
 * Lives inside <Splash> rather than as its own route — Splash already owns
 * the `mode` state machine + the auth flow, so flipping in/out of landing
 * is just one more mode. Returning visitors with `jargon-seen-landing` set
 * in localStorage skip this entirely (Splash defaults them to the email
 * form on mount).
 *
 * Voice — translator-not-professor (per project convention). The tagline does the
 * brand work; the subhead resolves the puzzle for first-timers who don't
 * yet know what jargon IS.
 *
 * No auth here, no signup, no fields. Just the pitch + a single CTA into
 * the magic-link form.
 */

interface LandingProps {
  /** Called when the user taps "let's go". Splash flips to mode='idle' (email form). */
  onContinue: () => void;
}

export function Landing({ onContinue }: LandingProps) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-base safe-top safe-bottom">
      {/* Hero — wordmark + tagline + bridging explainer that resolves the metaphor */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full py-8">
        <Wordmark size={56} className="mb-6 text-accent-jargon" />
        <p className="text-2xl font-light italic text-text-primary text-center tracking-tight leading-tight">
          Speak the room.
        </p>
        {/* Bridges the tagline: "read the room" → comprehension. inverted →
            fluency. then names the rooms (terminal / family / slack). */}
        <p className="text-sm text-text-secondary text-center mt-3 leading-relaxed">
          you’ve nodded along when claude code, your dev family, or your work slack
          used a word you didn’t quite know. <span className="text-text-primary">jargon teaches those words</span> —
          so you stop reading the room and start speaking it.
        </p>

        {/* Three pillars — concrete, not abstract. Each one is a literal
            scenario the user can imagine themselves in. */}
        {/* POLISH (B+1.10 designer P1): mono numerals 01/02/03 give each
            pillar a tactile anchor, so the column reads as an ordered list
            of scenarios instead of three identical body-copy blocks. */}
        <ul className="flex flex-col gap-3 w-full mt-8">
          <Pillar
            n="01"
            title="follow what claude code is doing"
            body="terminal output stops being magic. you read it like a sentence."
          />
          <Pillar
            n="02"
            title="hold your own with the dev family"
            body="when your brother says ‘monorepo’ or ‘rebase,’ you’re already nodding for the right reason."
          />
          <Pillar
            n="03"
            title="sound credible at work"
            body="slack, standups, status reports — the words land where they should."
          />
        </ul>

        <button
          type="button"
          onClick={onContinue}
          className="w-full mt-8 bg-accent-jargon text-text-primary font-semibold rounded-lg py-4 min-h-[56px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon transition-colors"
        >
          let’s go
        </button>

        <p className="text-2xs text-text-muted mt-4 lowercase tracking-wider font-mono">
          invite-only · sign in with your email
        </p>
      </main>

      <footer className="px-4 py-4 text-center">
        <p className="text-xs text-text-muted">
          a <span className="lowercase">side reaction</span> by kevin madden
        </p>
      </footer>
    </div>
  );
}

interface PillarProps {
  n: string;
  title: string;
  body: string;
}

function Pillar({ n, title, body }: PillarProps) {
  return (
    <li className="bg-surface-card border border-border-default rounded-lg p-4 flex gap-3">
      <span
        aria-hidden="true"
        className="text-2xs uppercase tracking-wider text-accent-jargon-hi font-mono leading-tight pt-0.5 shrink-0 tabular-nums"
      >
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary leading-snug">{title}</p>
        {/* BUG FIX (B+1.10): bumped from text-xs (12px) → text-sm (14px) per
            the documented body-text minimum in CLAUDE.md. */}
        <p className="text-sm text-text-secondary leading-relaxed mt-1">{body}</p>
      </div>
    </li>
  );
}
