// Shared AI spend guard for Jargon edge functions (T1 spend cap).
//
// Before an AI/model call, check this calendar month's spend — the caller's and
// the global total — against configurable USD ceilings. Over-cap => the handler
// returns its EXISTING canonical fallback (partial credit / ok:false) instead of
// calling the model. Reads already-logged cost via the `ai_spend_month` RPC; adds
// no new write path.
//
// Caps come from env so they can change without redeploying logic:
//   JARGON_SPEND_CAP_USER_USD   (default 5)
//   JARGON_SPEND_CAP_GLOBAL_USD (default 50)
//
// FAILURE POSTURE — split by cap, fixed 2026-08-17:
//
//   GLOBAL cap  → FAIL CLOSED. This used to fail open, which meant a broken
//     `ai_spend_month` query returned `allowed: true` and the $50 backstop
//     evaporated in exactly the failure mode it exists for. If we cannot read
//     the global total we cannot prove we're under the ceiling, so we deny.
//     Handlers already answer a denial with their canonical fallback (partial
//     credit / ok:false), so this degrades the feature — it doesn't 500.
//
//   PER-USER cap → FAIL OPEN. If the global total is readable and under the
//     ceiling but this one user's figure is unusable, allow the call. One bad
//     row must not lock out everyone, and the global backstop above already
//     bounds the blast radius.
//
// SERVICE-ROLE / ADMIN EXEMPTION: pass { exempt: true } for cron / bulk-backfill
// callers (ingest-terms, the etymology backfill) so a batch job can't be capped
// mid-run. Pass userId = null for calls with no attributable user (global-only).
// Exempt callers short-circuit before the query, so the fail-closed rule above
// can never wedge a batch job.

// deno-lint-ignore-file no-explicit-any

export interface SpendCheck {
  allowed: boolean;
  scope:
    | 'ok'
    | 'user-cap'
    | 'global-cap'
    | 'exempt'
    // The global total was unreadable — denied rather than assumed-zero.
    | 'error-failclosed'
    // Global total fine; only this user's figure was unreadable — allowed.
    | 'user-cap-unknown-failopen';
  userMonthUsd: number;
  globalMonthUsd: number;
  userCapUsd: number;
  globalCapUsd: number;
}

function envNum(name: string, dflt: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return dflt;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

/**
 * Read a USD figure off the rpc row, returning null for "no usable reading".
 *
 * Deliberately NOT `Number(v ?? 0)`: `Number(null)` is 0, so a null total would
 * read as "$0 spent, plenty of headroom" — the same assume-the-best failure the
 * fail-closed rule exists to remove. Postgres `numeric` arrives as either a JSON
 * number or a string depending on the serializer, so both are accepted.
 */
function readUsd(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Check whether an AI call is within the monthly spend caps.
 *
 * @param serviceClient a supabase client made with SUPABASE_SERVICE_ROLE_KEY
 * @param userId        the calling user's id, or null for global-only attribution
 * @param opts.exempt   true for cron/backfill callers (skips the check entirely)
 */
export async function checkSpend(
  serviceClient: any,
  userId: string | null,
  opts?: { exempt?: boolean },
): Promise<SpendCheck> {
  const userCapUsd = envNum('JARGON_SPEND_CAP_USER_USD', 5);
  const globalCapUsd = envNum('JARGON_SPEND_CAP_GLOBAL_USD', 50);

  if (opts?.exempt) {
    return { allowed: true, scope: 'exempt', userMonthUsd: 0, globalMonthUsd: 0, userCapUsd, globalCapUsd };
  }

  const denyUnverifiable = (why: string): SpendCheck => {
    console.error(`[spend-guard] ${why} — failing CLOSED on the global cap`);
    return {
      allowed: false,
      scope: 'error-failclosed',
      userMonthUsd: 0,
      globalMonthUsd: 0,
      userCapUsd,
      globalCapUsd,
    };
  };

  try {
    const { data, error } = await serviceClient.rpc('ai_spend_month', { p_user_id: userId });
    if (error) {
      return denyUnverifiable(`ai_spend_month failed: ${error.message}`);
    }
    const row = Array.isArray(data) ? data[0] : data;

    // The global figure gates everything — no usable reading means no proof
    // we're under the ceiling, so deny.
    const globalMonthUsd = readUsd(row?.global_month_usd);
    if (globalMonthUsd === null) {
      return denyUnverifiable('ai_spend_month returned no usable global_month_usd');
    }

    const userMonthUsd = readUsd(row?.user_month_usd);

    // Global backstop first — protects against runaway spend regardless of who.
    if (globalMonthUsd >= globalCapUsd) {
      return {
        allowed: false,
        scope: 'global-cap',
        userMonthUsd: userMonthUsd ?? 0,
        globalMonthUsd,
        userCapUsd,
        globalCapUsd,
      };
    }

    // Per-user cap: fail OPEN. We are provably under the global ceiling at this
    // point, so an unreadable per-user figure costs at most the remaining global
    // headroom — cheaper than locking every user out over one bad row.
    if (userMonthUsd === null) {
      return {
        allowed: true,
        scope: 'user-cap-unknown-failopen',
        userMonthUsd: 0,
        globalMonthUsd,
        userCapUsd,
        globalCapUsd,
      };
    }

    if (userId && userMonthUsd >= userCapUsd) {
      return {
        allowed: false,
        scope: 'user-cap',
        userMonthUsd,
        globalMonthUsd,
        userCapUsd,
        globalCapUsd,
      };
    }
    return {
      allowed: true,
      scope: 'ok',
      userMonthUsd,
      globalMonthUsd,
      userCapUsd,
      globalCapUsd,
    };
  } catch (e) {
    return denyUnverifiable(`ai_spend_month threw: ${(e as Error).message}`);
  }
}
