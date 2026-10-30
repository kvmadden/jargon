// Cmd+K command palette ranker (B+1.6 Batch 3).
//
// Pure function — takes the user's query + a flat list of `Command`
// entries (terms + routes + actions) and returns them ranked + filtered
// for display. The component renders the result list; this module makes
// the ranking decisions.
//
// Why not a fuzzy library (fzf / fuse.js)? At ~250 commands today
// (~210 terms + ~10 routes + a handful of actions) a deterministic
// substring scoring function is plenty fast and produces predictable
// results that don't require tuning. Swap in a fuzzy lib later if the
// command list grows past a few thousand or users start mistyping a lot.
//
// Ranking rules (in order of priority):
//   1. Exact match on `name` (case-insensitive) — perfect signal
//   2. Prefix match on `name` — strong signal
//   3. Substring match in `name` — medium signal
//   4. Substring match in `subtitle` — weak signal
//   5. Substring match in `keywords` — weak signal
// Within each tier, shorter `name` ranks first (so "git" beats "git commit"
// when the query is "git"). Then by `kind` priority: route > action > term
// for ambiguous matches (so typing "settings" finds the route, not a term
// that happens to mention settings).

export type CommandKind = 'term' | 'route' | 'action';

export interface Command {
  /** Stable id — usually the term id or route path. */
  id: string;
  kind: CommandKind;
  /** What the user sees in the result row. Term name / route label. */
  name: string;
  /** Optional second line. Definition snippet / route description. */
  subtitle?: string;
  /** Extra search aliases (e.g. ["git", "version control"] for git-cli path). */
  keywords?: string[];
  /** Where to navigate / what to do on select. The component dispatches. */
  target: string;
}

/** Tier-aware result with a numeric score for stable sorting. */
export interface RankedCommand extends Command {
  score: number;
}

const KIND_PRIORITY: Record<CommandKind, number> = {
  route: 3,
  action: 2,
  term: 1,
};

/**
 * Filter + rank commands for the palette.
 *
 * Empty query returns ALL commands ordered by kind priority (routes
 * first, then actions, then terms) — the palette's "default state"
 * shows the most-useful starting points. Pass `limit` to cap the
 * result list (default 20 — tighter than fuzzy palettes; the goal is
 * to show enough but not bury the cursor at depth 3 in a long list).
 */
export function rankCommands(
  query: string,
  commands: Command[],
  limit: number = 20,
): RankedCommand[] {
  if (!Array.isArray(commands)) return [];
  const safeCommands = commands.filter(
    (c): c is Command => !!c && typeof c === 'object' && typeof c.name === 'string' && typeof c.kind === 'string',
  );
  const q = (typeof query === 'string' ? query : '').trim().toLowerCase();
  const safeLimit = typeof limit !== 'number' || isNaN(limit) || limit < 0 ? 20 : Math.floor(limit);

  if (q.length === 0) {
    // Default state — sort by kind priority, then alphabetically.
    return safeCommands
      .map((c) => ({ ...c, score: (KIND_PRIORITY[c.kind] ?? 1) * 10 }))
      .sort((a, b) =>
        b.score - a.score ||
        a.name.localeCompare(b.name),
      )
      .slice(0, safeLimit);
  }

  const ranked: RankedCommand[] = [];
  for (const c of safeCommands) {
    const score = scoreCommand(q, c);
    if (score > 0) ranked.push({ ...c, score });
  }

  ranked.sort((a, b) =>
    b.score - a.score ||
    a.name.length - b.name.length ||
    KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind] ||
    a.name.localeCompare(b.name),
  );
  return ranked.slice(0, safeLimit);
}

/**
 * Score one command against the lowercase query. Returns 0 = no match,
 * higher = better. Tier numbers are spaced 10 apart so within-tier
 * tiebreakers (length / kind / alpha) never overflow into the next tier.
 */
function scoreCommand(q: string, c: Command): number {
  const name = c.name.toLowerCase();
  const subtitle = typeof c.subtitle === 'string' ? c.subtitle.toLowerCase() : '';
  const keywords = Array.isArray(c.keywords)
    ? c.keywords.filter((k): k is string => typeof k === 'string').map((k) => k.toLowerCase())
    : [];
  const priority = KIND_PRIORITY[c.kind] ?? 1;

  // Tier 1: exact name match (rare but the strongest signal — "settings"
  // typed verbatim must surface the settings route).
  if (name === q) return 100 + priority;

  // Tier 2: name starts with query.
  if (name.startsWith(q)) return 80 + priority;

  // Tier 3: name contains query (mid-word).
  if (name.includes(q)) return 60 + priority;

  // Tier 4: any keyword exactly matches.
  if (keywords.some((k) => k === q)) return 40 + priority;

  // Tier 5: keyword starts with query.
  if (keywords.some((k) => k.startsWith(q))) return 30 + priority;

  // Tier 6: subtitle contains query.
  if (subtitle.includes(q)) return 20 + priority;

  return 0;
}
