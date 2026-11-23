// Build the 50-item gold set for verifier v2 from the saved 2026-10-30 run.
//
//   node eval/verifier-v2/build-gold.mjs
//
// Writes eval/verifier-v2/gold/items.json (explanation text and context only).
// Labels live in gold/confirm.json, written by hand, so the selection below
// never depends on a label. The selection is deterministic: re-running it on
// the same inputs gives the same 50 items in the same order.
//
// Selection, in priority order (an item counts once, under its first group):
//   A. confirmed-miss    The 5 accepted outputs Kevin Madden, PharmD, confirmed
//                        wrong (eval/results/2026-10-30-review.json, 2026-10-30).
//   B. reported-correct  The 7 outputs recorded as judged correct by Kevin on
//                        2026-11-01 on the unmerged PR #1 branch
//                        (eval/data/expert-adjudication-2026-11-01.json there).
//   C. borderline        The reviewer's 3 "debatable" and 2 "canonical error
//                        inherited" outputs, plus the 2 pass-1 candidates the
//                        original verifier rejected.
//   D. pharmacist        Every other accepted output for the retail pharmacist.
//   E. analogy           Every other accepted output that used an analogy
//                        (the original verifier's uses_analogy flag).
//   F. fill              Remaining accepted outputs ranked by sha256(run_id),
//                        lowest first, until the set holds 50.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN = 'eval/results/2026-10-30.jsonl';
const SIZE = 50;

const CONFIRMED_MISSES = [
  'bi-rls::nurse',
  'cloud-environment::pharmacist',
  'bi-rls::pharmacist',
  'sys-jwt::pharmacist',
  'sec-oauth::pharmacist',
];
const REPORTED_CORRECT = [
  'excel-pivot-table::nurse',
  'sec-mfa::pharmacist',
  'sec-mfa::nurse',
  'fabric-data-pipeline::pharmacist',
  'sec-oauth::nurse',
  'sec-rbac::nurse',
  'data-join::nurse',
];
const BORDERLINE_FINAL = [
  'sys-http-header::pharmacist',
  'sys-payload::nurse',
  'aid-parameters::pharmacist',
  'bi-calculated-column::nurse',
];
// sec-mfa::pharmacist is also a reviewer "debatable"; it stays under B.
const BORDERLINE_PASS1 = ['sys-http-header::nurse', 'sys-jwt::teacher'];

const runRaw = readFileSync(join(ROOT, RUN), 'utf8');
const rows = runRaw.trim().split('\n').map((l) => JSON.parse(l));
const terms = JSON.parse(readFileSync(join(ROOT, 'eval/data/terms.json'), 'utf8')).terms;
const termById = new Map(terms.map((t) => [t.id, t]));
const byRun = new Map(rows.map((r) => [r.run_id, r]));
const accepted = rows.filter((r) => r.final_status === 'accepted_first_try' || r.final_status === 'accepted_after_retry');

const usedAnalogy = (r) => {
  const v = r.retried ? r.retry_verdict : r.pass1_verdict;
  return Boolean(v && v.uses_analogy);
};
const hashOf = (s) => createHash('sha256').update(s).digest('hex');

function item(r, variant, group) {
  const t = termById.get(r.term_id);
  if (!t) throw new Error(`term ${r.term_id} missing from terms.json`);
  const isPass1 = variant === 'pass1';
  const text = isPass1 ? r.pass1_candidate : r.final_text;
  const verdict = isPass1 ? r.pass1_verdict : r.retried ? r.retry_verdict : r.pass1_verdict;
  if (!text || !verdict) throw new Error(`${r.run_id}::${variant} has no text or verdict`);
  return {
    id: `${r.run_id}::${variant}`,
    run_id: r.run_id,
    variant,
    group,
    term_id: r.term_id,
    term: r.term,
    category: r.category,
    profile_id: r.profile_id,
    profile_label: r.profile_label,
    final_status: r.final_status,
    candidate: {
      long_definition: text.long_definition,
      why_it_matters: text.why_it_matters,
      example_in_sentence: text.example_in_sentence,
    },
    original_verdict_overall: verdict.overall,
    original_uses_analogy: verdict.uses_analogy,
  };
}

const chosen = [];
const seen = new Set();
function take(runId, variant, group) {
  const key = `${runId}::${variant}`;
  if (seen.has(key)) return;
  const r = byRun.get(runId);
  if (!r) throw new Error(`run ${runId} not found in ${RUN}`);
  seen.add(key);
  chosen.push(item(r, variant, group));
}

CONFIRMED_MISSES.forEach((id) => take(id, 'final', 'A-confirmed-miss'));
REPORTED_CORRECT.forEach((id) => take(id, 'final', 'B-reported-correct'));
BORDERLINE_FINAL.forEach((id) => take(id, 'final', 'C-borderline'));
BORDERLINE_PASS1.forEach((id) => take(id, 'pass1', 'C-borderline'));
accepted.filter((r) => r.profile_id === 'pharmacist').forEach((r) => take(r.run_id, 'final', 'D-pharmacist'));
accepted.filter(usedAnalogy).forEach((r) => take(r.run_id, 'final', 'E-analogy'));
const rest = accepted
  .filter((r) => !seen.has(`${r.run_id}::final`))
  .sort((a, b) => (hashOf(a.run_id) < hashOf(b.run_id) ? -1 : 1));
for (const r of rest) {
  if (chosen.length >= SIZE) break;
  take(r.run_id, 'final', 'F-fill');
}
if (chosen.length !== SIZE) throw new Error(`selected ${chosen.length}, expected ${SIZE}`);

const out = {
  schema: 'jargon-verifier-v2-gold-items@1',
  source: RUN,
  source_sha256: hashOf(runRaw),
  size: chosen.length,
  selection: 'See the header of eval/verifier-v2/build-gold.mjs. Labels are not in this file; they live in gold/confirm.json.',
  items: chosen,
};
mkdirSync(join(ROOT, 'eval/verifier-v2/gold'), { recursive: true });
writeFileSync(join(ROOT, 'eval/verifier-v2/gold/items.json'), JSON.stringify(out, null, 2) + '\n');
const counts = chosen.reduce((m, c) => ((m[c.group] = (m[c.group] ?? 0) + 1), m), {});
console.log(`wrote ${chosen.length} items`, counts);
