# eval

Offline evaluation tools for `personalize-term`. Everything here except `run-personalize-eval.ts` runs without a network connection or an API key.

| Command | What it does |
| --- | --- |
| `node eval/report.ts` | Writes `results/2026-10-30-report.md`, the corrected report on the 2026-10-30 run. `--check` exits 1 if the committed file is out of date. |
| `node eval/replay-gate.ts` | Replays the claim gate over the saved outputs and writes `results/2026-10-30-gate-replay.json`, once as saved (nothing vouched for) and once with every sentence vouched for. `--check` as above. Development result. |
| `node eval/check-rendering.ts --term <id> --profile <id> --rendering <file> [--analogy] [--verdict <file> or --vouch-all]` | Runs the claim gate on one rendering against the corrected seed. Without a verdict, no sentence is vouched for. Exit code 0 is pass, 3 is needs_review, 4 is revise. |
| `node eval/build-dataset.mjs --out <file>` | Picks 40 terms from the seed. Refuses to overwrite a frozen file. |
| `node eval/run-personalize-eval.ts --terms <file>` | Runs the pipeline against the Anthropic API. **Paid.** |

## Files

- `data/terms.json`, `data/profiles.json`: the frozen inputs of the 2026-10-30 run. `terms.json` keeps the three canonical entries that were later corrected, because that is the text the run was checked against.
- `data/labels-2026-10-30.json`: labels for 23 of the 78 accepted outputs, with who made each one. Only 5 were confirmed by a person. Unlabeled is not correct.
- `data/dev-cases-v1.json`: development cases for the claim gate.
- `results/2026-10-30*.json*`, `results/2026-10-30-summary.md`: the run as written. The summary's costs are at three times list price. It is frozen, and the report corrects it.
- `frozen-artifacts.json`: SHA-256 of every frozen file. A test checks them.

## Running a new eval

```sh
export ANTHROPIC_API_KEY=...        # read from your secret store, never written to disk
node eval/build-dataset.mjs --out eval/data/terms-2026-11-10.json
EVAL_DATE=2026-11-10 EVAL_BUDGET_USD=10 node eval/run-personalize-eval.ts --terms eval/data/terms-2026-11-10.json
```

The runner calls `supabase/functions/personalize-term/pipeline.ts`, the same code the Edge Function runs. It reserves each item's worst case at list price before starting it. A retry needs room for one more worst-case attempt, and an attempt that ended without a readable response is counted at its worst case, because it may have been billed. Each row carries a manifest hash of every file that defines the experiment (prompts, pipeline, gate, text rules, lexicon, approved analogies, pricing, budget and the eval library), the model, the prompt version, the terms and the profiles. A resume under a different manifest is refused. Results are development data unless the inputs are a locked blind set scored once (`docs/evaluation.md`).
