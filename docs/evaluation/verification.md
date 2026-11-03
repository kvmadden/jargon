# Verification record

Full logs are kept in a local evidence home outside the repository. Committed log copies trim trailing blank lines, and show `<repo>` and `<tmp>` in place of local checkout and temporary folder paths. This document carries the portable commands and key assertions for PR review.

## Scope and provenance

- Worktree began exactly at `origin/main` commit `2db6bcffb674c13df67a0c7926f5784541fd584c`.
- Fetched `origin/main` and inspected `git ls-tree` and `git grep` for verifier and evaluation capability. Open PRs were empty. No competing verifier implementation was found.
- Frozen synthetic generation commit: `46d879b`. Runtime implementation commit before held-out evaluation: `62925e1`. Subsequent edits to that module's handler import position and version comment are explanatory only. The policy was not tuned after the held-out evaluation.
- Original dated results, metadata, summary and review have no diff against the control. No paid API, hosted backend, deployment or merge was used.

## RED then GREEN

With a pass-through claim check, ran:

```sh
npm test -- src/lib/personalize-claim-check.test.ts
```

Exit 1, six failed and one passed. The five original misses failed at this assertion:

```text
expect(result.overall, id).toBe('fail')
Expected: "fail"
Received: "pass"
```

The sixth failing assertion expected the risky example sentence to produce at least one hold reason. `red.log` preserves the assertion failures.

After implementation and the shared-parser test, ran:

```sh
npm test -- src/lib/personalize-claim-check.test.ts src/lib/prompt-version-sync.test.ts
```

Exit 0, nine passed in two files. Tests exercise the saved five misses, unchanged ordinary text, preservation of model rejection, all-field checking, parser failure, corrected retry text and cache-version synchronization. `green.log` preserves the result.

## Untouched control parity

Created a fresh clone in a temporary folder, without sibling repositories:

```sh
git clone --no-local --branch main <local-clone> <tmp>/jargon-control-yvy4toto
npm ci --ignore-scripts=false
```

Both commands exited 0. Lifecycle scripts were enabled. Node `v24.14.1`, npm lockfile unchanged. Both control and candidate have lockfile SHA-256 `2cd285d0c457aba21001488a2d78877fa07f8baecca648fa006745403d082322`. The workspace root variables were removed from the environment for both sets of gate commands. The exact control was cleaned up after preserving evidence.

The full repository gate is `npm run pre-deploy`, which runs the auth-gate tests, TypeScript/Vite build, full Vitest suite, version synchronization and source checks. The ACL test was also attempted on both trees.

| Command | Untouched control | Candidate |
| --- | --- | --- |
| `npm run pre-deploy` | Exit 1, build passed, 1102 tests passed and 1 failed | Exit 1, build passed, 1110 tests passed and the same 1 failed |
| `npm run test:ai-spend-acl` | Exit 1, PostgreSQL 17 prerequisite missing | Exit 1, same prerequisite missing |

Candidate-only failures: none. The full gate is red on both trees. Full control, candidate, RED and GREEN logs are committed under [verification-logs](verification-logs/).

The baseline failure is `src/App.test.tsx > checkAndRefillStreakFreezes > does not refill when already in the same calendar month`, with `expected true to be false` at line 83. It is unrelated to verifier behavior. The ACL command exits with `PostgreSQL 17 is required (set PG_BIN to its bin directory).` No prerequisite was bypassed and no red gate is described as green.

## Additional verification

```sh
./node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --module esnext --target es2022 --skipLibCheck supabase/functions/personalize-term/claim-check.ts
node --check scripts/capture-portfolio.mjs
node --check eval/replay-claim-check.ts
node --check eval/run-personalize-eval.ts
node eval/replay-claim-check.ts
node scripts/capture-portfolio.mjs
git diff --check
```

All exited 0. Replay hashes and full row-level decisions are committed. Light presentation captures were rendered and inspected at 1440x900, 430x932 and 390x844. The original/rewrite toggle works by keyboard, visible interactive targets measure at least 44 by 44 pixels, there is no horizontal overflow and no page error. Capture geometry is committed in `docs/media/capture-checks.json`. The existing mobile feedback overlay can overlap lower content. The app itself retains its existing dark palette.

No whole-suite Playwright run or Deno deployment test was performed. The capture exercises the current browser flow with synthetic mocks and is not an end-to-end test of live inference.

## Remaining gates

Faithful LLM before/after runs on both datasets remain unmeasured under the no-paid-API constraint. Seven additional historical holds need expert adjudication. Four synthetic false rejections and four misses are published without tuning the frozen set. This is a draft for review, not a release recommendation.

## November 1 review follow-up

The calendar refill defect is fixed with frozen local-month regression tests. PostgreSQL 17 ACL checks were rerun using the available local toolchain. The original verification record above remains historical. See [review-fix verification](review-fixes.md) for current commands and results, and [release decisions](release-decisions.md) for the unresolved expert review and authorized inference gates. Both PRs remain HOLD.
