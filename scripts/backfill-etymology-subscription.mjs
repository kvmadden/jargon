#!/usr/bin/env node
// Etymology backfill via the `claude` CLI (your subscription) instead of the
// generate-term-etymology edge fn (which bills the Anthropic API). Free.
//
// For each term missing an etymology, asks claude for the NAMING origin ("why
// it's called that"), then writes terms.etymology directly via the Management
// REST API with the service-role key. Batched (fewer CLI calls) + concurrent +
// idempotent (re-run skips filled rows). Term contents never enter any other
// context — this script reads/writes them itself.
//
// Usage: node scripts/backfill-etymology-subscription.mjs [--limit N] [--batch N] [--conc N]
// Env (from .env.local): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadDotEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadDotEnv();

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1);
}
const TERMS_URL = `${SUPABASE_URL}/rest/v1/terms`;

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
};
const LIMIT = arg('--limit', Infinity);
const BATCH = arg('--batch', 12);
const CONC = arg('--conc', 3);

async function fetchTerms() {
  const url = `${TERMS_URL}?select=id,term,one_line_definition&etymology=is.null&order=id.asc`;
  const r = await fetch(url, { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` } });
  if (!r.ok) throw new Error(`terms fetch ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const rows = await r.json();
  return Number.isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;
}

function claude(prompt) {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', ['-p', prompt], { maxBuffer: 10 * 1024 * 1024, timeout: 180000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
    child.stdin?.end();
  });
}

// Robustly extract the JSON array from claude's reply (may be fenced / prefaced).
function parseArray(text) {
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  const arr = JSON.parse(s);
  if (!Array.isArray(arr)) throw new Error('not an array');
  return arr;
}

function buildPrompt(batch) {
  const list = batch.map((t) => `- id ${t.id} · "${t.term}" (means: ${t.one_line_definition || 'n/a'})`).join('\n');
  return `You're writing etymologies for jargon, a spaced-repetition app teaching technical vocabulary. Voice: lowercase, plainspoken, occasionally a little weird, never try-hard, no marketing fluff.

For EACH term below, write a SHORT etymology — the origin of the NAME, i.e. why it's called what it's called (NOT a definition of what it does). 1-2 sentences. Ground it in fact. If a term's naming origin is genuinely obscure or you aren't confident, write a brief honest line (e.g. "the name's origin isn't well documented — it's just the conventional label") instead of inventing a story. Keep each under ~240 characters.

Return ONLY a JSON array and nothing else, in this exact shape:
[{"id":"<the id verbatim>","etymology":"<the etymology text>"}]

Terms:
${list}`;
}

async function writeEtymology(id, etymology) {
  const r = await fetch(`${TERMS_URL}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify({ etymology, etymology_generated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`patch ${id} ${r.status}: ${(await r.text()).slice(0, 120)}`);
}

async function processBatch(batch, tag) {
  let out;
  try {
    out = await claude(buildPrompt(batch));
  } catch (e) {
    return { ok: 0, fail: batch.length, note: `${tag} claude error: ${e.message.slice(0, 80)}` };
  }
  let arr;
  try { arr = parseArray(out); } catch (e) {
    return { ok: 0, fail: batch.length, note: `${tag} parse error: ${e.message.slice(0, 80)}` };
  }
  const byId = new Map(arr.map((x) => [String(x.id), x.etymology]));
  let ok = 0, fail = 0;
  for (const t of batch) {
    const ety = byId.get(String(t.id));
    if (!ety || typeof ety !== 'string' || !ety.trim()) { fail++; continue; }
    try { await writeEtymology(t.id, ety.trim()); ok++; }
    catch { fail++; }
  }
  return { ok, fail, note: '' };
}

async function main() {
  process.stdout.write('→ fetching terms with etymology IS NULL\n');
  const terms = await fetchTerms();
  process.stdout.write(`  ${terms.length} term(s) · batch ${BATCH} · concurrency ${CONC}\n\n`);
  if (terms.length === 0) { process.stdout.write('✓ nothing to do.\n'); return; }

  const batches = [];
  for (let i = 0; i < terms.length; i += BATCH) batches.push(terms.slice(i, i + BATCH));

  let done = 0, ok = 0, fail = 0;
  const t0 = Date.now();
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const i = cursor++;
      const r = await processBatch(batches[i], `batch ${i + 1}/${batches.length}`);
      ok += r.ok; fail += r.fail; done++;
      const pct = String(Math.round((done / batches.length) * 100)).padStart(3, ' ');
      process.stdout.write(`  ${pct}%  batch ${String(i + 1).padStart(3)}/${batches.length}  +${r.ok} ok  ${r.fail ? `-${r.fail} miss` : ''} ${r.note}\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, batches.length) }, worker));

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  process.stdout.write(`\n──── done in ${secs}s ────\n  ✓ written ${ok}\n  ✗ missed  ${fail}\n`);
  if (fail > 0) process.stdout.write('  → re-run to pick up missed terms (idempotent).\n');
}

main().catch((e) => { console.error('\n✗', e); process.exit(1); });
