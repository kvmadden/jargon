# Review fixes verified November 1, 2026

PR #1 remains HOLD. PR #2 contains this production-policy dependency and must remain held with it. No paid inference, deployment or merge was performed.

## Changes and review routing

The refill guard compared the current local month with the UTC month prefix of a saved timestamp. Converting the timestamp through the existing local-date helper fixes repeat refills near UTC month boundaries. Date-only calendar markers retain their existing representation. The frozen tests cover Los Angeles, Tokyo and a local-month transition before the UTC transition.

The seven additional historical holds remain unadjudicated. [The release decision packet](release-decisions.md) lists every candidate ID and the required expert evidence. Kevin must authorize an inference path or supply authorized original-versus-candidate results using identical frozen inputs and candidates, including false acceptance, false rejection and retry/fallback outcomes. The no-spending instruction remains in force. Local gates do not establish model accuracy or regeneration quality.

Fetched origin before editing. Current main is `2db6bcffb674c13df67a0c7926f5784541fd584c`. Both remote PR heads still matched the reviewed heads, and both target main. Rechecked tree inventory and source and evaluation searches. Only the two original PRs and this review fix covered this scope. No newer fix PR was open. No repository guidance file was found in jargon or its applicable parent directories beyond the supplied user instructions.

## RED and GREEN

Before implementation, `npm test -- src/lib/streak-freeze.test.ts` exited 1 with two failed and one passed. The second refill returned true where false was expected in both timezone cases. [RED log](review-fix-logs/red.log).

After implementation, this focused command exited 0 with 16 passed:

```sh
npm test -- src/lib/streak-freeze.test.ts src/App.test.tsx src/lib/personalize-claim-check.test.ts src/lib/prompt-version-sync.test.ts
```

The focused command was rerun after `npm ci`. Untouched main's existing App and version-sync tests passed 5/5. [Focused candidate](review-fix-logs/green-1.log), [control](review-fix-logs/control-focused.log).

## Untouched current-main comparison

Created a fresh control clone in a temporary folder, without sibling repos. Every command below ran with the workspace root variables unset:

```sh
git clone --no-local --branch main <local-clone> <tmp>/jargon-review-control-20261101
npm ci
```

Both exited 0. Installed candidate dependencies with the same `npm ci` command, lifecycle scripts enabled. Node v24.14.1, npm 11.11.0, Vitest 4.1.12 and Playwright 1.64.1. All lockfiles retain SHA-256 `2cd285d0c457aba21001488a2d78877fa07f8baecca648fa006745403d082322`. All gate runs unset the workspace root variables and use the checked-in synthetic fixtures. Control source is untouched.

| Command | Untouched main | PR #1 |
| --- | --- | --- |
| `npm run pre-deploy` | Exit 0, 1103/1103 unit tests, build and source checks pass | Exit 0, 1114/1114 unit tests, build and source checks pass |
| `PG_BIN=<postgresql-17>/bin npm run test:ai-spend-acl` | Exit 0, ACL regression ok | Exit 0, ACL regression ok |
| `JARGON_E2E_PORT=5281 npm run test:e2e -- --reporter=line` | Exit 1, 96 passed and 2 failed | Same command with port 5282, exit 1, 96 passed and 2 failed |

The earlier calendar failure does not reproduce at today's wall-clock instant on main. The new frozen regression tests reproduce it independently of that instant. The full repository `pre-deploy` gate is green. The broader browser suite is red on both trees. Both browser failures are `tests/e2e/routes-flow.spec.ts:277`, navigation from home to spotted paste mode, on iphone-14 and iphone-16-pro-max. Each expects the missing `spotted in the wild` heading at line 281. Candidate-only failure identities: none. This unrelated baseline browser contract was preserved, not waived or called green.

The initial browser attempts lacked WebKit 2370. Stopped both with SIGINT, exit 130, preserved their logs and installed the exact required browsers with `./node_modules/.bin/playwright install chromium webkit`, exit 0. The table reports complete clean reruns after installation. No browser project or prerequisite was skipped. PostgreSQL 17.6 is now available locally, resolving the prior ACL prerequisite without changing the gate.

## Additional checks and evidence

These commands exited 0:

```sh
node eval/replay-claim-check.ts
./node_modules/.bin/tsc --noEmit --allowImportingTsExtensions --moduleResolution bundler --module esnext --target es2022 --skipLibCheck supabase/functions/personalize-term/claim-check.ts
git diff --check
```

Original dated evaluation artifacts, expert labels, frozen challenge set and replay artifact remain unchanged. No policy retuning occurred. No Deno executable was available and no Deno deployment or live inference was attempted. Hosted GitHub checks are absent in the current PR metadata, not certified green. No head-matched hosted preview is certified.

Portable logs are in [review-fix-logs](review-fix-logs). Raw logs, interrupted browser attempts, installation logs and failure traces are kept in a local evidence home outside the repository. Committed copies remove terminal escape codes and trailing whitespace, and show `<repo>` and `<tmp>` in place of local checkout and temporary folder paths. The owned control clone and GIF encoding venv are removed after preserving evidence.
