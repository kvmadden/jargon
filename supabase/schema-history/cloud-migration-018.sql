-- jargon Stage B+1.5 — multi-domain readiness (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: terms.domain + user_profile.active_domain (both default 'coding')
-- Adds: idx_terms_domain + idx_terms_domain_path (forward-looking)
-- Depends on: cloud-migration-001 (terms table) + cloud-migration-004 (user_profile)
--
-- WHY THIS EXISTS:
--   The original spec hardcoded jargon as a coding-only learning game. The
--   long-term vision (per CLAUDE.md + decision log) is multi-domain — the owner
--   wants to teach pharmacy → engineering, engineering → law, etc. Adding
--   the `domain` discriminator NOW (before any second domain exists) lets
--   us avoid a painful rewrite later. Single existing domain is 'coding'.
--
-- WHAT'S DELIBERATELY *NOT* IN THIS MIGRATION:
--   - No CHECK constraint on `domain` values. We don't know the future
--     domain enum yet, and a CHECK would have to be ALTERed every time we
--     added one. The application layer (src/lib/domains.ts) is the
--     enforcement point.
--   - No `domains` lookup table. Single source of truth lives in
--     `src/lib/domains.ts` for now. Lookup table is the right move once
--     domains have rich metadata (theme color, ingestion source URLs, etc.)
--     — defer to the actual second-domain ship.
--   - No changes to the path CHECK constraint. All 7 existing paths
--     ('git-cli', 'dev-concepts', etc.) remain coding-domain paths. When
--     a second domain ships, that migration will:
--       1) Drop the CHECK
--       2) Add new paths for the new domain
--       3) Re-create the CHECK with the union of old + new paths
--     See MULTI-DOMAIN-EXTENSION.md for the playbook.
--
-- BACKFILL:
--   Both columns are NOT NULL with default 'coding'. Postgres backfills
--   existing rows automatically. Safe to apply on a populated DB.

-- ────────────────────────────────────────────────────────────
-- 1) terms.domain — discriminator on the canonical dictionary
-- ────────────────────────────────────────────────────────────
alter table terms
  add column if not exists domain text not null default 'coding';

-- Indexes anticipate the multi-domain query shape: filter-by-domain when
-- the user is in coding mode, filter-by-(domain, path) when navigating to
-- a specific path within the active domain. Cheap to add now; expensive
-- to add later under a populated table.
create index if not exists idx_terms_domain
  on terms(domain);
create index if not exists idx_terms_domain_path
  on terms(domain, path);

-- ────────────────────────────────────────────────────────────
-- 2) user_profile.active_domain — which domain the user is learning
-- ────────────────────────────────────────────────────────────
-- Default 'coding' so existing users (the owner) stay on the current dictionary
-- with no behavior change. When the second domain ships, the onboarding
-- wizard adds a domain-pick step and writes to this column.
alter table user_profile
  add column if not exists active_domain text not null default 'coding';

-- ────────────────────────────────────────────────────────────
-- 3) Compatibility note — bump_profile_version_if_changed trigger
-- ────────────────────────────────────────────────────────────
-- The trigger from cloud-migration-004 originally didn't include
-- active_domain in its "did anything change" check. UPDATE (B+1.5.1):
-- cloud-migration-020 now extends the trigger to watch active_domain
-- AND home_domain (added in 019). No follow-up needed at second-domain
-- ship time — apply 020 alongside 018/019 and the trigger is correct.
-- See MULTI-DOMAIN-EXTENSION.md §4 for the full lazy-invalidation flow.
