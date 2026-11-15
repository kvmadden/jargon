// Offline eval for personalize-term. Makes paid model calls: run it only when
// you mean to spend (the budget below bounds the spend).
//
//   export ANTHROPIC_API_KEY=...            # never written to disk by this script
//   EVAL_DATE=2026-11-10 node eval/run-personalize-eval.ts --terms eval/data/terms-2026-11-10.json
//
// It runs supabase/functions/personalize-term/pipeline.ts, the same pass
// sequence, verifier parsing and claim gate the Edge Function runs, so the
// eval measures the code that serves learners. Only the transport differs:
// fetch here, the Deno SDK there (eval/lib/eval-lib.ts httpCallModel).
//
// Options (env):
//   EVAL_DATE=YYYY-MM-DD   results file name (default: today, UTC)
//   EVAL_BUDGET_USD=10     hard stop. An item starts only if the spend so far,
//                          the in-flight reservations and its own worst case at
//                          list price (4 calls, longest possible prompts, full
//                          output limits) fit in the budget.
//   EVAL_CONCURRENCY=3     max parallel items (capped at 3)
//   EVAL_LIMIT=N           run only the first N items (smoke test)
// Options (flags):
//   --terms <file>         terms file (default eval/data/terms.json, the frozen
//                          2026-10-30 input)
//   --profiles <file>      profiles file (default eval/data/profiles.json)
//   --results-dir <dir>    where to write <EVAL_DATE>.jsonl and its meta file
//                          (default eval/results). Frozen files are refused.
//   --use-draft-analogies  let a draft comparison stand in when none is vetted,
//                          to check the prompts before vetting. Rows say so.
//
// As in production (prompt version 11), an item runs only for a supported
// learner field with a comparison for its term. Otherwise it is recorded as
// skipped-unsupported-field or skipped-no-analogy, with no model call.
//
// Each row records the manifest hash: prompts, pipeline, gate, model, prompt
// version, terms and profiles. Resuming a results file written under a
// different manifest is refused, so one file never mixes two experiments.
// Results written by this script are development data until they come from a
// locked set scored once (docs/evaluation.md).

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPersonalization } from '../supabase/functions/personalize-term/pipeline.ts';
import { APPROVED_ANALOGIES } from '../supabase/functions/personalize-term/approved-analogies.ts';
import { PERSONALIZE_MODEL } from '../supabase/functions/personalize-term/prompts.ts';
import { MODEL_PRICES, PRICES_CHECKED_ON } from '../supabase/functions/_shared/pricing.ts';
import { MANIFEST_SOURCES, analogyForItem, canStartItem, checkResume, httpCallModel, manifestHash, outputPaths, worstCaseItemUsd } from './lib/eval-lib.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is not set. Export it in your shell. This script never stores it.');
  process.exit(2);
}
const EVAL_DATE = process.env.EVAL_DATE ?? new Date().toISOString().slice(0, 10);
const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD ?? '10');
const CONCURRENCY = Math.min(3, Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? '3')));
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : Infinity;
const TERMS_PATH = flag('--terms') ?? 'eval/data/terms.json';
const PROFILES_PATH = flag('--profiles') ?? 'eval/data/profiles.json';
const ALLOW_DRAFTS = process.argv.includes('--use-draft-analogies');

const PROMPT_VERSION = Number(read('supabase/functions/personalize-term/index.ts').match(/^const\s+PROMPT_VERSION\s*=\s*(\d+)\s*;/m)![1]);
const termsSrc = read(TERMS_PATH);
const profilesSrc = read(PROFILES_PATH);
const MANIFEST = manifestHash({
  promptVersion: PROMPT_VERSION,
  model: PERSONALIZE_MODEL,
  sources: Object.fromEntries(MANIFEST_SOURCES.map((path) => [path, read(path)])),
  termsFile: termsSrc,
  profilesFile: profilesSrc,
});

const terms = JSON.parse(termsSrc).terms as any[];
const profilesFile = JSON.parse(profilesSrc);
const profiles = profilesFile.profiles as any[];
const knownVocabulary: string[] = profilesFile.known_vocabulary ?? [];

const frozen = JSON.parse(read('eval/frozen-artifacts.json')).files as Record<string, string>;
let RESULTS_PATH: string;
let META_PATH: string;
try {
  ({ results: RESULTS_PATH, meta: META_PATH } = outputPaths(ROOT, flag('--results-dir') ?? 'eval/results', EVAL_DATE, frozen));
} catch (err: any) {
  console.error(err?.message ?? String(err));
  process.exit(2);
}
mkdirSync(dirname(RESULTS_PATH), { recursive: true });

// Interleaved: round r takes the r-th term of every category, each with every
// profile, so a budget stop leaves a set balanced across categories and profiles.
function buildItems() {
  const byCat = new Map<string, any[]>();
  for (const t of terms) byCat.set(t.category, [...(byCat.get(t.category) ?? []), t]);
  const rounds = Math.max(...[...byCat.values()].map((v) => v.length));
  const items: Array<{ term: any; profile: any; runId: string }> = [];
  for (let r = 0; r < rounds; r++) {
    for (const list of byCat.values()) {
      const t = list[r];
      if (t) for (const p of profiles) items.push({ term: t, profile: p, runId: `${t.id}::${p.id}` });
    }
  }
  return items;
}

async function main() {
  const allItems = buildItems().slice(0, LIMIT);
  const existing = existsSync(RESULTS_PATH)
    ? readFileSync(RESULTS_PATH, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
    : [];
  const refusal = checkResume(existing, MANIFEST);
  if (refusal) {
    console.error(refusal);
    process.exit(2);
  }
  const done = new Set(existing.map((r) => r.run_id));
  let spent = existing.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const todo = allItems.filter((it) => !done.has(it.runId));
  console.log(`model=${PERSONALIZE_MODEL} prompt_version=${PROMPT_VERSION} manifest=${MANIFEST.slice(0, 12)} items=${allItems.length} todo=${todo.length} spent=$${spent.toFixed(4)} budget=$${BUDGET_USD}`);

  let reserved = 0;
  let next = 0;
  let stoppedForBudget = false;
  let transportRetries = 0;
  let unknownBillingUsd = 0;
  const callModel = httpCallModel({
    fetch: fetch as any,
    apiKey: apiKey!,
    onRetry: () => transportRetries++,
    // An attempt with no readable response may have been billed: count its worst case as spent.
    chargeUnknown: (usd) => {
      spent += usd;
      unknownBillingUsd += usd;
    },
    // A retry needs room for one more worst-case attempt on top of everything reserved.
    allowRetry: (usd) => canStartItem(spent, reserved, usd, BUDGET_USD),
  });

  async function worker() {
    for (;;) {
      if (stoppedForBudget || next >= todo.length) return;
      const it = todo[next];
      const analogy = analogyForItem(it.term.id, it.profile, { allowDrafts: ALLOW_DRAFTS });
      if (!analogy.entry) {
        next++;
        const status = analogy.field ? 'skipped-no-analogy' : 'skipped-unsupported-field';
        appendFileSync(RESULTS_PATH, JSON.stringify({ run_id: it.runId, eval_date: EVAL_DATE, manifest_sha256: MANIFEST, status, learner_field: analogy.field, cost_usd: 0, calls: [] }) + '\n');
        done.add(it.runId);
        console.log(`[${done.size}] ${it.runId.padEnd(40)} ${status}`);
        continue;
      }
      const worst = worstCaseItemUsd(it.term, it.profile, knownVocabulary);
      if (!canStartItem(spent, reserved, worst, BUDGET_USD)) {
        stoppedForBudget = true;
        console.log(`budget guard: spent=$${spent.toFixed(4)} reserved=$${reserved.toFixed(4)} next_worst_case=$${worst.toFixed(4)} -> stop`);
        return;
      }
      next++;
      reserved += worst;
      let outcome;
      try {
        outcome = await runPersonalization(
          { term: it.term, profile: it.profile, knownVocabulary, approvedAnalogies: APPROVED_ANALOGIES, vettedAnalogy: analogy.entry.comparison },
          callModel,
        );
      } finally {
        reserved -= worst;
      }
      spent += outcome.costUsd;
      const rec = {
        run_id: it.runId,
        eval_date: EVAL_DATE,
        manifest_sha256: MANIFEST,
        model: PERSONALIZE_MODEL,
        prompt_version: PROMPT_VERSION,
        term_id: it.term.id,
        category: it.term.category,
        difficulty: it.term.difficulty,
        profile_id: it.profile.id,
        learner_field: analogy.field,
        comparison: analogy.entry.comparison,
        comparison_is_draft: analogy.draft,
        status: outcome.status,
        needs_review: outcome.needsReview,
        final_text: outcome.accepted,
        pass1_candidate: outcome.pass1Candidate,
        pass1_verdict: outcome.pass1Verdict,
        pass1_gate: outcome.pass1Gate,
        retry_candidate: outcome.retryCandidate,
        retry_verdict: outcome.retryVerdict,
        retry_gate: outcome.retryGate,
        calls: outcome.passes.map((p) => ({ pass: p.pass, usage: p.usage, cost_usd: p.costUsd, latency_ms: p.latencyMs, stop_reason: p.stopReason })),
        cost_usd: outcome.costUsd,
        worst_case_usd: worst,
        error_text: outcome.errorText,
      };
      appendFileSync(RESULTS_PATH, JSON.stringify(rec) + '\n');
      done.add(it.runId);
      console.log(`[${done.size}] ${it.runId.padEnd(40)} ${outcome.status.padEnd(26)} $${outcome.costUsd.toFixed(4)} total=$${spent.toFixed(4)}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(
    META_PATH,
    JSON.stringify(
      {
        eval_date: EVAL_DATE,
        status: 'development data',
        manifest_sha256: MANIFEST,
        model: PERSONALIZE_MODEL,
        prompt_version: PROMPT_VERSION,
        terms_file: TERMS_PATH,
        profiles_file: PROFILES_PATH,
        planned_items: allItems.length,
        completed_items: done.size,
        stopped_for_budget: stoppedForBudget,
        budget_usd: BUDGET_USD,
        spent_usd: spent,
        transport_retries: transportRetries,
        unknown_billing_usd: unknownBillingUsd,
        pricing_per_mtok: MODEL_PRICES[PERSONALIZE_MODEL],
        prices_checked_on: PRICES_CHECKED_ON,
        draft_analogies_used: ALLOW_DRAFTS,
        finished_at: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`done: completed=${done.size}/${allItems.length} spent=$${spent.toFixed(4)} stopped_for_budget=${stoppedForBudget}`);
}

main().catch((e) => {
  console.error('fatal:', e?.message ?? e);
  process.exit(1);
});
