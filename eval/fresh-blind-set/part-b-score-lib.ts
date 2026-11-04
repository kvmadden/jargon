// Part B scoring: turns saved verifier results into the rates the spec asks for. Pure logic, no file or network
// access, so the tests run offline on made-up fixtures. The command line wrapper is score-part-b.ts.
//
// The rules are in RUN-PLAN.md, section 3:
// - A rendering is "stopped by the verifier alone" when its call failed, hit the token cap, was refused, or gave a
//   verdict that cannot be read, or when the verdict's overall result is fail.
// - It is "stopped with the gate" when the verifier alone stops it, or the claim gate returns needs_review or
//   revise for the verifier's analogy flag, claims and canonical concerns.
// - Every rate is k of n with a 95 percent Wilson interval.

import { classifyResultLine, parseResultsText, replyText, type ResultLine } from './part-b-lib.ts';

export const GOLD_LABELS = ['correct', 'wrong-introduced', 'wrong-inherited', 'unsupported'] as const;
export type GoldLabel = (typeof GOLD_LABELS)[number];

export interface ScoredRendering {
  id: string;
  gold: GoldLabel;
  kind: string;
  term_id: string;
  profile_id: string;
  domain?: string;
}

export interface TermInfo {
  id: string;
  difficulty?: number;
}

export type Wilson = (k: number, n: number) => [number, number];

export interface Rate {
  k: number;
  n: number;
  rate: number | null;
  lo: number | null;
  hi: number | null;
}

export function rateOf(k: number, n: number, wilson: Wilson): Rate {
  if (n === 0) return { k, n, rate: null, lo: null, hi: null };
  const [lo, hi] = wilson(k, n);
  return { k, n, rate: k / n, lo, hi };
}

/** The verdict fields the gate reads, as the pipeline's reply reader returns them. */
export interface ReadVerdict {
  overall: 'pass' | 'fail';
  uses_analogy: boolean;
  domain_claims: unknown[];
  canonical_concerns: string[];
}

export type StopReason = 'no_result' | 'failed' | 'truncated' | 'refused' | 'unparseable' | 'verdict_fail' | 'pass';

export interface VerifierOutcome {
  stopped: boolean;
  reason: StopReason;
  verdict: ReadVerdict | null;
}

/** The newest result for every rendering. A resent request replaces the earlier result. */
export function newestResults(texts: string[]): Map<string, ResultLine> {
  const last = new Map<string, ResultLine>();
  for (const text of texts) for (const line of parseResultsText(text)) last.set(line.custom_id, line);
  return last;
}

export function verifierOutcome(line: ResultLine | undefined, readVerdict: (raw: string) => ReadVerdict | null): VerifierOutcome {
  if (!line) return { stopped: true, reason: 'no_result', verdict: null };
  const klass = classifyResultLine(line);
  if (klass === 'truncated') return { stopped: true, reason: 'truncated', verdict: null };
  if (klass === 'refused') return { stopped: true, reason: 'refused', verdict: null };
  if (klass !== 'succeeded') return { stopped: true, reason: 'failed', verdict: null };
  const verdict = readVerdict(replyText(line));
  if (!verdict) return { stopped: true, reason: 'unparseable', verdict: null };
  if (verdict.overall !== 'pass') return { stopped: true, reason: 'verdict_fail', verdict };
  return { stopped: false, reason: 'pass', verdict };
}

export type GateDecision = 'pass' | 'needs_review' | 'revise';

export interface RowOutcome {
  row: ScoredRendering;
  verifier: VerifierOutcome;
  /** One decision per gate version, or null when there was no readable verdict to give the gate. */
  gates: Record<string, GateDecision | null>;
}

export const ARM_ALONE = 'verifier_alone';
export const armWithGate = (gate: string) => `verifier_plus_${gate}`;

export function stoppedIn(o: RowOutcome, arm: string): boolean {
  if (arm === ARM_ALONE) return o.verifier.stopped;
  const gate = arm.slice('verifier_plus_'.length);
  if (o.verifier.stopped) return true;
  const d = o.gates[gate];
  return d == null ? true : d !== 'pass';
}

const isWrong = (g: GoldLabel) => g !== 'correct';

function countStopped(outcomes: RowOutcome[], arm: string, wilson: Wilson): Rate {
  return rateOf(outcomes.filter((o) => stoppedIn(o, arm)).length, outcomes.length, wilson);
}

export interface ArmReport {
  wrong_stopped: Rate;
  correct_stopped: Rate;
  unsupported_stopped: Rate;
  correct_field_analogy_stopped: Rate;
  by_gold: Record<string, Rate>;
  by_kind: Record<string, Rate & { gold_counts: Record<string, number> }>;
  by_profile: Record<string, { wrong_stopped: Rate; correct_stopped: Rate }>;
  by_difficulty: Record<string, { wrong_stopped: Rate; correct_stopped: Rate }>;
  by_domain: Record<string, { wrong_stopped: Rate; correct_stopped: Rate }>;
  stopped_only_by_the_gate: number;
}

export function armReport(outcomes: RowOutcome[], arm: string, terms: Map<string, TermInfo>, wilson: Wilson): ArmReport {
  const wrong = outcomes.filter((o) => isWrong(o.row.gold));
  const correct = outcomes.filter((o) => !isWrong(o.row.gold));
  const group = (key: (o: RowOutcome) => string) => {
    const keys = [...new Set(outcomes.map(key))].sort();
    return Object.fromEntries(keys.map((k) => {
      const inGroup = outcomes.filter((o) => key(o) === k);
      return [k, { wrong_stopped: countStopped(inGroup.filter((o) => isWrong(o.row.gold)), arm, wilson), correct_stopped: countStopped(inGroup.filter((o) => !isWrong(o.row.gold)), arm, wilson) }];
    }));
  };
  const kinds = [...new Set(outcomes.map((o) => o.row.kind))].sort();
  return {
    wrong_stopped: countStopped(wrong, arm, wilson),
    correct_stopped: countStopped(correct, arm, wilson),
    unsupported_stopped: countStopped(outcomes.filter((o) => o.row.gold === 'unsupported'), arm, wilson),
    correct_field_analogy_stopped: countStopped(outcomes.filter((o) => o.row.kind === 'correct_field_analogy' && !isWrong(o.row.gold)), arm, wilson),
    by_gold: Object.fromEntries(GOLD_LABELS.map((g) => [g, countStopped(outcomes.filter((o) => o.row.gold === g), arm, wilson)])),
    by_kind: Object.fromEntries(kinds.map((k) => {
      const inKind = outcomes.filter((o) => o.row.kind === k);
      const gold_counts: Record<string, number> = {};
      for (const o of inKind) gold_counts[o.row.gold] = (gold_counts[o.row.gold] ?? 0) + 1;
      return [k, { ...countStopped(inKind, arm, wilson), gold_counts }];
    })),
    by_profile: group((o) => o.row.profile_id),
    by_difficulty: group((o) => String(terms.get(o.row.term_id)?.difficulty ?? 'unknown')),
    by_domain: group((o) => o.row.domain ?? 'unknown'),
    stopped_only_by_the_gate: arm === ARM_ALONE ? 0 : outcomes.filter((o) => stoppedIn(o, arm) && !o.verifier.stopped).length,
  };
}

export interface PartBReport {
  renderings: number;
  gold_counts: Record<string, number>;
  overrides_applied: number;
  verifier_outcomes: Record<StopReason, number>;
  arms: Record<string, ArmReport>;
}

export function scorePartB(args: {
  rows: ScoredRendering[];
  overrides: Record<string, string>;
  results: Map<string, ResultLine>;
  terms: Map<string, TermInfo>;
  readVerdict: (raw: string) => ReadVerdict | null;
  /** Gate versions by name. Each is called only for a rendering whose verdict could be read. */
  gates: Record<string, (row: ScoredRendering, verdict: ReadVerdict) => GateDecision>;
  wilson: Wilson;
}): { report: PartBReport; outcomes: RowOutcome[] } {
  const { overrides, results, terms, readVerdict, gates, wilson } = args;
  for (const [id, label] of Object.entries(overrides)) {
    if (!GOLD_LABELS.includes(label as GoldLabel)) throw new Error(`override for ${id} names a label that does not exist`);
    if (!args.rows.some((r) => r.id === id)) throw new Error(`override names ${id}, which is not a rendering in the set`);
  }
  const rows = args.rows.map((r) => (overrides[r.id] ? { ...r, gold: overrides[r.id] as GoldLabel } : r));
  const outcomes: RowOutcome[] = rows.map((row) => {
    const verifier = verifierOutcome(results.get(row.id), readVerdict);
    const decided: Record<string, GateDecision | null> = {};
    for (const [name, gate] of Object.entries(gates)) decided[name] = verifier.verdict ? gate(row, verifier.verdict) : null;
    return { row, verifier, gates: decided };
  });
  const verifier_outcomes: Record<StopReason, number> = { no_result: 0, failed: 0, truncated: 0, refused: 0, unparseable: 0, verdict_fail: 0, pass: 0 };
  for (const o of outcomes) verifier_outcomes[o.verifier.reason] += 1;
  const gold_counts: Record<string, number> = {};
  for (const r of rows) gold_counts[r.gold] = (gold_counts[r.gold] ?? 0) + 1;
  const arms = [ARM_ALONE, ...Object.keys(gates).map(armWithGate)];
  return {
    outcomes,
    report: {
      renderings: rows.length,
      gold_counts,
      overrides_applied: Object.keys(overrides).filter((id) => args.rows.find((r) => r.id === id)?.gold !== overrides[id]).length,
      verifier_outcomes,
      arms: Object.fromEntries(arms.map((a) => [a, armReport(outcomes, a, terms, wilson)])),
    },
  };
}

const pct = (x: number | null) => (x == null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
export const formatRate = (r: Rate) => `${r.k} of ${r.n} (${pct(r.rate)}, 95% CI ${pct(r.lo)} to ${pct(r.hi)})`;

/** A readable table of the headline rates, one row per arm. */
export function summaryMarkdown(report: PartBReport): string {
  const lines = [
    '# Part B results',
    '',
    `${report.renderings} renderings. Gold: ${Object.entries(report.gold_counts).map(([k, v]) => `${k} ${v}`).join(', ')}. Gold labels changed by review: ${report.overrides_applied}.`,
    '',
    `Verifier outcomes: ${Object.entries(report.verifier_outcomes).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    '',
    '| Arm | Wrong stopped | Correct stopped | Unsupported stopped | Correct field analogies stopped | Stopped only by the gate |',
    '|---|---|---|---|---|---|',
    ...Object.entries(report.arms).map(([arm, a]) => `| ${arm} | ${formatRate(a.wrong_stopped)} | ${formatRate(a.correct_stopped)} | ${formatRate(a.unsupported_stopped)} | ${formatRate(a.correct_field_analogy_stopped)} | ${a.stopped_only_by_the_gate} |`),
    '',
  ];
  for (const [arm, a] of Object.entries(report.arms)) {
    lines.push(`## ${arm}: by kind`, '', '| Kind | Stopped | Gold |', '|---|---|---|');
    for (const [kind, r] of Object.entries(a.by_kind)) lines.push(`| ${kind} | ${formatRate(r)} | ${Object.entries(r.gold_counts).map(([g, n]) => `${g} ${n}`).join(', ')} |`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}
