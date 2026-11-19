// Generate held-out explanations the way the 10/30 originals were made: the
// shipped Pass 1 system prompt and user message, imported from prompts.ts, on
// the shipped model, through `claude -p` on the Claude subscription.
//
//   node eval/verifier-v2/heldout/generate.ts
//
// Terms: the 13 terms in eval/data/terms.json that no dev-set item uses.
// Learners: the nurse and retail pharmacist from eval/data/profiles.json, plus
// the hospital pharmacist in extra-profiles.json. 13 x 3 = 39 items.
// Differences from the original run: the CLI cannot set max_tokens or
// temperature, and only Pass 1 runs here (verification is what is under test).
// Results are appended to generated.jsonl and resumed, never overwritten.
import { spawnSync, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERSONALIZE_MODEL, buildPass1UserMessage, parseRendering, pass1SystemPrompt } from '../../../supabase/functions/personalize-term/prompts.ts';
import { assertClaudeSubscription, subscriptionEnv } from '../lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const OUT = join(HERE, 'generated.jsonl');
const terms = JSON.parse(readFileSync(join(ROOT, 'eval/data/terms.json'), 'utf8')).terms;
const base = JSON.parse(readFileSync(join(ROOT, 'eval/data/profiles.json'), 'utf8'));
const extra = JSON.parse(readFileSync(join(HERE, 'extra-profiles.json'), 'utf8')).profiles;
const devTerms = new Set(JSON.parse(readFileSync(join(HERE, '..', 'gold/items.json'), 'utf8')).items.map((i: any) => i.term_id));
const profiles = [...base.profiles.filter((p: any) => p.id === 'nurse' || p.id === 'pharmacist'), ...extra];
const unseen = terms.filter((t: any) => !devTerms.has(t.id));
if (unseen.length !== 13 || profiles.length !== 3) throw new Error(`expected 13 terms and 3 profiles, got ${unseen.length} and ${profiles.length}`);

const done = new Set<string>();
if (existsSync(OUT)) for (const l of readFileSync(OUT, 'utf8').split('\n')) if (l.trim()) done.add(JSON.parse(l).run_id);
const sandbox = mkdtempSync(join(tmpdir(), 'jargon-heldout-gen-'));
const env = subscriptionEnv(process.env);
const load = () => Number(execFileSync('uptime', { encoding: 'utf8' }).match(/load averages?:\s*([\d.]+)/)![1]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const t of unseen) {
  for (const p of profiles) {
    const runId = `${t.id}::${p.id}`;
    if (done.has(runId)) continue;
    while (load() > 150) { console.log('load over 150, waiting 60 s'); await sleep(60_000); }
    const r = spawnSync('claude', ['-p', buildPass1UserMessage(t, p, base.known_vocabulary), '--system-prompt', pass1SystemPrompt(t.domain), '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence', '--model', PERSONALIZE_MODEL, '--output-format', 'stream-json', '--verbose'], { cwd: sandbox, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000, maxBuffer: 64e6 });
    let init: any = null, result: any = null;
    for (const line of (r.stdout ?? '').split('\n')) {
      try { const ev = JSON.parse(line); if (ev.type === 'system' && ev.subtype === 'init') init = ev; if (ev.type === 'result') result = ev; } catch { /* skip */ }
    }
    assertClaudeSubscription(init);
    const parsed = typeof result?.result === 'string' ? parseRendering(result.result) : null;
    appendFileSync(OUT, JSON.stringify({ run_id: runId, term_id: t.id, term: t.term, profile_id: p.id, profile_label: p.label, model: Object.keys(result?.modelUsage ?? {}), auth: init.apiKeySource, candidate: parsed, raw: parsed ? null : result?.result ?? null }) + '\n');
    console.log(`${runId} -> ${parsed ? 'ok' : 'UNPARSEABLE'}`);
  }
}
console.log('finished');
