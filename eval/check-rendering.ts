// Runs the claim gate on one rendering, with no model call.
//
//   node eval/check-rendering.ts --term bi-rls --profile nurse --rendering my-rewrite.json [--analogy]
//
// --rendering   JSON file with long_definition, why_it_matters, example_in_sentence
// --term        term id. The canonical entry is read from supabase/seed.sql (the
//               corrected text), or from --terms <file> when given.
// --profile     profile id from eval/data/profiles.json, or --profiles <file>
// --analogy     the verifier said the rewrite uses an analogy
//
// Prints the gate result as JSON. Exit code 0 = pass, 3 = needs_review, 4 = revise,
// 2 = bad arguments.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRendering } from '../supabase/functions/personalize-term/claim-gate.ts';
import { APPROVED_ANALOGIES } from '../supabase/functions/personalize-term/approved-analogies.ts';
// @ts-expect-error plain .mjs module
import { parseTermInserts, uniqueById } from '../scripts/lib/seed-terms.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const fail = (msg: string) => {
  console.error(msg);
  process.exit(2);
};

const termId = arg('--term') ?? fail('missing --term');
const profileId = arg('--profile') ?? fail('missing --profile');
const renderingPath = arg('--rendering') ?? fail('missing --rendering');

const termsFile = arg('--terms');
const term = termsFile
  ? JSON.parse(readFileSync(resolve(process.cwd(), termsFile), 'utf8')).terms.find((t: any) => t.id === termId)
  : uniqueById(parseTermInserts(readFileSync(join(ROOT, 'supabase/seed.sql'), 'utf8'))).get(termId);
if (!term) fail(`unknown term ${termId}`);

const profilesPath = arg('--profiles') ?? join(ROOT, 'eval/data/profiles.json');
const profile = JSON.parse(readFileSync(resolve(process.cwd(), profilesPath), 'utf8')).profiles.find((p: any) => p.id === profileId);
if (!profile) fail(`unknown profile ${profileId}`);

const rendering = JSON.parse(readFileSync(resolve(process.cwd(), renderingPath), 'utf8'));
for (const f of ['long_definition', 'why_it_matters', 'example_in_sentence']) {
  if (typeof rendering[f] !== 'string') fail(`rendering is missing ${f}`);
}

const result = checkRendering({
  term,
  rendering,
  profile,
  verdict: { uses_analogy: process.argv.includes('--analogy') },
  approvedAnalogies: APPROVED_ANALOGIES,
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.decision === 'pass' ? 0 : result.decision === 'needs_review' ? 3 : 4);
