#!/usr/bin/env node
// Subscription-based terms backfill script via the `claude` CLI (your subscription).
// Brings every (domain, path) combination up to a 30-term baseline.
//
// Usage: node scripts/generate-terms-subscription.mjs [--target N] [--batch N] [--domain D] [--path P]
// Env (from .env.local / .env): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

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
  console.error('✗ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local');
  process.exit(1);
}
const TERMS_URL = `${SUPABASE_URL}/rest/v1/terms`;

function numArg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
}
function strArg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const TARGET_BASELINE = numArg('--target', 30);
const BATCH_SIZE = numArg('--batch', 6);
const FILTER_DOMAIN = strArg('--domain', null);
const FILTER_PATH = strArg('--path', null);

const DOMAIN_META = {
  coding: {
    label: 'coding',
    vocabularyDescription: 'dev/AI/enterprise software',
    paths: [
      'git-cli', 'dev-concepts', 'enterprise', 'claude-code', 'ai-engineering',
      'agile', 'systems', 'programming', 'dev-tooling', 'dev-workflow', 'web-api',
      'databases', 'computing', 'networking', 'security', 'architecture',
      'systems-engineering', 'cloud-devops', 'qa-reliability', 'math-logic',
      'tech-stack', 'enterprise-platforms', 'data-analytics'
    ],
    goalDescription: `Goal A: Follow Claude Code in real time — recognize words like rebase, monorepo, context window, RAG, idempotent that appear mid-CLI session
Goal B: Talk to coding-masters family members — drop tool call, embedding, sprint retro, feature flag, blast radius into family text threads naturally`
  },
  ai: {
    label: 'ai',
    vocabularyDescription: 'modern AI tools and concepts',
    paths: [
      'ai-foundations', 'ai-tools', 'ai-prompting', 'ai-products', 'ai-evaluation', 'ai-policy'
    ],
    goalDescription: `Goal A: Follow modern AI in real time — recognize words like RAG, embedding, agent, fine-tuning, hallucination as they come up in articles, tools, and product launches
Goal B: Talk shop with engineers and AI-builders — drop tool call, context window, prompt engineering, retrieval into conversations naturally`
  }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function claude(prompt) {
  return new Promise((resolve, reject) => {
    const child = execFile('claude', ['-p', prompt], { maxBuffer: 10 * 1024 * 1024, timeout: 240000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
    child.stdin?.end();
  });
}

function parseJson(text) {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstArr = s.indexOf('[');
  const lastArr = s.lastIndexOf(']');
  const firstObj = s.indexOf('{');
  const lastObj = s.lastIndexOf('}');

  if (firstArr >= 0 && (firstObj < 0 || firstArr < firstObj) && lastArr > firstArr) {
    return JSON.parse(s.slice(firstArr, lastArr + 1));
  } else if (firstObj >= 0 && lastObj > firstObj) {
    return JSON.parse(s.slice(firstObj, lastObj + 1));
  }
  return JSON.parse(s);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchAllTerms() {
  const url = `${TERMS_URL}?select=id,term,path,domain,prerequisites,related_terms&order=path.asc,id.asc`;
  const r = await fetch(url, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`terms fetch ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

async function insertTerm(row) {
  const r = await fetch(TERMS_URL, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`insert term ${row.id} ${r.status}: ${errText.slice(0, 200)}`);
  }
}

async function deleteTerm(id) {
  const r = await fetch(`${TERMS_URL}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`delete term ${id} ${r.status}: ${errText.slice(0, 200)}`);
  }
}

function buildGeneratePrompt(domainKey, pathId, neededCount, existingTerms, inRunTerms) {
  const meta = DOMAIN_META[domainKey];
  const avoidList = [...existingTerms, ...inRunTerms].join(', ');
  return `You are generating technical vocabulary terms for Jargon, a spaced-repetition learning platform.
Brand / Voice: side reaction brand (lowercase where natural, plainspoken, conversational, zero marketing fluff, no words like "innovative", "solution", "product", "platform", "leverage", "seamlessly").

Domain: ${domainKey} (${meta.vocabularyDescription})
Path: ${pathId}

Domain Stated Goals:
${meta.goalDescription}

EXISTING TERMS IN THIS PATH (DO NOT DUPLICATE ANY OF THESE):
${avoidList.length > 0 ? avoidList : '(none yet)'}

Generate EXACTLY ${neededCount} NEW, distinct vocabulary terms for the path "${pathId}" in the "${domainKey}" domain.

VOCABULARY DISCIPLINE (CRITICAL):
- Explanations must be plainspoken and accessible to a learner who does not already know high-level jargon.
- In long_definition, why_it_matters, and example_in_sentence: do NOT use unexplained in-domain technical jargon. If you mention another technical term, either define it inline parenthetically (e.g. "merging combines two branches (a branch is a separate line of work)...") or stick to plain English.

FIELD REQUIREMENTS PER TERM (JSON ARRAY ITEM):
- term: the short canonical term name as a real practitioner says it (e.g. "canary deployment", "prompt injection")
- difficulty: 1 (intro), 2 (intermediate), or 3 (advanced/stretch)
- one_line_definition: 1 concise sentence (<= 25 words), technically accurate, plain English
- long_definition: 2-4 sentences expanding the one-liner with real mechanism and context
- example_in_sentence: a natural sentence a practitioner would say in real work (lowercase where natural)
- why_it_matters: 1-3 sentences grounded in the domain's goals above
- multiple_choice_distractors: an array of EXACTLY 3 plausible-but-wrong definition strings
- use_in_sentence_prompt: clear instruction telling the learner how to use the term in a sentence
- fill_in_blank_sentence: copy of example_in_sentence with the term token replaced by "___"
- etymology: 1-2 sentences on the origin of the term's NAME (why it's called what it's called). Ground in fact; if origin is obscure, state honestly (e.g. "the origin isn't well documented; it's the conventional label").
- source: "ai-generated"

Return ONLY a valid JSON array of objects with the fields above and NOTHING ELSE. No preamble, no postscript.`;
}

function buildVerifyPrompt(domainKey, pathId, candidates) {
  const meta = DOMAIN_META[domainKey];
  return `You are an adversarial accuracy and quality verifier for Jargon candidate terms.

Domain: ${domainKey} (${meta.vocabularyDescription})
Path: ${pathId}

Review the following candidate terms:
${JSON.stringify(candidates, null, 2)}

Check EACH candidate against these strict quality criteria:
1. Factual accuracy: definition and example are 100% accurate for the ${domainKey} domain.
2. Vocabulary discipline: body text (long_definition, why_it_matters, example_in_sentence) does NOT drop unexplained in-domain jargon without inline parenthetical definition or plain English explanation.
3. Relevance: genuinely useful term for a learner in the "${pathId}" path.
4. Distractors: multiple_choice_distractors has EXACTLY 3 items that are plausible but clearly wrong (not subtle true synonyms).
5. Fill-in-blank: fill_in_blank_sentence contains "___" replacing the term.
6. Voice: lowercase where natural, plainspoken, zero marketing puff.

For EACH candidate, return an item in a JSON array in this exact shape:
[
  {
    "term": "<term name>",
    "status": "pass" | "fix" | "reject",
    "reason": "<short 1-sentence reasoning>",
    "fixed_candidate": null | <corrected full candidate object if status is fix>
  }
]

Rules:
- If a candidate is good as-is: status = "pass", fixed_candidate = null.
- If a candidate has a minor fixable issue (e.g. missing ___ in fill_in_blank, small typo, minor jargon violation fixable by rephrasing): status = "fix", fixed_candidate = <full corrected candidate object>.
- If a candidate is fundamentally inaccurate, wrong domain, or unfixable: status = "reject", fixed_candidate = null.

Return ONLY a valid JSON array of verification result objects and NOTHING ELSE.`;
}

async function main() {
  console.log(`→ querying terms from Supabase REST (${TERMS_URL})…`);
  const initialTerms = await fetchAllTerms();
  console.log(`  loaded ${initialTerms.length} existing terms.`);

  const existingIds = new Set(initialTerms.map((t) => t.id));
  const existingTermsByPath = new Map();
  const initialCounts = new Map();

  for (const domainKey of Object.keys(DOMAIN_META)) {
    for (const pathId of DOMAIN_META[domainKey].paths) {
      const key = `${domainKey}:${pathId}`;
      existingTermsByPath.set(key, []);
      initialCounts.set(key, 0);
    }
  }

  for (const t of initialTerms) {
    const domainKey = t.domain || 'coding';
    const key = `${domainKey}:${t.path}`;
    if (!initialCounts.has(key)) {
      initialCounts.set(key, 0);
      existingTermsByPath.set(key, []);
    }
    initialCounts.set(key, initialCounts.get(key) + 1);
    if (typeof t.term === 'string' && t.term.trim()) {
      existingTermsByPath.get(key).push(t.term.trim().toLowerCase());
    }
  }

  const pathDeficits = [];
  for (const [key, count] of initialCounts.entries()) {
    const [domainKey, pathId] = key.split(':');
    if (FILTER_DOMAIN && domainKey !== FILTER_DOMAIN) continue;
    if (FILTER_PATH && pathId !== FILTER_PATH) continue;
    const deficit = Math.max(0, TARGET_BASELINE - count);
    if (deficit > 0) {
      pathDeficits.push({ domainKey, pathId, count, deficit });
    }
  }

  console.log(`\n═══ DEFICIT SUMMARY ═══`);
  console.log(`  target baseline per path: ${TARGET_BASELINE}`);
  console.log(`  paths requiring backfill: ${pathDeficits.length}`);
  let totalNeeded = 0;
  for (const d of pathDeficits) {
    console.log(`  - [${d.domainKey}] ${d.pathId}: current ${d.count} → need +${d.deficit}`);
    totalNeeded += d.deficit;
  }
  console.log(`  total new terms needed: ${totalNeeded}\n`);

  if (pathDeficits.length === 0) {
    console.log('✓ all paths are already at or above baseline!');
    return;
  }

  let totalWritten = 0;
  let totalRejected = 0;
  let totalFixed = 0;

  for (let pIdx = 0; pIdx < pathDeficits.length; pIdx++) {
    const { domainKey, pathId, deficit } = pathDeficits[pIdx];
    const key = `${domainKey}:${pathId}`;
    const existingTerms = existingTermsByPath.get(key) || [];
    const inRunTerms = [];

    let remainingDeficit = deficit;
    console.log(`\n─── [${pIdx + 1}/${pathDeficits.length}] ${domainKey} / ${pathId} (needed: ${deficit}) ───`);

    let attempts = 0;
    while (remainingDeficit > 0 && attempts < 5) {
      attempts++;
      const batchCount = Math.min(remainingDeficit, BATCH_SIZE);
      console.log(`  → batch of ${batchCount} terms (remaining needed: ${remainingDeficit})`);

      let rawGen;
      try {
        const prompt = buildGeneratePrompt(domainKey, pathId, batchCount, existingTerms, inRunTerms);
        rawGen = await claude(prompt);
      } catch (err) {
        console.error(`    ✗ generator CLI call failed: ${err.message.slice(0, 100)}`);
        await sleep(3000);
        continue;
      }

      let generatedBatch;
      try {
        generatedBatch = parseJson(rawGen);
        if (!Array.isArray(generatedBatch)) throw new Error('output is not a JSON array');
      } catch (err) {
        console.error(`    ✗ failed to parse generator output: ${err.message.slice(0, 100)}`);
        await sleep(2000);
        continue;
      }

      await sleep(1500);

      console.log(`    → verifying ${generatedBatch.length} generated candidate(s) via adversarial pass…`);
      let rawVer;
      try {
        const verifyPrompt = buildVerifyPrompt(domainKey, pathId, generatedBatch);
        rawVer = await claude(verifyPrompt);
      } catch (err) {
        console.error(`    ✗ verifier CLI call failed: ${err.message.slice(0, 100)}`);
        await sleep(3000);
        continue;
      }

      let verificationResults;
      try {
        verificationResults = parseJson(rawVer);
        if (!Array.isArray(verificationResults)) throw new Error('verifier output is not a JSON array');
      } catch (err) {
        console.error(`    ✗ failed to parse verifier output: ${err.message.slice(0, 100)}`);
        await sleep(2000);
        continue;
      }

      const verMap = new Map();
      for (const res of verificationResults) {
        if (res && res.term) {
          verMap.set(String(res.term).trim().toLowerCase(), res);
        }
      }

      let insertedInBatch = 0;
      for (const cand of generatedBatch) {
        if (!cand || !cand.term) continue;
        const termLower = String(cand.term).trim().toLowerCase();
        const ver = verMap.get(termLower) || { status: 'pass', reason: 'unmatched in verifier, defaulting to pass' };

        if (ver.status === 'reject') {
          console.log(`    ✗ REJECTED "${cand.term}": ${ver.reason}`);
          totalRejected++;
          continue;
        }

        let termObj = cand;
        if (ver.status === 'fix' && ver.fixed_candidate) {
          console.log(`    ⚡ FIXED "${cand.term}": ${ver.reason}`);
          termObj = ver.fixed_candidate;
          totalFixed++;
        }

        // Sanity checks on fields
        if (!termObj.fill_in_blank_sentence || !termObj.fill_in_blank_sentence.includes('___')) {
          termObj.fill_in_blank_sentence = (termObj.example_in_sentence || '').replace(
            new RegExp(termObj.term, 'gi'),
            '___'
          );
        }
        if (!Array.isArray(termObj.multiple_choice_distractors) || termObj.multiple_choice_distractors.length !== 3) {
          termObj.multiple_choice_distractors = [
            'an unrelated concept from a different area of technology',
            'a pattern that achieves the opposite result',
            'a deprecated approach that is no longer used'
          ];
        }

        // Build unique ID
        let candidateId = `${slugify(pathId)}-${slugify(termObj.term)}`;
        if (existingIds.has(candidateId)) {
          let suffix = 2;
          while (existingIds.has(`${candidateId}-${suffix}`)) suffix++;
          candidateId = `${candidateId}-${suffix}`;
        }

        const dbRow = {
          id: candidateId,
          term: termObj.term,
          pronunciation: termObj.pronunciation || null,
          path: pathId,
          domain: domainKey,
          difficulty: Number(termObj.difficulty) || 2,
          one_line_definition: termObj.one_line_definition,
          long_definition: termObj.long_definition,
          example_in_sentence: termObj.example_in_sentence,
          why_it_matters: termObj.why_it_matters,
          multiple_choice_distractors: termObj.multiple_choice_distractors,
          use_in_sentence_prompt: termObj.use_in_sentence_prompt,
          fill_in_blank_sentence: termObj.fill_in_blank_sentence,
          etymology: termObj.etymology || 'the name origin is the conventional industry label.',
          source: 'ai-generated',
          related_terms: Array.isArray(termObj.related_terms) ? termObj.related_terms : [],
          prerequisites: Array.isArray(termObj.prerequisites) ? termObj.prerequisites : [],
          stretch_term: termObj.stretch_term || null,
        };

        try {
          await insertTerm(dbRow);
          existingIds.add(candidateId);
          inRunTerms.push(termObj.term.trim().toLowerCase());
          insertedInBatch++;
          totalWritten++;
          remainingDeficit--;
          console.log(`    ✓ INSERTED "${termObj.term}" (${candidateId})`);
        } catch (err) {
          console.error(`    ✗ INSERT FAILED "${termObj.term}": ${err.message}`);
          totalRejected++;
        }
      }

      console.log(`  → batch finished: +${insertedInBatch} written`);
      await sleep(2000);
    }
  }

  console.log(`\n═══ POST-GENERATION VOCABULARY AUDIT GATE ═══`);
  console.log(`→ running scripts/audit-vocabulary.mjs…`);

  try {
    const auditOutput = await new Promise((resolve, reject) => {
      execFile('node', ['scripts/audit-vocabulary.mjs'], { cwd: ROOT }, (err, stdout, stderr) => {
        if (err) return reject(new Error(`Audit failed: ${stderr || err.message}`));
        resolve(stdout);
      });
    });
    console.log(auditOutput);
  } catch (err) {
    console.error(`✗ audit execution error: ${err.message}`);
  }

  // Final verification of per-path counts
  console.log(`\n═══ FINAL PER-PATH COUNTS ═══`);
  const finalTerms = await fetchAllTerms();
  const finalCounts = new Map();
  for (const t of finalTerms) {
    const key = `${t.domain || 'coding'}:${t.path}`;
    finalCounts.set(key, (finalCounts.get(key) || 0) + 1);
  }

  let underBaseline = 0;
  for (const domainKey of Object.keys(DOMAIN_META)) {
    for (const pathId of DOMAIN_META[domainKey].paths) {
      const key = `${domainKey}:${pathId}`;
      const count = finalCounts.get(key) || 0;
      const passStr = count >= TARGET_BASELINE ? '✓' : '✗ UNDER BASELINE';
      if (count < TARGET_BASELINE) underBaseline++;
      console.log(`  ${passStr} [${domainKey}] ${pathId.padEnd(22)}: ${count}`);
    }
  }

  console.log(`\n═════════════════════════════════════════════════`);
  console.log(`  Total terms written:  ${totalWritten}`);
  console.log(`  Total terms fixed:    ${totalFixed}`);
  console.log(`  Total terms rejected: ${totalRejected}`);
  console.log(`  Paths under baseline: ${underBaseline}`);
  console.log(`═════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error('\n✗ Fatal generation error:', err);
  process.exit(1);
});
