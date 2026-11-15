// Runs the pinned verifier (the pass-2 call of the personalize pipeline) once over the Part B blind set, through the
// Message Batches API, in chunks, under a hard cost ceiling. See RUN-PLAN.md in this folder for the rules.
//
//   node eval/fresh-blind-set/run-verifier-batch.ts --set <staged set folder> --pin <checkout at the pinned commit> \
//        --out <new or resumable output folder> [--dry-run] [--check-request <n>]
//
// The API key comes from the ANTHROPIC_API_KEY variable or, when that is unset, from the first line of standard
// input (so it never has to appear in a command line). The base address is fixed and is not read from the
// environment, so a proxy variable cannot redirect the requests.
//
// The transport is plain fetch, like eval/lib/eval-lib.ts, so the repository gains no dependency and the tests can
// pass a fake. Nothing printed here contains item text, a reply or a verdict. Only counts, token usage, costs and
// batch ids are printed.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { httpBatchApi } from './part-b-http.ts';
import {
  ApiError,
  buildBatchRequests,
  finalCounts,
  fingerprintPassConfig,
  runPass,
  worstCaseItemUsd,
  type CacheTtl,
  type PassState,
  type StagedProfile,
  type StagedRendering,
  type StagedTerm,
  type Store,
  type VerifierPin,
  type PassConfig,
} from './part-b-lib.ts';
import { ensureRunManifest } from './run-manifest.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Per-item cost projected before any chunk after the warm-up has finished: the batch price with no cache hits. */
const FALLBACK_PER_ITEM_USD = 0.0213;

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(name);
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(2);
};
const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const stamp = () => new Date().toISOString().slice(11, 19);
const readJsonl = <T>(file: string): T[] => readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as T);

// ─── Checks against the registration ───────────────────────────────────────────

function verifyAgainstLock(setDir: string, pinDir: string, lock: any) {
  for (const f of ['terms.jsonl', 'profiles.jsonl', 'renderings.jsonl']) {
    const want = lock.files?.[f];
    if (!want) fail(`the lock file has no hash for ${f}`);
    if (sha256(readFileSync(join(setDir, f))) !== want) fail(`${f} does not match the registered hash. Not starting.`);
  }
  const pin = lock.pinned_verifier;
  const head = execFileSync('git', ['-C', pinDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== pin.commit) fail(`the pinned checkout is at ${head}, not the registered ${pin.commit}. Not starting.`);
  for (const [f, want] of Object.entries<string>(pin.files)) {
    if (sha256(readFileSync(join(pinDir, f))) !== want) fail(`${f} in the pinned checkout does not match the registered hash. Not starting.`);
  }
}

async function loadPin(pinDir: string, lock: any): Promise<{ pin: VerifierPin; parseVerdict: (raw: string) => unknown }> {
  const P: any = await import(pathToFileURL(join(pinDir, 'supabase/functions/personalize-term/prompts.ts')).href);
  const want = lock.pinned_verifier;
  if (sha256(P.PASS2_SYSTEM_PROMPT) !== want.pass2_system_prompt_sha256) fail('the verifier system prompt does not match the registered hash. Not starting.');
  if (P.PERSONALIZE_MODEL !== want.model) fail('the model in the pinned checkout is not the registered one. Not starting.');
  if (P.PERSONALIZE_MAX_TOKENS_PASS2 !== want.max_tokens) fail('the token cap in the pinned checkout is not the registered one. Not starting.');
  return {
    pin: { model: P.PERSONALIZE_MODEL, maxTokens: P.PERSONALIZE_MAX_TOKENS_PASS2, systemPrompt: P.PASS2_SYSTEM_PROMPT, buildUserMessage: P.buildPass2UserMessage },
    parseVerdict: P.parseVerdict,
  };
}

// ─── Files ─────────────────────────────────────────────────────────────────────

function fileStore(outDir: string): Store {
  const stateFile = join(outDir, 'state.json');
  const resultsDir = join(outDir, 'results');
  return {
    loadState: () => (existsSync(stateFile) ? (JSON.parse(readFileSync(stateFile, 'utf8')) as PassState) : null),
    saveState: (s) => writeFileSync(stateFile, JSON.stringify(s, null, 1) + '\n'),
    saveResults: (name, text) => {
      mkdirSync(resultsDir, { recursive: true });
      const file = join(resultsDir, `${name}.jsonl`);
      // Results are never overwritten. Fetching the same finished batch again gives the same text, which is accepted.
      if (existsSync(file)) {
        if (readFileSync(file, 'utf8') !== text) throw new Error(`results for ${name} already exist and differ`);
        return;
      }
      writeFileSync(file, text, { flag: 'wx' });
    },
    readResults: (name) => (existsSync(join(resultsDir, `${name}.jsonl`)) ? readFileSync(join(resultsDir, `${name}.jsonl`), 'utf8') : null),
  };
}

async function readKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  if (process.stdin.isTTY) fail('no API key: set ANTHROPIC_API_KEY or pipe the key in on standard input');
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  const key = text.split('\n')[0].trim();
  if (!key) fail('no API key on standard input');
  return key;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const setDir = resolve(arg('--set') ?? fail('missing --set'));
  const pinDir = resolve(arg('--pin') ?? fail('missing --pin'));
  const outDir = resolve(arg('--out') ?? fail('missing --out'));
  const lock = JSON.parse(readFileSync(resolve(arg('--lock') ?? join(HERE, 'lock.json')), 'utf8'));
  const ttl = (arg('--ttl') ?? '1h') as CacheTtl;
  const ceiling = Number(arg('--ceiling-usd') ?? '7.83');
  const chunkSizes = (arg('--chunks') ?? '1,24,60,60,60,60,40,40').split(',').map(Number);
  const warmupChunks = Number(arg('--warmup-chunks') ?? '1');
  const pollMs = Number(arg('--poll-seconds') ?? '30') * 1000;
  if (ttl !== '1h' && ttl !== '5m') fail('--ttl must be 1h or 5m');
  if (!(ceiling > 0)) fail('--ceiling-usd must be a positive number');

  verifyAgainstLock(setDir, pinDir, lock);
  const { pin, parseVerdict } = await loadPin(pinDir, lock);

  const renderings = readJsonl<StagedRendering>(join(setDir, 'renderings.jsonl'));
  const terms = new Map(readJsonl<StagedTerm>(join(setDir, 'terms.jsonl')).map((t) => [t.id, t]));
  const profiles = new Map(readJsonl<StagedProfile>(join(setDir, 'profiles.jsonl')).map((p) => [p.id, p]));
  const requests = buildBatchRequests({ renderings, terms, profiles, pin, ttl });

  const userChars = requests.map((r) => r.params.messages[0].content.length).sort((a, b) => a - b);
  const maxInputTokens = Math.ceil(((pin.systemPrompt.length + userChars[userChars.length - 1]) / 2.5) * 1.05);
  const worstItem = worstCaseItemUsd(pin.model, maxInputTokens, pin.maxTokens);
  console.log(
    `${stamp()} registered set and pin verified. requests ${requests.length}, terms ${terms.size}, profiles ${profiles.size}, system prompt ${pin.systemPrompt.length} chars, ` +
      `user message chars min ${userChars[0]} median ${userChars[Math.floor(userChars.length / 2)]} max ${userChars[userChars.length - 1]}, ` +
      `worst case per request ${worstItem.toFixed(4)} usd, ceiling ${ceiling} usd, chunks ${chunkSizes.join('+')}, cache lifetime ${ttl}`,
  );

  const passConfig: PassConfig = {
    requests,
    chunkSizes,
    warmupChunks,
    ceilingUsd: ceiling,
    model: pin.model,
    fallbackPerItemUsd: FALLBACK_PER_ITEM_USD,
    worstCasePerItemUsd: worstItem,
    pollMs,
    parse: parseVerdict,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
    log: (line) => console.log(`${stamp()} ${line}`),
  };
  const runFingerprint = fingerprintPassConfig(passConfig);
  const manifest = JSON.stringify({
    run_fingerprint: runFingerprint,
    model: pin.model,
    max_tokens: pin.maxTokens,
    ttl,
    count: requests.length,
    params_sha256: Object.fromEntries(requests.map((r) => [r.custom_id, sha256(JSON.stringify(r.params))])),
  }, null, 1) + '\n';
  ensureRunManifest(outDir, runFingerprint, manifest);

  if (flag('--dry-run')) {
    console.log(`${stamp()} dry run: nothing was sent.`);
    return;
  }

  const apiKey = await readKey();
  const api = httpBatchApi(apiKey);

  const check = arg('--check-request');
  if (check) {
    const n = Math.min(Number(check), requests.length);
    for (let i = 0; i < n; i++) {
      try {
        console.log(`${stamp()} token count for request ${i + 1} of ${n}: ${await api.countTokens(requests[i].params)}`);
      } catch (err) {
        console.log(`${stamp()} the token-counting endpoint refused request ${i + 1}: ${(err as Error).message}`);
        process.exit(1);
      }
    }
    console.log(`${stamp()} the request shape was accepted. Nothing was charged.`);
    return;
  }

  const store = fileStore(outDir);
  const state = await runPass(api, store, passConfig);

  const counts = finalCounts(store, state, requests.map((r) => r.custom_id), parseVerdict);
  const summary = {
    finished: state.finished,
    stopped: state.stopped,
    spent_usd: Number(state.spentUsd.toFixed(6)),
    ceiling_usd: state.ceilingUsd,
    requests: requests.length,
    final_counts_by_rendering: counts,
    chunks: state.chunks.map((c) => ({ label: c.label, items: c.ids.length, status: c.status, batch_id: c.batchId ?? null, cost_usd: c.costUsd ?? null, counts: c.counts ?? null, totals: c.totals ?? null })),
    retry: state.retry ? { label: state.retry.label, items: state.retry.ids.length, status: state.retry.status, batch_id: state.retry.batchId ?? null, cost_usd: state.retry.costUsd ?? null } : null,
    results_sha256: Object.fromEntries([...state.chunks, ...(state.retry ? [state.retry] : [])].filter((c) => store.readResults(c.label)).map((c) => [`${c.label}.jsonl`, sha256(store.readResults(c.label)!)])),
    prices: { model: pin.model, per_mtok_usd: { input: 5, output: 25 }, batch_discount: 0.5, cache_factors: { read: 0.1, write_5m: 1.25, write_1h: 2 }, checked_on: '2026-11-03' },
  };
  writeFileSync(join(outDir, 'SUMMARY.json'), JSON.stringify(summary, null, 1) + '\n');
  console.log(`${stamp()} ${state.finished ? 'FINISHED' : 'STOPPED'}. spent ${state.spentUsd.toFixed(4)} usd of ${state.ceilingUsd}. final counts by rendering: ${JSON.stringify(counts)}`);
  process.exit(state.finished ? 0 : 3);
}

main().catch((err) => {
  // Only the class of failure is printed, never a message that could echo a request.
  console.error(`run failed: ${err instanceof ApiError ? `${err.kind} ${err.message}` : (err as Error).name}`);
  process.exit(1);
});
