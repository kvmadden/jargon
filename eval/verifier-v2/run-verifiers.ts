// Run one verifier arm over the 50-item gold set, through subscription CLIs only.
//
//   node eval/verifier-v2/run-verifiers.ts --arm v1-claude
//   node eval/verifier-v2/run-verifiers.ts --arm v2-grok
//   node eval/verifier-v2/run-verifiers.ts --arm v2-claude
//   options: --limit N (smoke test), --out <file> (default results/<arm>.jsonl)
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
} from './lib.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HERE = join(ROOT, 'eval/verifier-v2');
const LOAD_CEILING = 150;
const CALL_TIMEOUT_MS = 6 * 60_000;
const GROK_MODEL = 'grok-4.7';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const arm = flag('--arm');
if (arm !== 'v1-claude' && arm !== 'v2-grok' && arm !== 'v2-claude') {
  console.error('usage: --arm v1-claude|v2-grok|v2-claude [--limit N] [--out file]');
  process.exit(2);
}
const limit = flag('--limit') ? Number(flag('--limit')) : Infinity;
const outPath = flag('--out') ?? join(HERE, 'results', `${arm}.jsonl`);
mkdirSync(dirname(outPath), { recursive: true });

const gold = JSON.parse(readFileSync(join(HERE, 'gold/items.json'), 'utf8'));
const terms = JSON.parse(readFileSync(join(ROOT, 'eval/data/terms.json'), 'utf8')).terms;
const profilesFile = JSON.parse(readFileSync(join(ROOT, 'eval/data/profiles.json'), 'utf8'));
const termById = new Map<string, any>(terms.map((t: any) => [t.id, t]));
const profileById = new Map<string, any>(profilesFile.profiles.map((p: any) => [p.id, p]));
const knownVocabulary: string[] = profilesFile.known_vocabulary;

const done = new Set<string>();
if (existsSync(outPath)) {
  for (const line of readFileSync(outPath, 'utf8').split('\n')) {
    if (line.trim()) done.add(JSON.parse(line).id);
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

function runClaude(system: string, user: string, schema?: object): CallResult {
  const cliArgs = [
    '-p', user,
    '--system-prompt', system,
    '--tools', '',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--model', PERSONALIZE_MODEL,
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
    error: r.error ? String(r.error) : !out ? `unparseable stdout: ${(r.stdout ?? '').slice(0, 300)} | stderr: ${(r.stderr ?? '').slice(0, 300)}` : null,
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
    let decision: 'pass' | 'fail' | null = null;
    let decisionLenient: 'pass' | 'fail' | null = null;
    if (arm === 'v1-claude') {
      call = runClaude(PASS2_SYSTEM_PROMPT, buildPass2UserMessage(term, it.candidate, profile, knownVocabulary));
      const v = call.text ? parseVerdict(call.text) : null;
      verdict = v;
      decision = v ? v.overall : null;
    } else {
      const user = v2UserMessage({ canonical: term, candidate: it.candidate, profileId: it.profile_id, profile });
      call = arm === 'v2-grok' ? runGrok(v2SystemPrompt(), user) : runClaude(v2SystemPrompt(), user, V2_JSON_SCHEMA);
      const v = parseV2((call.structured as object | null) ?? call.text);
      verdict = v;
      decision = v ? decideV2(v, 'primary') : null;
      decisionLenient = v ? decideV2(v, 'lenient') : null;
    }
    const row = {
      id: it.id,
      arm,
      started_at: started,
      load_1m_at_start: load,
      model_requested: arm === 'v2-grok' ? GROK_MODEL : PERSONALIZE_MODEL,
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
