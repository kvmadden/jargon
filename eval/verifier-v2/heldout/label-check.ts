// Second-family label check for the held-out set. The labeler sees each
// explanation blind (never the proposed labels). Gemini is not used because it
// is half of the frozen rule.
//
//   node eval/verifier-v2/heldout/label-check.ts                                 # Grok, X subscription
//   node eval/verifier-v2/heldout/label-check.ts --labeler ollama:qwen3.8:27b    # local model, no quota
//
// On 2026-11-13 every Grok call returned 402 "Grok Build usage balance
// exhausted", so the recorded check used the local qwen3.8:27b through Ollama.
// Writes label-check.jsonl (one row per item, resumed, never overwritten).
// compare-labels.ts joins it with labels.json and lists the disagreements.
import { spawnSync, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { subscriptionEnv } from '../lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'label-check.jsonl');
const MODEL = 'grok-4.7';
const argv = process.argv.slice(2);
const labelerArg = argv.includes('--labeler') ? argv[argv.indexOf('--labeler') + 1] : 'grok';
const OLLAMA_MODEL = labelerArg.startsWith('ollama:') ? labelerArg.slice('ollama:'.length) : null;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const items = JSON.parse(readFileSync(join(HERE, 'items.json'), 'utf8')).items;

export const LABEL_SYSTEM = `You are an independent labeler for a learning app that explains technical terms to clinicians in plain language. Label one explanation for one learner.

Labels:
- correct: every claim is accurate for this learner. A simplification that still leaves the learner believing something true is correct. An ordinary, plausible workplace example is correct.
- wrong: at least one claim is false, including claims about how the learner's own clinical workplace works, what a clinical system is connected to, who can see or do what, or what a clinical artifact or process involves.
- misleading: nothing outright false, but a claim is overstated, true only in a narrow sense, or would leave the learner believing something false.

Judge claims about clinical practice the way an experienced practitioner in the learner's job in the United States would. Do not label anything wrong for tone, emphasis or wording.

Reply with ONLY one JSON object: {"label":"correct|wrong|misleading","reason":"one sentence naming the specific claim if not correct"}`;
const SCHEMA = { type: 'object', properties: { label: { type: 'string', enum: ['correct', 'wrong', 'misleading'] }, reason: { type: 'string' } }, required: ['label', 'reason'] };

const done = new Set<string>();
if (existsSync(OUT)) for (const l of readFileSync(OUT, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); if (r.label) done.add(r.id); }
const sandbox = mkdtempSync(join(tmpdir(), 'jargon-heldout-label-'));
const env = subscriptionEnv(process.env);
const load = () => Number(execFileSync('uptime', { encoding: 'utf8' }).match(/load averages?:\s*([\d.]+)/)![1]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const it of items) {
  if (done.has(it.id)) continue;
  while (load() > 150) { console.log('load over 150, waiting 60 s'); await sleep(60_000); }
  const user = `LEARNER: ${it.profile_label} (${it.job})
TERM: ${it.term}

EXPLANATION:
- long_definition: ${it.candidate.long_definition}
- why_it_matters: ${it.candidate.why_it_matters}
- example_in_sentence: ${it.candidate.example_in_sentence}

Label it. JSON only.`;
  const t0 = Date.now();
  let so: any = null;
  let model: string[] = [];
  let labeler = 'grok CLI, grok.com login';
  let err: string | null = null;
  if (OLLAMA_MODEL) {
    labeler = `ollama local ${OLLAMA_MODEL}`;
    model = [OLLAMA_MODEL];
    try {
      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, format: SCHEMA, options: { temperature: 0 }, messages: [{ role: 'system', content: LABEL_SYSTEM }, { role: 'user', content: user }] }),
        signal: AbortSignal.timeout(600_000),
      });
      const body: any = await res.json();
      so = JSON.parse(body?.message?.content ?? 'null');
    } catch (e) {
      err = String(e);
    }
  } else {
    const r = spawnSync('grok', ['-m', MODEL, '--cwd', sandbox, '--max-turns', '1', '--disable-web-search', '--deny', 'run_terminal_command', '--permission-mode', 'plan', '--system-prompt-override', LABEL_SYSTEM, '--json-schema', JSON.stringify(SCHEMA), '-p', user], { cwd: sandbox, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 360_000, maxBuffer: 64e6 });
    let out: any = null;
    try { out = JSON.parse(r.stdout ?? ''); } catch { /* recorded */ }
    so = out?.structuredOutput;
    model = Object.keys(out?.modelUsage ?? {});
    // Keep only the error message, never the CLI's working-folder path.
    if (!so) err = `exit ${r.status} | ${String(out?.message ?? r.stderr ?? '').slice(0, 300)}`;
  }
  const ok = so && ['correct', 'wrong', 'misleading'].includes(so.label) && typeof so.reason === 'string';
  appendFileSync(OUT, JSON.stringify({
    id: it.id,
    labeler,
    model,
    label: ok ? so.label : null,
    reason: ok ? so.reason : null,
    latency_ms: Date.now() - t0,
    error: ok ? null : err ?? 'unusable label output',
  }) + '\n');
  console.log(`${it.id} -> ${ok ? so.label : 'NO LABEL'}`);
}
console.log('finished');
