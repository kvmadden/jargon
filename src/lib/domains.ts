// Multi-domain registry for jargon.
//
// Today: jargon is coding-only. The single domain `'coding'` covers the 7
// existing paths (git-cli, dev-concepts, enterprise, claude-code, ai-ml,
// agile, systems) and the 210 anchor terms.
//
// Tomorrow: per project convention and the long-term vision, jargon teaches the
// language of any field — pharmacy, law, finance, ecology, etc. The
// architecture invariant that lets us add domains without rewriting is:
//
//   - Every term has a `domain` (defaults to 'coding')
//   - Every user has an `active_domain` they're currently learning
//   - PATH_META is partitioned by domain (paths belong to a domain)
//   - Opus prompts read the active domain from the call site, not from
//     a hardcoded "dev/AI vocabulary" string in the prompt template
//   - Ingestion sources are domain-specific (coding pulls from GitHub +
//     dev blogs; pharmacy would pull from PubMed + RxList; etc.)
//
// This file is the SINGLE SOURCE OF TRUTH for the domain enum + per-domain
// metadata. To add a domain, follow MULTI-DOMAIN-EXTENSION.md at the
// project root — it's a 4-step migration (registry → migration → seed →
// prompt update).
//
// The Domain type is intentionally a union of string literals so TypeScript
// catches any consumer that hardcodes 'coding' instead of using
// DEFAULT_DOMAIN or the user's active_domain.

import { colors } from 'design-tokens/design';
import type { PathId } from './database.types';

// ────────────────────────────────────────────────────────────
// Domain enum — extend this when adding a new domain
// ────────────────────────────────────────────────────────────
export type Domain = 'coding' | 'ai';

export const DEFAULT_DOMAIN: Domain = 'coding';

export const ALL_DOMAINS: Domain[] = ['coding', 'ai'];

// ────────────────────────────────────────────────────────────
// DomainGroup — meta-grouping of related domains (B+1.8)
// ────────────────────────────────────────────────────────────
//
// A DomainGroup bundles related domains for marketing copy, navigation
// ("here's everything in the knowledge-work family"), gift-mode bundles
// ("the knowledge worker starter pack"), and future cross-domain
// analytics. Domains stay atomic for content / lessons / translator;
// the group is purely a meta-layer.
//
// Today: one group ('knowledge-work') with one domain ('coding'). When
// AI / Excel / Microsoft 365 ship, they all join the same group.
//
// Future groups (post-knowledge-work): 'creative-tools' (Figma, Adobe),
// 'data-stack' (SQL, dbt, Snowflake), 'comms' (Slack, Notion, Linear).
// Each group has its own tagline; the brand umbrella ("the technology
// vocabulary translator") sits ABOVE all groups.

export type DomainGroupId = 'knowledge-work';

export interface DomainGroupMeta {
  /** Display label shown in cross-domain navigation. */
  label: string;
  /** Marketing tagline for the group (e.g. "efficiency through technology"). */
  tagline: string;
  /** Domains in this group, ordered for display (suggested learning order). */
  domains: Domain[];
}

export const DOMAIN_GROUPS: Record<DomainGroupId, DomainGroupMeta> = {
  'knowledge-work': {
    label: 'knowledge work',
    tagline: 'efficiency through technology',
    // Order = recommended progression. ai joined as B+1.9 (registered
    // but content-empty); excel → microsoft-365 → power-platform extend
    // this list as they ship.
    domains: ['coding', 'ai'],
  },
};

// ────────────────────────────────────────────────────────────
// Per-domain metadata
// ────────────────────────────────────────────────────────────
//
// Why this lives in TypeScript and not in a Postgres `domains` table:
//   - At single-domain scale, a table is overkill (one row, lots of
//     migration ceremony to update).
//   - The metadata here drives UI labels + Opus prompt strings, which
//     have to be kept in sync with code anyway.
//   - When the second domain ships, this file stays as the type-level
//     source of truth and we *also* add a Postgres `domains` table for
//     anything that wants to JOIN against it (analytics, ingestion logs).
//
// `vocabularyDescription` is the string substituted into Opus system
// prompts (e.g. grader's "teaching dev/AI vocabulary"). When this gets
// extracted into a prompt-template registry, the call sites become:
//
//     const tmpl = SYSTEM_PROMPT.replace('{{VOCAB}}', DOMAIN_META[domain].vocabularyDescription)
//
// For now the prompt strings are still inline in the Edge Functions — see
// MULTI-DOMAIN-EXTENSION.md §3 for the prompt-template-extraction work
// that needs to happen before a second domain can ship.
export interface DomainMeta {
  /** Display label shown in domain-pick UI (when it exists). */
  label: string;
  /** Short tagline for the domain-pick screen. */
  tagline: string;
  /**
   * The phrase that goes inside Opus system prompts where the current
   * code says "dev/AI vocabulary" or "the working vocabulary of dev/AI/
   * enterprise software." When prompts are templated, this gets
   * substituted at call time.
   */
  vocabularyDescription: string;
  /**
   * The list of path IDs that belong to this domain. The first-class
   * `paths` field lets a future domain-pick screen render the right
   * path map without consulting the global PATH_META.
   */
  paths: PathId[];
  /**
   * Iconify identifier for the domain's flat-art mark. Resolved by
   * `<DomainIcon>` to `https://api.iconify.design/<set>/<name>.svg` with
   * the color tint passed in via prop. To swap icons, change the `name`
   * here — no rebuild required for the URL itself, just a re-render.
   *
   * Default set is Phosphor regular (`ph`) — clean line work that pairs
   * with IBM Plex Mono. To browse alternatives: https://icon-sets.iconify.design/
   * Recommended sets that match the jargon aesthetic: `ph` (Phosphor),
   * `ph-bold`, `lucide`, `heroicons`. Avoid duotone / multi-color sets —
   * the violet-only brand discipline rules them out.
   */
  icon: {
    /** Iconify set slug — see https://icon-sets.iconify.design */
    set: string;
    /** Icon name within the set. */
    name: string;
  };
  /**
   * B+1.8 — which DomainGroup this domain belongs to. Drives cross-domain
   * navigation + marketing copy + gift-mode bundles. Today every domain
   * is in 'knowledge-work'; future families will define their own group ids.
   */
  groupId: DomainGroupId;
  /**
   * The two-line Goal A / Goal B frame used by `ingest-terms` Pass 1 + Pass 3
   * to score relevance: what does a user in this domain WANT to learn?
   *
   * For coding, Kevin's Goals are:
   *   Goal A: Follow Claude Code in real time
   *   Goal B: Talk to coding-masters family members
   *
   * For pharmacy (when it ships), the Goals would be different (e.g. "stay
   * sharp on emerging drug classes" + "talk shop with the clinical pharmacy
   * team"). The shape is the same — two named goals + concrete examples
   * each — so the ingest verifier prompts can substitute uniformly.
   *
   * String is multi-line. Mirror in `_shared/domain-goals.ts` (Deno side,
   * for Edge Function imports) MUST stay byte-identical. Pre-deploy script
   * gate-7 catches drift.
   */
  goalDescription: string;
  /**
   * B+1.16 (orientation pass): the path id `/home`'s featured-card logic
   * should default to FOR BRAND-NEW USERS. Different from `paths[0]` —
   * the array order drives the grid layout (which we want stable), but the
   * "start here" recommendation should pick the friendliest entry point
   * for someone who doesn't know any of the path names yet. For coding
   * that's `dev-concepts` (the foundational vocabulary), not `git-cli`
   * (whose name is itself jargon a beginner won't know). For AI it's
   * `ai-foundations` (which happens to be paths[0] anyway, but flagging
   * explicitly so the choice is intentional).
   *
   * When the user HAS progress, this default is overridden by the
   * "highest-mastery, not-yet-fully-mastered" pick — see home.tsx
   * featuredPath useMemo.
   */
  recommendedFirstPath: PathId;
}

export const DOMAIN_META: Record<Domain, DomainMeta> = {
  coding: {
    label: 'coding',
    tagline: 'follow claude code; talk to engineers',
    // VERBATIM match for the literal in the pre-templating Edge Function
    // prompts ("dev/AI/enterprise software vocabulary"). Mirror of
    // supabase/functions/_shared/domain-vocabulary.ts — both must agree.
    vocabularyDescription: 'dev/AI/enterprise software',
    paths: [
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
    // ph:code = Phosphor's `<>` mark. Generic, neutral, line-work weight that
    // pairs with IBM Plex Mono. Alternates worth trying: 'ph:terminal-window',
    // 'ph:git-branch', 'ph:brackets-angle'. One-line swap to change.
    icon: { set: 'ph', name: 'code' },
    groupId: 'knowledge-work',
    // VERBATIM match for the original Pass 3 goal text in ingest-terms.
    // Mirror of supabase/functions/_shared/domain-goals.ts — both must
    // agree (gate-7 of pre-deploy script catches drift).
    goalDescription: `Goal A: Follow Claude Code in real time — recognize words like rebase, monorepo, context window, RAG, idempotent that appear mid-CLI session
Goal B: Talk to coding-masters family members — drop tool call, embedding, sprint retro, feature flag, blast radius into family text threads naturally`,
    // dev-concepts is the friendliest entry point for someone who doesn't
    // yet know what "git" or "cli" mean — it teaches the foundational
    // shared vocabulary every coder uses (function, variable, bug, deploy)
    // before the user has to navigate anything tool-specific. git-cli
    // stays second in the grid (paths[0]) so the layout is unchanged;
    // only the featured-card default flips for first-paint orientation.
    recommendedFirstPath: 'dev-concepts',
  },
  ai: {
    label: 'ai',
    tagline: 'speak fluent ai — in any room',
    // The vocabulary description Opus substitutes when generating
    // personalizations / verifications for AI-domain terms. The
    // practitioner audience is non-engineers — PMs, analysts,
    // clinicians, anyone using AI tools without building them.
    vocabularyDescription: 'modern AI tools and concepts',
    paths: [
      'ai-foundations',
      'ai-tools',
      'ai-prompting',
      'ai-products',
      'ai-evaluation',
      'ai-policy',
      'ai-agentic-era',
    ],
    // ph:brain — line-art weight, recognizable AI signifier without
    // the rainbow ✨ cliché or the cartoon-robot trope.
    icon: { set: 'ph', name: 'brain' },
    groupId: 'knowledge-work',
    // Practitioner-flavored Goal A / Goal B. Parallels coding's two-line
    // shape so the ingest verifier prompts substitute uniformly.
    goalDescription: `Goal A: Follow modern AI in real time — recognize words like RAG, embedding, agent, fine-tuning, hallucination as they come up in articles, tools, and product launches
Goal B: Talk shop with engineers and AI-builders — drop tool call, context window, prompt engineering, retrieval into conversations naturally`,
    // ai-foundations is the right entry point — `model`, `token`, `context
    // window` are the building-block vocabulary everything else builds on.
    // happens to also be paths[0]; flagged explicitly so future reorders
    // don't accidentally change the recommendation.
    recommendedFirstPath: 'ai-foundations',
  },
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Type guard — narrow an arbitrary string to a known Domain or fall back to DEFAULT_DOMAIN. */
export function asDomain(raw: string | null | undefined): Domain {
  if (!raw) return DEFAULT_DOMAIN;
  if ((ALL_DOMAINS as string[]).includes(raw)) return raw as Domain;
  return DEFAULT_DOMAIN;
}

/** Get the path list for a domain. Falls back to coding paths if domain is unknown. */
export function pathsForDomain(domain: Domain): PathId[] {
  return DOMAIN_META[domain]?.paths ?? DOMAIN_META[DEFAULT_DOMAIN].paths;
}

/**
 * Get the recommended first path for a brand-new user in this domain.
 * Used by /home's featured-card default when no path has progress yet.
 * For coding this is `dev-concepts` (foundational vocabulary, less
 * intimidating than `git-cli` whose name is itself jargon). For ai
 * it's `ai-foundations`. See DomainMeta.recommendedFirstPath docblock.
 */
export function recommendedFirstPath(domain: Domain): PathId {
  return DOMAIN_META[domain]?.recommendedFirstPath ?? DOMAIN_META[DEFAULT_DOMAIN].recommendedFirstPath;
}

/** Get the vocabulary description for a domain — used in Opus prompt substitution. */
export function vocabularyDescription(domain: Domain): string {
  return DOMAIN_META[domain]?.vocabularyDescription ?? DOMAIN_META[DEFAULT_DOMAIN].vocabularyDescription;
}

/**
 * Get the Goal A / Goal B frame for a domain — used in `ingest-terms`
 * Pass 1 + Pass 3 prompts to ground the relevance verifier in what
 * users in this domain actually want to learn.
 */
export function goalDescription(domain: Domain): string {
  return DOMAIN_META[domain]?.goalDescription ?? DOMAIN_META[DEFAULT_DOMAIN].goalDescription;
}

// ────────────────────────────────────────────────────────────
// Iconify URL builder
// ────────────────────────────────────────────────────────────
//
// Resolves a DomainMeta.icon to a full Iconify hosted-SVG URL. Color is
// passed as a hex string with the leading `#` URL-encoded as `%23`.
// Iconify renders the SVG with `currentColor` swapped to that tint, so the
// caller doesn't need to do any post-processing — just `<img src={...} />`.
//
// Why hex (not a CSS variable name)? Iconify is a CDN, not a CSS context.
// The color HAS to be resolved at URL-build time. Pass the resolved hex
// from your design tokens — for jargon, that's `#C2410C` (accent-jargon)
// for active state and `text-secondary` (token: text.dim.dark) for muted state.

const ICONIFY_BASE = 'https://api.iconify.design';

export function iconUrl(set: string, name: string, hex: string): string {
  // Strip leading `#` so we can URL-encode it once. Lowercase for cache
  // friendliness — Iconify is case-insensitive on the color param but
  // CDN edges may key on the literal URL.
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
  return `${ICONIFY_BASE}/${set}/${name}.svg?color=%23${cleanHex.toLowerCase()}`;
}

/** Convenience wrapper — pulls the icon spec from the DOMAIN_META registry. */
export function domainIconUrl(domain: Domain, hex: string): string {
  const meta = DOMAIN_META[domain] ?? DOMAIN_META[DEFAULT_DOMAIN];
  return iconUrl(meta.icon.set, meta.icon.name, hex);
}

// ────────────────────────────────────────────────────────────
// DomainGroup helpers (B+1.8)
// ────────────────────────────────────────────────────────────

/** Get the group metadata for a domain. Falls back to the default
 *  domain's group for unknown domains so callers don't need to handle null. */
export function groupForDomain(domain: Domain): DomainGroupMeta {
  const meta = DOMAIN_META[domain] ?? DOMAIN_META[DEFAULT_DOMAIN];
  return DOMAIN_GROUPS[meta.groupId];
}

/** All domains belonging to a group, in registry order. */
export function domainsInGroup(groupId: DomainGroupId): Domain[] {
  return DOMAIN_GROUPS[groupId]?.domains ?? [];
}

// ────────────────────────────────────────────────────────────
// Onboarding domain options (B+1.10)
// ────────────────────────────────────────────────────────────
//
// The onboarding domain-pick step shows EVERY domain jargon plans to teach,
// including those that aren't shipped yet. Coming-soon entries appear as
// disabled cards with a "soon" badge so the user sees jargon's trajectory,
// not just what's available today.
//
// This is a DISPLAY-ONLY concept — these IDs are NOT in the strict `Domain`
// type union (which would force gate-7 Deno-side mirror updates for content
// that doesn't exist yet). The picker maps a chosen `id` back to the strict
// Domain type via `pickableDomain()` — coming-soon picks fall back to
// DEFAULT_DOMAIN.
//
// To promote a coming-soon option to a real domain:
//   1. Add it to the `Domain` type + DOMAIN_META in this file
//   2. Add Deno-side mirror entries (vocabulary/goals/paths)
//   3. Bump the migration that extends `terms.path` CHECK constraint
//   4. Flip the `status` from 'planned' to 'live' here
// Full playbook: MULTI-DOMAIN-EXTENSION.md

export type OnboardingDomainStatus = 'live' | 'soon';

export interface OnboardingDomainOption {
  /** Stable id — matches a Domain value when status === 'live'. */
  id: string;
  label: string;
  tagline: string;
  icon: { set: string; name: string };
  status: OnboardingDomainStatus;
  /**
   * Helper line shown under the tagline when status is 'soon'. Sets
   * expectation about WHEN — never gives a specific date (under-promise).
   * Examples: "registered, content in progress" · "queued behind ai".
   */
  soonNote?: string;
}

export const ONBOARDING_DOMAIN_OPTIONS: OnboardingDomainOption[] = [
  // Live — pickable today.
  {
    id: 'coding',
    label: 'coding',
    tagline: 'follow claude code; talk to engineers',
    icon: { set: 'ph', name: 'code' },
    status: 'live',
  },
  // B+1.16+: AI promoted from 'soon' to 'live'. Now seeded across ALL SIX
  // ai-* paths (foundations / tools / prompting / products / evaluation /
  // policy) — ~91 curated terms via cloud-migration-039..053 (+069, +083).
  // ai-policy was filled in cloud-migration-040 / 048 / 053.
  {
    id: 'ai',
    label: 'ai',
    tagline: 'speak fluent ai — in any room',
    icon: { set: 'ph', name: 'brain' },
    status: 'live',
  },
  // Coming soon — visible in the picker as disabled cards so first-time
  // users see what jargon is becoming, not just what's shipped today.
  {
    id: 'excel',
    label: 'excel',
    tagline: 'pivot tables to power query',
    icon: { set: 'ph', name: 'table' },
    status: 'soon',
    soonNote: 'queued behind ai',
  },
  {
    id: 'microsoft-365',
    label: 'microsoft 365',
    tagline: 'sharepoint, teams, the whole stack',
    icon: { set: 'ph', name: 'browsers' },
    status: 'soon',
    soonNote: 'after excel',
  },
  {
    id: 'power-platform',
    label: 'power platform',
    tagline: 'automate, model, deploy',
    icon: { set: 'ph', name: 'lightning' },
    status: 'soon',
    soonNote: 'after microsoft 365',
  },
];

/**
 * Resolve a picker selection (which can be any OnboardingDomainOption.id)
 * to a strict Domain. Coming-soon picks fall back to DEFAULT_DOMAIN —
 * the user is allowlisted into a working domain regardless of which card
 * they tapped, so the app never lands on an empty state.
 *
 * BLOCKER FIX (B+1.10): the previous version checked only `ALL_DOMAINS`
 * for membership, which let `'ai'` through (it IS in ALL_DOMAINS — registered
 * but content-empty per B+1.9). A user (or a gift sender pre-fill) writing
 * `active_domain = 'ai'` would land on a domain with no terms. The picker UI
 * blocks this via `isLiveDomainOption`, but `pickableDomain` is also called
 * from non-picker paths (gift wire, settings, future programmatic writes).
 * Now it consults ONBOARDING_DOMAIN_OPTIONS status as the source of truth:
 * only `'live'` IDs resolve to themselves; everything else (soon, unknown)
 * falls back to DEFAULT_DOMAIN.
 */
export function pickableDomain(id: string): Domain {
  const opt = ONBOARDING_DOMAIN_OPTIONS.find((o) => o.id === id);
  if (opt && opt.status === 'live' && (ALL_DOMAINS as string[]).includes(id)) {
    return id as Domain;
  }
  return DEFAULT_DOMAIN;
}

/** True if the option is a fully-shipped domain the user can actually pick. */
export function isLiveDomainOption(opt: OnboardingDomainOption): boolean {
  return opt.status === 'live';
}

/**
 * B+1.10 polish — resolve a domain option's icon URL given its picker state.
 * Lifts the per-state hex resolution OUT of React components (CLAUDE.md hard
 * rule: no inline hex). The muted tint is READ from the token package —
 * "mirror in lockstep" comments were exactly how the retired zinc 71717a
 * (hashless here on purpose: the retired-hex scanner matches raw #-literals)
 * outlived its 2026-07-28 retirement here. The violet pair stays literal on
 * purpose: accent-jargon (#C2410C) / accent-jargon-hi (#FB9A5B) are this
 * app's brand-locked per-app accent, not a shared system token.
 *
 * State semantics:
 *   - 'soon'      → text.dim.dark tint (the option is locked; matches text-muted)
 *   - 'selected'  → accent-jargon tint (this is the user's pick)
 *   - 'available' → accent-jargon-hi tint (live + unselected, hover-style)
 */
export type OnboardingIconState = 'soon' | 'selected' | 'available';

export function onboardingIconUrl(opt: OnboardingDomainOption, state: OnboardingIconState): string {
  const tint =
    state === 'soon'      ? colors.text.dim.dark // matches the text-muted class
    : state === 'selected' ? '#C2410C'  // accent-jargon (brand-locked)
    :                        '#FB9A5B'; // accent-jargon-hi (brand-locked)
  return iconUrl(opt.icon.set, opt.icon.name, tint);
}

// ────────────────────────────────────────────────────────────
// Lived-icons strip tone helper (B+1.11)
// ────────────────────────────────────────────────────────────
//
// Same pattern as onboardingIconUrl — keeps every Iconify hex resolution
// in this file (per project convention hard rule: no inline hex in components).
// The strip component takes a `tone` enum, calls this helper to get a URL
// per slug. Tones map to:
//   - 'accent'    → #C2410C  accent-jargon (UI-tone marker orange, brand-locked since 2026-11-03)
//   - 'accent-hi' → #FB9A5B  accent-jargon-hi (text-tone marker orange, brand-locked since 2026-11-03)
//   - 'muted'     → colors.text.dim.dark (matches the text-muted class)

export type LivedIconTone = 'accent' | 'accent-hi' | 'muted';

export function livedIconUrl(slug: string, tone: LivedIconTone): string {
  const tint =
    tone === 'accent'    ? '#C2410C'   // accent-jargon (brand-locked)
    : tone === 'accent-hi' ? '#FB9A5B' // accent-jargon-hi (brand-locked)
    :                        colors.text.dim.dark; // matches the text-muted class
  return iconUrl('ph', slug, tint);
}

// ────────────────────────────────────────────────────────────
// Job → Domain classifier (the "home_domain" picker — option C: hybrid
// with several options, user override)
// ────────────────────────────────────────────────────────────
//
// Goal: from the free-text `job` string the user types in onboarding
// Step 2, produce a RANKED list of every available Domain so the
// home-domain pick UI can show all options as cards with the top match
// highlighted. The user always sees the full grid + always overrides
// freely; the classifier just orders + suggests.
//
// Three-stage upgrade path:
//
//   STAGE 1 (today) — deterministic-only.
//     One Domain ('coding') exists. The classifier returns a single-
//     entry ranking and the picker UI degrades to nothing visible.
//
//   STAGE 2 (when 2+ domains exist) — keyword match against
//     DOMAIN_META.keywordHints. Each domain registers job titles /
//     industries / fields that point to it. The classifier scans the
//     lowercased job string for hints and scores each domain by hit
//     count. Zero-cost, runs client-side.
//
//   STAGE 3 (when keyword match is too brittle) — LLM classification
//     via a new `classify-domain` Edge Function (Haiku 4.5, ~$0.001/
//     call). Use as a TIE-BREAKER when keyword match returns 0 hits or
//     ties. Always present the user with all options for explicit pick.
//
// Returns: a non-empty array sorted by score descending. The first
// entry is the suggested top match (always exists, always defaults to
// DEFAULT_DOMAIN if nothing matches).

export interface DomainSuggestion {
  domain: Domain;
  /** 0..N hit count from keyword matches (today: always 0). */
  score: number;
  /** Whether this is the top suggestion the UI should highlight. */
  isTopSuggestion: boolean;
}

export interface ClassifyOptions {
  /** Override the registry — useful for tests. */
  registry?: Record<Domain, DomainMeta>;
}

/**
 * Convenience: just the single best-guess domain. Equivalent to
 * `classifyJobToDomains(job)[0].domain`.
 */
export function classifyJobToDomain(
  job: string | null | undefined,
  opts: ClassifyOptions = {},
): Domain {
  return classifyJobToDomains(job, opts)[0].domain;
}

/**
 * Returns every available domain ranked by how well it matches the job
 * string. Always returns a non-empty array — the worst case is a single
 * DEFAULT_DOMAIN entry. The picker UI iterates this array to render
 * cards in suggested-first order.
 */
export function classifyJobToDomains(
  job: string | null | undefined,
  _opts: ClassifyOptions = {},
): DomainSuggestion[] {
  // Stage 1: only one domain exists. Single-entry ranking.
  if (ALL_DOMAINS.length === 1) {
    return [{ domain: DEFAULT_DOMAIN, score: 0, isTopSuggestion: true }];
  }

  // Stage 1.5 (B+1.9): 2+ domains registered but no `keywordHints` field
  // on DomainMeta yet. Return ALL domains with DEFAULT_DOMAIN as the
  // top suggestion + the rest in registry order. The picker UI shows
  // them all as cards; the user always explicitly picks. When real
  // ranking signal arrives (keywordHints + LLM classifier — Stage 2 +
  // Stage 3), this branch grows scoring logic.
  const others = ALL_DOMAINS.filter((d) => d !== DEFAULT_DOMAIN);
  const ordered: Domain[] = [DEFAULT_DOMAIN, ...others];
  void job;
  return ordered.map((d, i) => ({
    domain: d,
    score: 0,
    isTopSuggestion: i === 0,
  }));
}
