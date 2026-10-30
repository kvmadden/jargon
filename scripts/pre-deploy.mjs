#!/usr/bin/env node
// Pre-deploy sanity gate for jargon.
//
// Runs everything that should pass before you apply migrations + deploys
// Edge Functions. Catches the failure modes that chat reviewers flag in code
// review but slip through if you skip the review (PROMPT_VERSION drift,
// banned patterns, missing migration numbers, etc.).
//
// Usage:  npm run pre-deploy
//
// Exits 0 if everything looks good for deploy. Exits 1 with a labeled
// failure block otherwise — never silent.

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectEdgeFunctionAuth } from './pre-deploy-auth-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}
function ok(msg) {
  process.stdout.write(`  ✓ ${msg}\n`);
}
function step(label) {
  process.stdout.write(`\n→ ${label}\n`);
}

// ─── 1. Build ───────────────────────────────────────────────────────────────
step('build (tsc + vite)');
try {
  execSync('npm run build', { cwd: ROOT, stdio: 'pipe' });
  ok('build clean');
} catch (err) {
  fail(`build failed:\n${err.stdout?.toString() ?? ''}\n${err.stderr?.toString() ?? ''}`);
}

// ─── 2. Tests ───────────────────────────────────────────────────────────────
step('vitest');
try {
  const out = execSync('npm test -- --run', { cwd: ROOT, stdio: 'pipe' }).toString();
  // Pull the summary line for the success log
  const summary = out.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/);
  if (summary) ok(`${summary[1]}/${summary[2]} tests passed`);
  else ok('tests passed (no summary line found)');
} catch (err) {
  fail(`vitest failed:\n${err.stdout?.toString() ?? ''}\n${err.stderr?.toString() ?? ''}`);
}

// ─── 3. PROMPT_VERSION sync ─────────────────────────────────────────────────
step('PROMPT_VERSION sync (client ↔ Edge Function)');
try {
  const dataTs = readFileSync(join(ROOT, 'src/lib/data.ts'), 'utf8');
  const edgeFn = readFileSync(join(ROOT, 'supabase/functions/personalize-term/index.ts'), 'utf8');
  const clientMatch = dataTs.match(/export const CURRENT_PROMPT_VERSION\s*=\s*(\d+)/);
  const serverMatch = edgeFn.match(/^const PROMPT_VERSION\s*=\s*(\d+)\s*;/m);
  if (!clientMatch) fail('CURRENT_PROMPT_VERSION not found in src/lib/data.ts');
  else if (!serverMatch) fail('PROMPT_VERSION not found in supabase/functions/personalize-term/index.ts');
  else if (clientMatch[1] !== serverMatch[1]) {
    fail(`PROMPT_VERSION drift: client=${clientMatch[1]} server=${serverMatch[1]}`);
  } else {
    ok(`both at ${clientMatch[1]}`);
  }
} catch (err) {
  fail(`PROMPT_VERSION check failed: ${err.message}`);
}

// ─── 4. Migration numbering — no gaps in 002..NNN ───────────────────────────
step('cloud-migration numbering (no gaps)');
try {
  const files = readdirSync(join(ROOT, 'supabase/schema-history'))
    .filter((f) => /^cloud-migration-\d+\.sql$/.test(f))
    .map((f) => Number(f.match(/^cloud-migration-(\d+)\.sql$/)[1]))
    .sort((a, b) => a - b);
  if (files.length === 0) {
    fail('no cloud-migration-*.sql files found');
  } else {
    const min = files[0];
    const max = files[files.length - 1];
    const expected = [];
    for (let n = min; n <= max; n++) expected.push(n);
    const missing = expected.filter((n) => !files.includes(n));
    if (missing.length > 0) {
      fail(`missing migrations between ${min} and ${max}: ${missing.join(', ')}`);
    } else {
      ok(`${min}…${max} (${files.length} migrations, no gaps)`);
    }
  }
} catch (err) {
  fail(`migration check failed: ${err.message}`);
}

// ─── 5. Banned patterns in Edge Functions ───────────────────────────────────
step('banned patterns (Promise.race in Anthropic call paths, hardcoded email)');
try {
  const fnDir = join(ROOT, 'supabase/functions');
  const fnFiles = readdirSync(fnDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => join(fnDir, d.name, 'index.ts'));

  for (const path of fnFiles) {
    const src = readFileSync(path, 'utf8');
    const fnName = path.split('/').slice(-2, -1)[0];

    // Promise.race is banned in Anthropic call paths (B+1.3 postmortem —
    // doesn't actually cancel the in-flight HTTP request). The single
    // documented exception is send-gift-invite's admin-invite call (the
    // Supabase admin SDK doesn't accept a signal). All Anthropic calls
    // MUST use AbortController + { signal }.
    //
    // Skip comments — most Promise.race mentions in this codebase are
    // descriptive ("NEVER Promise.race") not actual calls. Real banned
    // uses are `Promise.race([...])` on an executable line.
    const lines = src.split('\n');
    const hasAnthropic = /anthropic\.messages\.create/i.test(src);
    if (hasAnthropic) {
      const raceLines = lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => {
          // Strip the comment portion before scanning. A line is "code"
          // if `Promise.race` appears before any `//` or it's outside a
          // /* ... */ block. We don't track multi-line block-comment state
          // perfectly, but the simple `//` check kills the common case.
          const codePart = l.split('//')[0];
          if (!/\bPromise\.race\b/.test(codePart)) return false;
          // Reject lines that are inside a /** ... */ JSDoc block (start
          // with whitespace + `*`).
          if (/^\s*\*/.test(l)) return false;
          return true;
        });
      if (raceLines.length > 0) {
        fail(
          `${fnName}/index.ts: Promise.race in an Anthropic-using function (banned per project convention). Lines: ${raceLines
            .map(({ i }) => i + 1)
            .join(', ')}`,
        );
      }
    }

    // Hardcoded ALLOWED_EMAIL was replaced by the dynamic `allowed_users`
    // table in B+1.4-B. Any lingering reference outside _shared/allowlist.ts
    // means an Edge Function is short-circuiting the dynamic gate.
    if (
      /['"]owner@example\.com['"]/.test(src) &&
      !path.endsWith('_shared/allowlist.ts')
    ) {
      warn(`${fnName}/index.ts: hardcoded 'owner@example.com' (use isAllowlisted instead)`);
    }
  }

  ok('Edge Functions scanned');
} catch (err) {
  fail(`banned-patterns check failed: ${err.message}`);
}

// ─── 6. JWT + isAllowlisted gate present in every Edge Function ─────────────
step('auth gate (JWT + isAllowlisted) in every Edge Function');
try {
  const fnDir = join(ROOT, 'supabase/functions');
  const fnFiles = readdirSync(fnDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => ({ name: d.name, path: join(fnDir, d.name, 'index.ts') }));

  for (const { name, path } of fnFiles) {
    const src = readFileSync(path, 'utf8');
    for (const finding of inspectEdgeFunctionAuth(name, src).findings) {
      fail(`${name}/index.ts: ${finding}`);
    }
  }

  ok(`${fnFiles.length} Edge Functions checked`);
} catch (err) {
  fail(`auth-gate check failed: ${err.message}`);
}

// ─── 7. Domain registry drift (TS ↔ Deno sides) ─────────────────────────────
step('domain registry sync (TS ↔ Deno: vocabulary, goals, paths)');
try {
  // Extract every domain key from the TS-side DOMAIN_META block. The block
  // starts with `export const DOMAIN_META: Record<Domain, DomainMeta> = {`
  // and ends at the matching closing `};` — pull the contents and grep for
  // top-level `<key>:` entries.
  const tsRegistry = readFileSync(join(ROOT, 'src/lib/domains.ts'), 'utf8');
  // Anchor on the actual `export const DOMAIN_META` declaration so we don't
  // pick up the literal "DOMAIN_META" text inside earlier code comments
  // (which would swallow the DomainMeta interface body and falsely flag
  // every interface field as a "domain key" — the original gate-7 bug).
  const tsBlock = tsRegistry.match(/^export const DOMAIN_META[^{]+\{([\s\S]+?)^\};/m);
  const tsKeys = new Set();
  if (tsBlock) {
    const keyRegex = /^  (\w+):\s*\{/gm; // 2-space indent inside the registry
    let m;
    while ((m = keyRegex.exec(tsBlock[1])) !== null) {
      tsKeys.add(m[1]);
    }
  }

  // Extract domain keys from each Deno-side lookup. Same shape: top-level
  // `<key>:` entries inside a `<NAME>_BY_DOMAIN: Record<string, ...> = {`.
  function denoKeys(filePath, mapName) {
    const src = readFileSync(filePath, 'utf8');
    const block = src.match(new RegExp(`${mapName}[^{]+\\{([\\s\\S]+?)^\\};`, 'm'));
    if (!block) return new Set();
    const keys = new Set();
    const keyRegex = /^  (\w+):/gm;
    let m;
    while ((m = keyRegex.exec(block[1])) !== null) {
      keys.add(m[1]);
    }
    return keys;
  }

  const denoVocabKeys = denoKeys(
    join(ROOT, 'supabase/functions/_shared/domain-vocabulary.ts'),
    'VOCABULARY_BY_DOMAIN',
  );
  const denoGoalKeys = denoKeys(
    join(ROOT, 'supabase/functions/_shared/domain-goals.ts'),
    'GOALS_BY_DOMAIN',
  );
  const denoPathKeys = denoKeys(
    join(ROOT, 'supabase/functions/_shared/domain-paths.ts'),
    'PATHS_BY_DOMAIN',
  );
  // B+1.8 — also cross-check the DomainGroup mirror.
  const denoGroupKeys = denoKeys(
    join(ROOT, 'supabase/functions/_shared/domain-groups.ts'),
    'GROUP_BY_DOMAIN',
  );

  if (tsKeys.size === 0) {
    warn('TS DOMAIN_META parse: no keys found (regex may need updating)');
  } else {
    const lookups = [
      ['vocabulary', denoVocabKeys],
      ['goals', denoGoalKeys],
      ['paths', denoPathKeys],
      ['groups', denoGroupKeys],
    ];
    let driftFound = false;
    for (const [name, denoSide] of lookups) {
      if (denoSide.size === 0) {
        warn(`${name} Deno lookup parse: no keys found (regex may need updating)`);
        continue;
      }
      for (const key of tsKeys) {
        if (!denoSide.has(key)) {
          fail(`${name} drift: domain '${key}' in TS registry but not in Deno lookup`);
          driftFound = true;
        }
      }
      for (const key of denoSide) {
        if (!tsKeys.has(key)) {
          fail(`${name} drift: domain '${key}' in Deno ${name} lookup but not in TS registry`);
          driftFound = true;
        }
      }
    }
    if (!driftFound) {
      ok(`${tsKeys.size} domain(s) keyed in all 4 Deno lookups (vocab + goals + paths + groups)`);
      // Content drift is asserted by the vitest suite (see
      // domain-vocabulary-deno-side.test.ts). Gate-2 (vitest) runs first
      // in this script, so by the time gate-7 fires successfully the
      // tests have ALREADY confirmed byte-identical content. Gate-7
      // itself only checks key presence — relying on gate-2 for content.
      ok('content drift gated upstream by gate-2 (vitest)');
    }
  }
} catch (err) {
  fail(`domain registry sync check failed: ${err.message}`);
}

// ─── 8. No console.log in production src/ (warnings only) ───────────────────
step('console.log scan (production src/ + Edge Functions)');
try {
  // B+1.5.8: scan extended to supabase/functions/. Edge Function code
  // runs in Deno and writes to function logs — console.log is fine
  // there but worth flagging if it shows up unexpectedly. console.error
  // and console.warn are common + intentional in Edge Functions, so we
  // only flag the bare `console.log` form.
  const out = execSync(
    `grep -rn 'console\\.log' src supabase/functions --include='*.ts' --include='*.tsx' || true`,
    { cwd: ROOT },
  )
    .toString()
    .trim();
  if (out.length > 0) {
    const matches = out.split('\n').filter((l) => !l.includes('.test.ts'));
    if (matches.length > 0) {
      warn(`${matches.length} console.log call(s) in production code (review before deploy):\n    ${matches.slice(0, 5).join('\n    ')}${matches.length > 5 ? `\n    … +${matches.length - 5} more` : ''}`);
    } else {
      ok('no console.log outside tests');
    }
  } else {
    ok('no console.log in src/ or supabase/functions/');
  }
} catch (err) {
  warn(`console.log scan failed: ${err.message}`);
}

// ─── Final verdict ──────────────────────────────────────────────────────────
process.stdout.write('\n');
if (warnings.length > 0) {
  process.stdout.write(`⚠  ${warnings.length} warning(s):\n`);
  for (const w of warnings) process.stdout.write(`   - ${w}\n`);
}
if (failures.length > 0) {
  process.stderr.write(`\n✗ ${failures.length} blocker(s):\n`);
  for (const f of failures) process.stderr.write(`   - ${f}\n`);
  process.stderr.write('\nFix blockers and re-run before deploy.\n');
  process.exit(1);
}
process.stdout.write('\n✓ ready to deploy.\n');
process.exit(0);
