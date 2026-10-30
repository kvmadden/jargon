// Domain → ordered list of path IDs, for Edge-Function prompt
// substitution + per-path-count balancing.
//
// Mirror of `src/lib/domains.ts` `DOMAIN_META[*].paths`. Edge Functions
// can't import the TS-side registry, so we duplicate the small lookup
// here. The pre-deploy script gate-7 (B+1.5.3) cross-checks both sides.
//
// Where it lands: `ingest-terms` Pass 1 (candidate generator) — used to
// (a) compute per-path live-term counts so the prompt can balance
// generation toward least-represented paths within the active domain,
// and (b) tell Opus which path enum values are valid for this cycle.
//
// When you add a domain, add its paths here AND in src/lib/domains.ts
// AND extend the `terms.path` CHECK constraint via a migration to
// include the new path values.

const PATHS_BY_DOMAIN: Record<string, string[]> = {
  coding: [
    'git-cli',
    'dev-concepts',
    'enterprise',
    'claude-code',
    'ai-engineering',
    'agile',
    'systems',
    'programming',
    'dev-tooling',
    'dev-workflow',
    'web-api',
    'databases',
    'computing',
    'networking',
    'security',
    'architecture',
    'systems-engineering',
    'cloud-devops',
    'qa-reliability',
    'math-logic',
    'tech-stack',
    'enterprise-platforms',
    'data-analytics',
  ],
  // B+1.9 — AI domain paths. All `ai-*`-prefixed for cross-domain
  // uniqueness in the global terms.path CHECK constraint. UI labels
  // strip the prefix (PATH_META in src/lib/database.types.ts).
  ai: [
    'ai-foundations',
    'ai-tools',
    'ai-prompting',
    'ai-products',
    'ai-evaluation',
    'ai-policy',
    'ai-agentic-era',
  ],
};

const DEFAULT = PATHS_BY_DOMAIN.coding;

/**
 * Returns the path-id array for a domain. Falls back to coding paths
 * for unknown domains so the prompt stays coherent.
 */
export function pathsForDomain(domain: string | null | undefined): string[] {
  if (!domain) return DEFAULT;
  return PATHS_BY_DOMAIN[domain] ?? DEFAULT;
}

/** Convenience: the path list joined as "a | b | c" for prompt substitution. */
export function pathListPipe(domain: string | null | undefined): string {
  return pathsForDomain(domain).join(' | ');
}
