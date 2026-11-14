// Run one verifier arm over the 50-item gold set, through subscription CLIs only.
//
//   node eval/verifier-v2/run-verifiers.ts --arm v1-claude
//   node eval/verifier-v2/run-verifiers.ts --arm v2-grok
//   node eval/verifier-v2/run-verifiers.ts --arm v2-claude
//   options: --limit N (smoke test), --out <file> (default results/<arm>.jsonl),
//            --retry-missing (run again only items whose latest row has no verdict),
//            --items <file> --extra-profiles <file> (run on another item set, such as heldout/)
//
// Arms:
//   v1-claude  The original verifier: the shipped Pass 2 system prompt and user
//              message (supabase/functions/personalize-term/prompts.ts, imported,
//              not copied) on the shipped model ID, through `claude -p` on the
//              Claude subscription. Decision = the verdict's own "overall".
//   v2-grok    Verifier v2 (lib.ts) on a second model family, through the `grok`
//              CLI on the X subscription. Decision = decideV2(verdict).
//   v2-claude  Verifier v2 on the same model as v1. Separates the rubric's effect
//              from the family's effect. Not an independent family.
//
// Rules this script enforces:
//   - No metered API key. Every metered key variable is removed from the child
//     environment (subscriptionEnv), and for claude the init event must report
//     apiKeySource "none" or the run stops.
//   - Calls run one at a time. Before each call the 1-minute load average is
//     read from `uptime`, and the script waits while it is over 150.
//   - Results are appended per item. An existing results file is resumed (items
//     already present are skipped), never overwritten.
//   - Each call runs from an empty temporary folder with tools disabled, so the
//     model sees only the prompt.
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PERSONALIZE_MODEL,
  PASS2_SYSTEM_PROMPT,
  buildPass2UserMessage,
  parseVerdict,
} from '../../supabase/functions/personalize-term/prompts.ts';
import {
  V2_JSON_SCHEMA,
  assertClaudeSubscription,
  decideV2,
  parseV2,
  subscriptionEnv,
  v2SystemPrompt,
  v2UserMessage,
  V3_EXTRACT_SCHEMA,
  V3_VERIFY_SCHEMA,
  decideV3,
  parseV3Checks,
  parseV3Claims,
  v3ExtractSystemPrompt,
  v3VerifySystemPrompt,
  v3VerifyUserMessage,
  type V3Result,
} from './lib.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HERE = join(ROOT, 'eval/verifier-v2');
const LOAD_CEILING = 150;
const CALL_TIMEOUT_MS = 6 * 60_000;
const GROK_MODEL = 'grok-4.7';
// Antigravity's Gemini Flash pool (Kevin's rulings allow Flash for bulk checks, never Argon).
const GEMINI_MODEL = 'Gemini 3.8 Flash (High)';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const arm = flag('--arm');
if (arm !== 'v1-claude' && arm !== 'v2-grok' && arm !== 'v2-claude' && arm !== 'v3-claude' && arm !== 'v2-gemini') {
  console.error('usage: --arm v1-claude|v2-grok|v2-claude|v3-claude|v2-gemini [--model M] [--tag T] [--limit N] [--out file]');
  process.exit(2);
}
const limit = flag('--limit') ? Number(flag('--limit')) : Infinity;
// --model picks the Claude model for claude arms (default: the shipped PERSONALIZE_MODEL).
// --tag names an iteration, so each one gets its own results file.
const claudeModel = flag('--model') ?? PERSONALIZE_MODEL;
const tag = flag('--tag');
const outPath = flag('--out') ?? join(HERE, 'results', `${arm}${tag ? `-${tag}` : ''}.jsonl`);
mkdirSync(dirname(outPath), { recursive: true });

// --items and --extra-profiles point the runner at another item set (the
// held-out set) without touching any prompt or decision rule.
const itemsPath = flag('--items') ?? join(HERE, 'gold/items.json');
const gold = JSON.parse(readFileSync(itemsPath, 'utf8'));
const terms = JSON.parse(readFileSync(join(ROOT, 'eval/data/terms.json'), 'utf8')).terms;
const profilesFile = JSON.parse(readFileSync(join(ROOT, 'eval/data/profiles.json'), 'utf8'));
const termById = new Map<string, any>(terms.map((t: any) => [t.id, t]));
const extraProfiles = flag('--extra-profiles') ? JSON.parse(readFileSync(flag('--extra-profiles')!, 'utf8')).profiles : [];
const profileById = new Map<string, any>([...profilesFile.profiles, ...extraProfiles].map((p: any) => [p.id, p]));
const knownVocabulary: string[] = profilesFile.known_vocabulary;

// --retry-missing: run again only the items whose latest row has no verdict.
// The new row is appended with the next attempt number. Earlier rows are kept,
// so first-attempt results stay visible.
const retryMissing = args.includes('--retry-missing');
const done = new Set<string>();
const attempts = new Map<string, number>();
if (existsSync(outPath)) {
  const latest = new Map<string, any>();
  for (const line of readFileSync(outPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    latest.set(row.id, row);
    attempts.set(row.id, (attempts.get(row.id) ?? 0) + 1);
  }
  for (const [id, row] of latest) {
    if (!retryMissing || row.decision !== null) done.add(id);
  }
}

const childEnv = subscriptionEnv(process.env);
const sandbox = mkdtempSync(join(tmpdir(), 'jargon-verifier-v2-'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadAvg1(): number {
  const out = execFileSync('uptime', { encoding: 'utf8' });
  const m = out.match(/load averages?:\s*([\d.]+)/);
  if (!m) throw new Error(`cannot read load from uptime: ${out}`);
  return Number(m[1]);
}
async function waitForLoad(): Promise<number> {
  let load = loadAvg1();
  while (load > LOAD_CEILING) {
    console.log(`load ${load} > ${LOAD_CEILING}, waiting 60 s`);
    await sleep(60_000);
    load = loadAvg1();
  }
  return load;
}

interface CallResult {
  text: string | null;
  structured: unknown;
  model_reported: string[];
  auth: string;
  notional_cost_usd: number | null;
  latency_ms: number;
  error: string | null;
  exit_code: number | null;
}

function runClaude(system: string, user: string, schema?: object, model: string = claudeModel): CallResult {
  const cliArgs = [
    '-p', user,
    '--system-prompt', system,
    '--tools', '',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--model', model,
    '--output-format', 'stream-json',
    '--verbose',
  ];
  if (schema) cliArgs.push('--json-schema', JSON.stringify(schema));
  const t0 = Date.now();
  const r = spawnSync('claude', cliArgs, {
    cwd: sandbox, env: childEnv, encoding: 'utf8', timeout: CALL_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const latency = Date.now() - t0;
  let init: any = null;
  let result: any = null;
  for (const line of (r.stdout ?? '').split('\n')) {
    if (!line.trim()) continue;
    let ev: any;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type === 'system' && ev.subtype === 'init') init = ev;
    if (ev.type === 'result') result = ev;
  }
  // Stops the whole run if the CLI did not use the subscription.
  assertClaudeSubscription(init);
  return {
    text: typeof result?.result === 'string' ? result.result : null,
    structured: result?.structured_output ?? null,
    model_reported: result?.modelUsage ? Object.keys(result.modelUsage) : [],
    auth: `claude apiKeySource=${init.apiKeySource}`,
    notional_cost_usd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
    latency_ms: latency,
    error: r.error ? String(r.error) : result?.is_error ? String(result.result) : r.status !== 0 ? (r.stderr ?? '').slice(0, 500) : null,
    exit_code: r.status,
  };
}

function runGrok(system: string, user: string): CallResult {
  const cliArgs = [
    '-m', GROK_MODEL,
    '--cwd', sandbox,
    '--max-turns', '1',
    '--disable-web-search',
    '--deny', 'run_terminal_command',
    '--permission-mode', 'plan',
    '--system-prompt-override', system,
    '--json-schema', JSON.stringify(V2_JSON_SCHEMA),
    '-p', user,
  ];
  const t0 = Date.now();
  const r = spawnSync('grok', cliArgs, {
    cwd: sandbox, env: childEnv, encoding: 'utf8', timeout: CALL_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const latency = Date.now() - t0;
  let out: any = null;
  try { out = JSON.parse(r.stdout ?? ''); } catch { /* recorded below */ }
  return {
    text: typeof out?.text === 'string' ? out.text : null,
    structured: out?.structuredOutput ?? null,
    model_reported: out?.modelUsage ? Object.keys(out.modelUsage) : [],
    auth: 'grok CLI, grok.com login (metered key variables removed from env)',
    notional_cost_usd: typeof out?.total_cost_usd === 'number' ? out.total_cost_usd : null,
    latency_ms: latency,
    error:
      r.error || r.status !== 0 || !out || (!out.text && !out.structuredOutput)
        ? `exit ${r.status}${r.error ? ` ${String(r.error)}` : ''} | stdout: ${(r.stdout ?? '').slice(-600)} | stderr: ${(r.stderr ?? '').slice(-600)}`
        : null,
    exit_code: r.status,
  };
}

// agy has no system-prompt flag, so the system prompt leads the single prompt.
// It runs from an empty folder and is told not to use tools.
function runGemini(system: string, user: string): CallResult {
  const prompt = `${system}\n\nDo not use any tools and do not read or write files. Answer from your own knowledge.\n\n${user}`;
  const cliArgs = ['--model', GEMINI_MODEL, '--print-timeout', '5m', '--output-format', 'json', '--json-schema', JSON.stringify(V2_JSON_SCHEMA), '-p', prompt];
  const t0 = Date.now();
  const r = spawnSync('agy', cliArgs, {
    cwd: sandbox, env: childEnv, encoding: 'utf8', timeout: CALL_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const latency = Date.now() - t0;
  let out: any = null;
  try { out = JSON.parse(r.stdout ?? ''); } catch { /* recorded below */ }
  const ok = out?.status === 'SUCCESS' && typeof out?.response === 'string' && out.response.length > 0;
  // agy in json mode with --json-schema can print the structured answer more
  // than once, one copy per line. Accept it only when every copy is identical.
  let text: string | null = ok ? out.response : null;
  let dupNote = '';
  if (text) {
    const copies = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (copies.length > 1) {
      text = copies.every((c: string) => c === copies[0]) ? copies[0] : null;
      dupNote = text ? '' : `agy returned ${copies.length} differing JSON copies`;
    }
  }
  // Prefer agy's schema-validated structured_output. The response text can
  // also hold the model's free-text answer ahead of the JSON.
  const structured = out?.status === 'SUCCESS' && out?.structured_output && typeof out.structured_output === 'object' ? out.structured_output : null;
  if (structured) dupNote = '';
  return {
    text,
    structured,
    model_reported: [GEMINI_MODEL],
    auth: 'agy CLI, Google subscription login (metered key variables removed from env)',
    notional_cost_usd: null,
    latency_ms: latency,
    error: ok && !dupNote ? null : dupNote || `exit ${r.status} | status ${out?.status} ${out?.error ?? ''} | stdout: ${(r.stdout ?? '').slice(-400)} | stderr: ${(r.stderr ?? '').slice(-400)}`,
    exit_code: r.status,
  };
}

async function main() {
  console.log(`arm ${arm} -> ${outPath} (${done.size} already done), sandbox ${sandbox}`);
  let n = 0;
  for (const it of gold.items) {
    if (n >= limit) break;
    if (done.has(it.id)) continue;
    n++;
    const term = termById.get(it.term_id);
    const profile = profileById.get(it.profile_id);
    if (!term || !profile) throw new Error(`missing term or profile for ${it.id}`);
    const load = await waitForLoad();
    const started = new Date().toISOString();
    let call: CallResult;
    let verdict: unknown = null;
    let decision: 'pass' | 'fail' | 'abstain' | null = null;
    let decisionLenient: 'pass' | 'fail' | null = null;
    if (arm === 'v1-claude') {
      call = runClaude(PASS2_SYSTEM_PROMPT, buildPass2UserMessage(term, it.candidate, profile, knownVocabulary));
      const v = call.text ? parseVerdict(call.text) : null;
      verdict = v;
      decision = v ? v.overall : null;
    } else if (arm === 'v3-claude') {
      const ctx = { canonical: term, candidate: it.candidate, profileId: it.profile_id, profile };
      const extract = runClaude(v3ExtractSystemPrompt(), v2UserMessage(ctx), V3_EXTRACT_SCHEMA);
      const claims = parseV3Claims(extract.structured ?? extract.text);
      if (!claims) {
        call = extract;
      } else {
        const check = runClaude(v3VerifySystemPrompt(), v3VerifyUserMessage({ ...ctx, claims }), V3_VERIFY_SCHEMA);
        const parsed = parseV3Checks(check.structured ?? check.text, claims.length);
        call = { ...check, latency_ms: extract.latency_ms + check.latency_ms, notional_cost_usd: (extract.notional_cost_usd ?? 0) + (check.notional_cost_usd ?? 0) };
        if (parsed) {
          const v: V3Result = { claims, ...parsed };
          verdict = v;
          decision = decideV3(v) as any;
        }
      }
    } else {
      const user = v2UserMessage({ canonical: term, candidate: it.candidate, profileId: it.profile_id, profile });
      call = arm === 'v2-grok' ? runGrok(v2SystemPrompt(), user) : arm === 'v2-gemini' ? runGemini(v2SystemPrompt(), user) : runClaude(v2SystemPrompt(), user, V2_JSON_SCHEMA);
      const v = parseV2((call.structured as object | null) ?? call.text);
      verdict = v;
      decision = v ? decideV2(v, 'primary') : null;
      decisionLenient = v ? decideV2(v, 'lenient') : null;
    }
    const row = {
      id: it.id,
      arm,
      attempt: (attempts.get(it.id) ?? 0) + 1,
      started_at: started,
      load_1m_at_start: load,
      model_requested: arm === 'v2-grok' ? GROK_MODEL : arm === 'v2-gemini' ? GEMINI_MODEL : claudeModel,
      tag: tag ?? null,
      model_reported: call.model_reported,
      auth: call.auth,
      notional_cost_usd: call.notional_cost_usd,
      latency_ms: call.latency_ms,
      exit_code: call.exit_code,
      error: call.error,
      decision,
      decision_lenient: decisionLenient,
      verdict,
      raw_text: verdict ? null : call.text,
    };
    appendFileSync(outPath, JSON.stringify(row) + '\n');
    console.log(`${n} ${it.id} -> ${decision ?? 'NO VERDICT'} (${Math.round(call.latency_ms / 1000)} s, load ${load})${call.error ? ` error: ${call.error.slice(0, 120)}` : ''}`);
  }
  console.log('finished');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
