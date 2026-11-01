# Evaluation review verification

Evidence home: `/Volumes/HubData/evidence/jargon-eval-showcase-ui`, under the evidence allocation in `storage-plan-jargon-eval-showcase-ui-608fe84a-67fd-4029-ac36-ee2c027e3ae6.json`.

## Scope and dependency

The isolated worktree belongs to `/Users/kevin/dev/repos/jargon`. It began at `origin/main` (`2db6bcffb674c13df67a0c7926f5784541fd584c`). Fetched origin, checked the tree and searched evaluation, review, disagreement and expert-label capabilities in source and evaluation artifacts. Checked state briefs, parked work, queue and recent Jargon run evidence. The open PR inventory showed only the verifier upgrade. No competing review screen was found. No ledger row was edited.

PR #1 (`grok/jargon-verifier-upgrade`, dependency tip `297e177`) was integrated by fast-forward before implementation. This UI PR targets main under the global PR rule. The dependency provides the expert-confirmation artifact and shared runtime claim check. No upgrade code or historical artifact is modified here.

The standalone Vite entry reads the real synthetic evaluation artifacts, uses the shared library to compute holds and never calls an external API. It has no auth or Supabase dependency. Unreviewed outputs never become expert agreements. The original source notes are AI-authored, with Kevin's separate confirmation applying only to the five flagged outputs.

Visual decisions use the existing learner capture and shared `design-tokens/design` surface, text and semantic palettes. The screen adds responsive table cards, native keyboard-accessible review dialogs and actual light and dark themes.

## RED and GREEN

Before implementing the loader, supplied empty rows and ran:

```sh
npm test -- src/lib/evaluation-review.test.ts
```

Exit 1. The first assertion failed with `expected [] to have a length of 79 but got +0`. The policy-hold assertion expected 12 and received 0. See [red.log](showcase-logs/red.log).

After implementation:

```sh
npm test -- src/lib/evaluation-review.test.ts src/evaluation/review.test.tsx
```

Exit 0, four tests passed. Tests cover all 79 runs, five confirmed labels, 74 unknown labels, five disagreements, zero expert agreements, 12 computed holds, source notes, search, the parse fallback, pending loading, artifact failure and retry recovery. The RED test initially used a guessed fallback status. Inspection of the actual artifact corrected that assertion to `fell_back_to_canonical` before GREEN. See [green.log](showcase-logs/green.log).

## Full gate against untouched control

Created an outside-estate fresh clone using Python `tempfile.mkdtemp(prefix='jargon-showcase-control-')` and:

```sh
git clone --no-local --branch main /Users/kevin/dev/repos/jargon <control-path>
npm ci
```

Both exited 0. The control path is preserved in the evidence home. Node was `v24.14.1`, npm `11.11.0`, Vitest `4.1.12` on both trees. Both lockfiles have SHA-256 `2cd285d0c457aba21001488a2d78877fa07f8baecca648fa006745403d082322`. Both use the same saved synthetic inputs. No lifecycle script or hook was skipped.

Commands on each tree:

```sh
env -u MFW_UMBRELLA_ROOT -u OPERATOR_ECOSYSTEM_ROOT npm run pre-deploy
env -u MFW_UMBRELLA_ROOT -u OPERATOR_ECOSYSTEM_ROOT npm run test:ai-spend-acl
```

| Check | Untouched main | Candidate |
| --- | --- | --- |
| Full pre-deploy gate | Exit 1, 1102 tests passed, 1 failed | Exit 1, 1114 tests passed, 1 failed |
| Build within gate | Passed | Passed |
| AI spend ACL | Exit 1, PostgreSQL 17 missing | Exit 1, PostgreSQL 17 missing |

Both gates fail the same existing test: `src/App.test.tsx > checkAndRefillStreakFreezes > does not refill when already in the same calendar month`, assertion `expected true to be false` at line 83. Candidate-only failures: none. The full gate remains red. No baseline issue was changed as part of this screen. The PostgreSQL prerequisite was not bypassed. [Full logs](showcase-logs) are inspectable.

## Browser capture and interaction checks

```sh
npm run build
node scripts/capture-evaluation.mjs
git diff --check
```

Build exited 0. Capture exited 0 after correcting an initially undersized brand link to a 44-pixel target. The capture uses visible Chromium, blocks external network requests and checks all 79 rows, five disagreements, policy replay, search, empty agreements, dialog focus, Enter and Escape. No page errors or horizontal overflow were observed at 1440x900, 430x932 or 390x844. Every measured target is at least 44 by 44 pixels. Geometry is recorded in [evaluation-capture-checks.json](../media/evaluation-capture-checks.json).

Screenshots were rendered and visually inspected in light and dark at the three requested sizes, including a mobile view of the evaluation rows. The GIF shows filtering, policy replay, full review and the empty agreement state. The capture script requires Python Pillow for GIF encoding. This run installed Pillow in a disposable venv and used:

```sh
python3 -m venv /tmp/jargon-eval-gif-venv
/tmp/jargon-eval-gif-venv/bin/pip install Pillow
GIF_PYTHON=/tmp/jargon-eval-gif-venv/bin/python node scripts/capture-evaluation.mjs
```

All exited 0. The script deletes its frame scratch directory in `finally`. The control clone and encoding venv were deleted after preserving evidence. Original logs live in the evidence home. Committed log copies only remove trailing blank lines and whitespace for clean diff checks.

## Limits

No new LLM run, regeneration, deployment, database test or full Playwright suite was performed. The upgrade remains an open dependency, not a landed accuracy result. Seven additional historical policy holds remain unadjudicated. The five confirmations do not establish correctness of the other outputs. The historical review notes are displayed verbatim, including their original uncertainty, alongside the later expert confirmation.

## November 1 review follow-up

The PR #1 review fix is integrated with merge commits, retaining #1 then #2 ancestry and main as the PR base. Both PRs remain HOLD and draft. The production policy dependency was retained rather than silently released through the offline UI. The missing expert adjudication and authorized inference decisions are listed in [release decisions](release-decisions.md) and `~/dev/state/AT-DESK.md`.

The shared local-month refill defect is fixed with frozen RED-first regression tests. The current full `pre-deploy` gate passes 1118/1118 unit tests, build and source checks, exit 0. Untouched fresh main passes 1103/1103, exit 0. PostgreSQL 17.6 ACL regression passes on both, exit 0. Identical Node, lockfile, enabled install lifecycle scripts, estate-free environment and control details are in [the shared verification](review-fixes.md). Historical red records above are retained.

These exact candidate commands exited 0 after `npm ci`:

```sh
env -u MFW_UMBRELLA_ROOT -u OPERATOR_ECOSYSTEM_ROOT npm test -- src/lib/streak-freeze.test.ts src/App.test.tsx src/lib/personalize-claim-check.test.ts src/lib/prompt-version-sync.test.ts src/lib/evaluation-review.test.ts src/evaluation/review.test.tsx
env -u MFW_UMBRELLA_ROOT -u OPERATOR_ECOSYSTEM_ROOT npm run pre-deploy
env -u MFW_UMBRELLA_ROOT -u OPERATOR_ECOSYSTEM_ROOT PG_BIN=/Users/kevin/dev/toolchains/postgresql-17/bin npm run test:ai-spend-acl
node eval/replay-claim-check.ts
GIF_PYTHON=/tmp/jargon-review-gif-20261101/bin/python node scripts/capture-evaluation.mjs
git diff --check
```

Focused checks pass 20/20. Replay output is unchanged. Installed Pillow in the owned disposable venv using `python3 -m venv /tmp/jargon-review-gif-20261101` and `/tmp/jargon-review-gif-20261101/bin/pip install Pillow`, both exit 0. Capture checks pass with all 79 rows, five disagreements, policy replay, search, empty agreements and keyboard dialogs. Light and dark captures were visually inspected at 1440x900, 430x932 and 390x844. Minimum measured target is 44 pixels at every size, with no overflow or page errors. Product visuals were unchanged, so refreshed captures are preserved in the evidence home instead of replacing existing repository media.

Current logs are in [review-fix-logs](review-fix-logs). Raw logs and refreshed screenshots, GIF and geometry are in `/Volumes/HubData/evidence/jargon-review-fixes/capture-2`. The evidence root follows the dispatcher's storage allocation recorded in the shared verification. No new expert labels, paid API call, hosted inference, deployment or merge occurred. No Deno deployment or head-matched hosted preview is certified. Hosted checks are currently absent. The original saved outputs and frozen challenge set remain unchanged.

The complete browser command `env -u MFW_UMBRELLA_ROOT -u OPERATOR_ECOSYSTEM_ROOT JARGON_E2E_PORT=5283 npm run test:e2e -- --reporter=line` exited 1, with 96 passed and two failed. Both failures exactly match untouched main and corrected PR #1: `tests/e2e/routes-flow.spec.ts:277`, spotted paste-mode navigation, on iphone-14 and iphone-16-pro-max. The missing heading assertion is at line 281. Candidate-only failures: none. [Failure identity comparison](review-fix-logs/browser-failure-comparison.json). The browser suite remains red despite the green repository gate. No browser project was skipped or assertion weakened.

## November 1 expert labels and local comparison

Merged PR #1 at `9ab082c` into this branch. Kevin Madden, PharmD judged all seven additional historical holds correct on 2026-11-01. The review UI now reads `eval/data/expert-adjudication-2026-11-01.json` beside the five confirmed misses. Those seven show a Correct expert label and, in policy replay, a "False hold" note. Agreement filters now include the seven, because the historical verifier accepted them. Expert labels and policy decisions remain separate fields.

`npx vitest run` exits 0 with 1134 passed across 99 files. `npm run build` exits 0. A headless Chromium check of the policy-holds view at 1440x900 and 390x844 showed seven false-hold notes, no horizontal overflow and no page errors. The committed screenshots and GIF in `docs/media/` predate these labels and still show the seven as not reviewed. They have not been regenerated. The full pre-deploy gate, browser suite and ACL check were not rerun for this change.

Gate 2 remains open. The free local-model comparison script is ready but not run. See [local model comparison](local-model-comparison.md).
