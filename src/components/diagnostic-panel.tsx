// Settings → diagnostic panel.
//
// Surfaces post-deploy debugging info Kevin would otherwise have to dig out
// of the Supabase dashboard:
//   - Client-side PROMPT_VERSION (compare against what's deployed if a
//     personalization rendering looks stale)
//   - Active domain (today: 'coding'; future: lets Kevin verify the
//     domain-pick UI wrote what he expected)
//   - Allowlist status with `added_via` source
//   - End-to-end Edge Function plumbing test (one round trip to
//     check-allowlist with timing)
//   - Personalization stats (B+1.5.5): trailing-7d cost + status histogram +
//     last 5 personalize-term calls. Shows whether multi-pass is
//     converging on `cached` or whether it's hitting fallback paths
//     more than expected.
//
// Read-only — does not mutate any DB state. Safe to leave permanently in
// Settings; not gated behind a debug flag.

import { useEffect, useState } from 'react';
import {
  CURRENT_PROMPT_VERSION,
  checkAllowlist,
  fetchRecentPersonalizeStats,
  fetchRecentIngestionStats,
  fetchSpend30d,
  type PersonalizeStats,
  type IngestionStats,
  type SpendBreakdown30d,
} from '../lib/data';
import { asDomain, type Domain } from '../lib/domains';
import { useUserStore } from '../stores/user-store';
import { TranslatorBadge } from './translator-badge';

interface Props {
  /** Active domain (left side of the translator badge — what the user is learning). */
  activeDomain: Domain;
  /** Home domain (right side of the translator badge — the user's day job). */
  homeDomain: Domain;
}

type PingStatus =
  | { kind: 'idle' }
  | { kind: 'pinging' }
  | { kind: 'ok'; latencyMs: number; allowed: boolean; allowedVia: string | null }
  | { kind: 'error'; message: string };

type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'error'; message: string };

/**
 * B+1.13 — extract a human-readable message from any thrown value.
 * Supabase's PostgrestError is NOT an Error instance — it's a plain object
 * with `.message`, `.code`, `.details`, `.hint`. The previous catch logic
 * (`err instanceof Error ? err.message : String(err)`) fell through to
 * `String(err)` for those, producing the visible "[object Object]" on the
 * /settings diagnostic panel. This helper handles all the common throw
 * shapes: real Errors, PostgrestError-like objects, plain strings, and
 * anything else (last-resort String()).
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.length > 0) return o.message;
    if (typeof o.error === 'string' && o.error.length > 0) return o.error;
    if (typeof o.code === 'string' && o.code.length > 0) return `error code ${o.code}`;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

type StatsState = LoadState<PersonalizeStats>;
type IngestState = LoadState<IngestionStats>;
type SpendState = LoadState<SpendBreakdown30d>;

export function DiagnosticPanel({ activeDomain, homeDomain }: Props) {
  const [status, setStatus] = useState<PingStatus>({ kind: 'idle' });
  const [stats, setStats] = useState<StatsState>({ kind: 'loading' });
  const [ingest, setIngest] = useState<IngestState>({ kind: 'loading' });
  const [spend, setSpend] = useState<SpendState>({ kind: 'loading' });
  const user = useUserStore((s) => s.user);

  // Fetch all three diagnostic data sources on mount. Each is independent
  // — a failure in one doesn't block the others. Empty state and error
  // state both render inline.
  //
  // B+1.5.8 (audit fix): on sign-out (`user === null`), explicitly reset
  // all three states back to `loading` instead of just bailing early.
  // Without this reset, a second user signing in on the same tab — or
  // gift-recipient flow on a shared device — would briefly see the
  // previous user's stats while the new fetches were in flight.
  useEffect(() => {
    if (!user) {
      setStats({ kind: 'loading' });
      setIngest({ kind: 'loading' });
      setSpend({ kind: 'loading' });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchRecentPersonalizeStats(user.id);
        if (!cancelled) setStats({ kind: 'ready', data });
      } catch (err) {
        if (!cancelled) {
          setStats({
            kind: 'error',
            message: extractErrorMessage(err),
          });
        }
      }
    })();
    void (async () => {
      try {
        const data = await fetchRecentIngestionStats();
        if (!cancelled) setIngest({ kind: 'ready', data });
      } catch (err) {
        if (!cancelled) {
          setIngest({
            kind: 'error',
            message: extractErrorMessage(err),
          });
        }
      }
    })();
    void (async () => {
      try {
        const data = await fetchSpend30d(user.id);
        if (!cancelled) setSpend({ kind: 'ready', data });
      } catch (err) {
        if (!cancelled) {
          setSpend({
            kind: 'error',
            message: extractErrorMessage(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function pingEdge() {
    setStatus({ kind: 'pinging' });
    const start = performance.now();
    try {
      const res = await checkAllowlist();
      const latencyMs = Math.round(performance.now() - start);
      setStatus({
        kind: 'ok',
        latencyMs,
        allowed: res.allowed,
        allowedVia: res.allowed_via,
      });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden">
      <DiagRow label="prompt version" value={String(CURRENT_PROMPT_VERSION)} />
      <DiagTranslatorRow
        label="translator"
        active={asDomain(activeDomain)}
        home={asDomain(homeDomain)}
      />

      <div className="px-4 py-3 border-t border-border-default">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">edge function ping</p>
            <p className="text-xs text-text-muted mt-1">
              calls check-allowlist; verifies auth + cors + reachability.
            </p>
          </div>
          <button
            type="button"
            onClick={pingEdge}
            disabled={status.kind === 'pinging'}
            className="bg-accent-jargon text-text-primary text-sm font-medium rounded-md px-3 py-2 min-h-[44px] active:bg-accent-jargon-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon disabled:opacity-60 transition-colors shrink-0"
          >
            {status.kind === 'pinging' ? 'pinging…' : 'ping'}
          </button>
        </div>

        {status.kind === 'ok' && (
          <div role="status" aria-live="polite" className="mt-3 px-3 py-2 bg-bg-base border border-border-default rounded-md">
            <p className="text-xs font-mono text-text-secondary">
              <span className="text-accent-jargon-hi">✓</span>{' '}
              {status.latencyMs}ms · allowed={String(status.allowed)}
              {status.allowedVia && ` · via ${status.allowedVia}`}
            </p>
          </div>
        )}

        {status.kind === 'error' && (
          <div role="status" aria-live="polite" className="mt-3 px-3 py-2 bg-bg-base border border-border-default rounded-md">
            <p className="text-xs font-mono text-text-secondary break-all">
              <span className="text-accent-jargon-hi">✗</span> {status.message}
            </p>
          </div>
        )}
      </div>

      <Spend30dSection spend={spend} />
      <PersonalizationStatsSection stats={stats} />
      <IngestionStatsSection ingest={ingest} />
    </div>
  );
}

function Spend30dSection({ spend }: { spend: SpendState }) {
  return (
    <div className="px-4 py-3 border-t border-border-default">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text-primary">spending (last 30d)</p>
        {spend.kind === 'ready' && (
          <p className="text-base font-mono text-text-primary">
            ${spend.data.totalUsd.toFixed(2)}
          </p>
        )}
      </div>

      {spend.kind === 'loading' && <p className="text-xs text-text-muted">loading…</p>}

      {spend.kind === 'error' && (
        <p className="text-xs font-mono text-text-secondary break-all">
          <span className="text-accent-jargon-hi">✗</span> {spend.message}
        </p>
      )}

      {spend.kind === 'ready' && (
        <ul className="space-y-1">
          <SpendRow label="personalize" usd={spend.data.personalizeUsd} />
          <SpendRow label="job-followup" usd={spend.data.jobFollowupUsd} />
          <SpendRow label="ingestion" usd={spend.data.ingestionUsd} />
        </ul>
      )}

      {spend.kind === 'ready' && spend.data.totalUsd >= 50 && (
        <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi mt-2">
          ▸ over $50/mo — revisit multi-pass economics per spec §10.1
        </p>
      )}
    </div>
  );
}

function SpendRow({ label, usd }: { label: string; usd: number }) {
  return (
    <li className="flex items-center justify-between">
      <p className="text-2xs font-mono uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="text-2xs font-mono text-text-muted">${usd.toFixed(4)}</p>
    </li>
  );
}

// Days since the most recent ingest cycle, used to surface a "cron may
// be broken" warning. Default cadence per spec §6.1 is weekly, so >14d
// = roughly 2 missed cycles. Returns null when there are zero cycles
// (which itself triggers the warning via the histogram empty-state).
//
// Exported for vitest — the threshold logic is value-dense enough that
// asserting it directly beats rendering-and-querying the component.
export function daysSinceLastCycle(recent: IngestionStats['recent']): number | null {
  if (recent.length === 0) return null;
  const latest = new Date(recent[0].created_at).getTime();
  if (Number.isNaN(latest)) return null;
  return Math.floor((Date.now() - latest) / (24 * 60 * 60 * 1000));
}

export const STALE_CYCLE_DAYS = 14;

// Acceptance rate from the 7d histogram. Returns null when there's no
// data. The rate is `inserted / (inserted + rejected)` — a quick one-
// glance signal. If this crashes from ~80% to ~20% week-over-week,
// something changed (prompt drift, model regression, dedupe getting
// aggressive). Violet warning fires below ACCEPTANCE_LOW_PCT.
export const ACCEPTANCE_LOW_PCT = 50;

export function acceptanceRate(histogram: Record<string, number>): {
  pct: number;
  inserted: number;
  total: number;
} | null {
  const inserted = histogram['inserted'] ?? 0;
  const rejected = histogram['rejected'] ?? 0;
  const total = inserted + rejected;
  if (total === 0) return null;
  return { pct: Math.round((inserted / total) * 100), inserted, total };
}

function IngestionStatsSection({ ingest }: { ingest: IngestState }) {
  const staleDays =
    ingest.kind === 'ready' ? daysSinceLastCycle(ingest.data.recent) : null;
  const isStale = staleDays !== null && staleDays > STALE_CYCLE_DAYS;
  const hasNoCycles =
    ingest.kind === 'ready' && ingest.data.recent.length === 0;
  const acceptance =
    ingest.kind === 'ready' ? acceptanceRate(ingest.data.histogram7d) : null;
  const lowAcceptance = acceptance !== null && acceptance.pct < ACCEPTANCE_LOW_PCT;

  return (
    <div className="px-4 py-3 border-t border-border-default">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text-primary">ingestion (last 7d)</p>
        {ingest.kind === 'ready' && (
          <div className="flex items-center gap-3">
            {acceptance && (
              <p
                className={`text-sm font-mono ${
                  lowAcceptance ? 'text-accent-jargon-hi' : 'text-text-secondary'
                }`}
                title={`${acceptance.inserted} of ${acceptance.total} candidates accepted`}
              >
                {acceptance.pct}%
              </p>
            )}
            <p className="text-sm font-mono text-text-secondary">
              ${ingest.data.totalCost7dUsd.toFixed(4)}
            </p>
          </div>
        )}
      </div>

      {ingest.kind === 'loading' && <p className="text-xs text-text-muted">loading…</p>}

      {ingest.kind === 'error' && (
        <p className="text-xs font-mono text-text-secondary break-all">
          <span className="text-accent-jargon-hi">✗</span> {ingest.message}
        </p>
      )}

      {/* Cron health warning: surfaces dead-cron AND no-cycles-ever scenarios.
          Default cadence is weekly per spec §6.1; >14d = roughly 2 missed
          cycles. Renders in violet so it sticks out from the rest of the
          neutral diagnostic copy. */}
      {ingest.kind === 'ready' && hasNoCycles && (
        <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi mb-2">
          ▸ no ingest cycle has ever run — check the weekly cron is wired
        </p>
      )}
      {ingest.kind === 'ready' && isStale && (
        <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi mb-2">
          ▸ last cycle was {staleDays}d ago — cron may be broken
        </p>
      )}
      {ingest.kind === 'ready' && lowAcceptance && (
        <p className="text-2xs font-mono uppercase tracking-wider text-accent-jargon-hi mb-2">
          ▸ {acceptance.pct}% acceptance — verify prompts haven't drifted
        </p>
      )}

      {ingest.kind === 'ready' && Object.keys(ingest.data.histogram7d).length === 0 && !hasNoCycles && (
        <p className="text-xs text-text-muted">quiet week. no ingest cycles in the last 7 days.</p>
      )}

      {ingest.kind === 'ready' && Object.keys(ingest.data.histogram7d).length > 0 && (
        <>
          <StatusHistogram histogram={ingest.data.histogram7d} happyKey="inserted" />
          {ingest.data.recent.length > 0 && (
            <div className="mt-3 border-t border-border-default pt-3">
              <p className="text-xs uppercase tracking-wider text-text-muted mb-2">
                last {ingest.data.recent.length}
              </p>
              <ul className="space-y-1.5">
                {ingest.data.recent.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3">
                    <p className="text-xs font-mono text-text-primary truncate flex-1 min-w-0">
                      {row.failure_pass ?? row.final_status}
                    </p>
                    <p
                      className={`text-2xs font-mono uppercase tracking-wider shrink-0 ${
                        row.final_status === 'inserted'
                          ? 'text-accent-jargon-hi'
                          : 'text-text-muted'
                      }`}
                    >
                      {row.final_status}
                    </p>
                    <p className="text-2xs font-mono text-text-muted shrink-0 w-16 text-right">
                      {row.total_cost_usd ? `$${row.total_cost_usd.toFixed(4)}` : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PersonalizationStatsSection({ stats }: { stats: StatsState }) {
  return (
    <div className="px-4 py-3 border-t border-border-default">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text-primary">personalization (last 7d)</p>
        {stats.kind === 'ready' && (
          <p className="text-sm font-mono text-text-secondary">
            ${stats.data.totalCost7dUsd.toFixed(4)}
          </p>
        )}
      </div>

      {stats.kind === 'loading' && (
        <p className="text-xs text-text-muted">loading…</p>
      )}

      {stats.kind === 'error' && (
        <p className="text-xs font-mono text-text-secondary break-all">
          <span className="text-accent-jargon-hi">✗</span> {stats.message}
        </p>
      )}

      {stats.kind === 'ready' && Object.keys(stats.data.histogram7d).length === 0 && (
        <p className="text-xs text-text-muted">no personalize calls yet. open a term to fire one.</p>
      )}

      {stats.kind === 'ready' && Object.keys(stats.data.histogram7d).length > 0 && (
        <>
          <StatusHistogram histogram={stats.data.histogram7d} />
          {stats.data.recent.length > 0 && (
            <div className="mt-3 border-t border-border-default pt-3">
              <p className="text-xs uppercase tracking-wider text-text-muted mb-2">
                last {stats.data.recent.length}
              </p>
              <ul className="space-y-1.5">
                {stats.data.recent.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3">
                    <p className="text-xs font-mono text-text-primary truncate flex-1 min-w-0">
                      {row.term_id}
                    </p>
                    <p
                      className={`text-2xs font-mono uppercase tracking-wider shrink-0 ${
                        row.final_status === 'cached'
                          ? 'text-accent-jargon-hi'
                          : 'text-text-muted'
                      }`}
                    >
                      {row.final_status}
                    </p>
                    <p className="text-2xs font-mono text-text-muted shrink-0 w-12 text-right">
                      {row.total_latency_ms ? `${row.total_latency_ms}ms` : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusHistogram({
  histogram,
  happyKey = 'cached',
}: {
  histogram: Record<string, number>;
  /** Which status counts as the "happy path" — gets the violet bar.
   *  Defaults to `'cached'` (personalize); `'inserted'` for ingestion. */
  happyKey?: string;
}) {
  // Sort by count descending so the dominant statuses lead. The happy
  // status gets violet treatment; everything else is muted to make
  // deviation visually obvious.
  const entries = Object.entries(histogram).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <ul className="space-y-1">
      {entries.map(([status, count]) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        const isHappy = status === happyKey;
        return (
          <li key={status} className="flex items-center gap-3" aria-label={`${status}: ${count} (${Math.round(pct)}%)`}>
            <p
              className={`text-2xs font-mono uppercase tracking-wider w-44 shrink-0 truncate ${
                isHappy ? 'text-accent-jargon-hi' : 'text-text-secondary'
              }`}
              title={status}
            >
              {status}
            </p>
            <div className="flex-1 min-w-0 h-1.5 bg-bg-base rounded-full overflow-hidden">
              <div
                className={isHappy ? 'bg-accent-jargon h-full' : 'bg-text-muted h-full'}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-2xs font-mono text-text-muted w-8 text-right shrink-0">
              {count}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between border-t border-border-default first:border-t-0 min-h-[56px]">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-sm font-mono text-text-secondary">{value}</p>
    </div>
  );
}

function DiagTranslatorRow({
  label,
  active,
  home,
}: {
  label: string;
  active: Domain;
  home: Domain;
}) {
  // Identity case (active === home): show one icon + the domain name.
  // Bridge case: show the badge `[active] → [home]` followed by a small
  // text label so the row reads "translator   coding → pharmacy".
  const sameDomain = active === home;
  return (
    <div className="px-4 py-3 flex items-center justify-between border-t border-border-default first:border-t-0 min-h-[56px]">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <div className="flex items-center gap-2">
        <TranslatorBadge active={active} home={home} size={20} tone="accent-hi" />
        <p className="text-sm font-mono text-text-secondary">
          {sameDomain ? active : `${active} → ${home}`}
        </p>
      </div>
    </div>
  );
}
