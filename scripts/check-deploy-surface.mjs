#!/usr/bin/env node
// Guard the deploy docs/scripts against drifting behind the actual Supabase
// surface. This is intentionally local-only: it never reads secrets, never
// calls Supabase, and never deploys anything.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const failures = [];

function fail(message) {
  failures.push(message);
}

function parseFunctionArray(scriptPath) {
  const src = readFileSync(join(ROOT, scriptPath), 'utf8');
  const match = src.match(/FUNCTIONS=\(\n([\s\S]*?)\n\)/);
  if (!match) {
    fail(`${scriptPath}: missing FUNCTIONS array`);
    return [];
  }
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .sort();
}

function expectSame(label, actual, expected) {
  const actualText = actual.join('\n');
  const expectedText = expected.join('\n');
  if (actualText !== expectedText) {
    fail(
      `${label}: deploy function list drift\nexpected:\n${expectedText}\nactual:\n${actualText}`,
    );
  }
}

const functionNames = readdirSync(join(ROOT, 'supabase/functions'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
  .map((entry) => entry.name)
  .sort();

for (const scriptPath of ['scripts/deploy-everything.sh', 'scripts/deploy-edge-functions.sh']) {
  expectSame(scriptPath, parseFunctionArray(scriptPath), functionNames);
}

const migrationNumbers = readdirSync(join(ROOT, 'supabase/schema-history'))
  .map((name) => name.match(/^cloud-migration-(\d+)\.sql$/)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);
const latestMigration = migrationNumbers.at(-1);
const migrationRange = `002 → ${String(latestMigration).padStart(3, '0')}`;

const checklist = readFileSync(join(ROOT, 'DEPLOY-CHECKLIST.md'), 'utf8');
if (!checklist.includes(`Apply migrations ${migrationRange}`)) {
  fail(`DEPLOY-CHECKLIST.md: missing current migration range "${migrationRange}"`);
}
if (!checklist.includes(`Deploy all ${functionNames.length} Edge Functions`)) {
  fail(`DEPLOY-CHECKLIST.md: missing current edge-function count ${functionNames.length}`);
}
for (const fn of functionNames) {
  if (!checklist.includes(fn)) {
    fail(`DEPLOY-CHECKLIST.md: missing function name "${fn}"`);
  }
}

const deployEverything = readFileSync(join(ROOT, 'scripts/deploy-everything.sh'), 'utf8');
for (const secret of [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'JARGON_SITE_ORIGINS',
  'JARGON_SITE_URL',
]) {
  if (!deployEverything.includes(secret)) {
    fail(`scripts/deploy-everything.sh: missing secret "${secret}"`);
  }
  if (!checklist.includes(secret)) {
    fail(`DEPLOY-CHECKLIST.md: missing secret "${secret}"`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`✗ deploy surface drift (${failures.length})\n`);
  for (const failure of failures) {
    process.stderr.write(`\n- ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `✓ deploy surface matches ${functionNames.length} edge functions and migrations ${migrationRange}\n`,
);
