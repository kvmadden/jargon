# Evaluation

## What has been measured

One run, on 2026-10-30, with prompt version 9. Every number from it is in `eval/results/2026-10-30-report.md`, generated from the saved rows by `node eval/report.ts`.

| | Value |
| --- | --- |
| Items | 79 of 120 planned |
| Terms | 27 of 40, with 15 easy, 12 medium and 0 hard |
| Profiles | 3, written by the author, all with an empty learned vocabulary |
| Accepted | 78 of 79 |
| Errors introduced by the rewrite | 4, and the verifier caught 0 of 4 (95% CI 0-49%) |
| Errors inherited from the canonical text | 5 (1 confirmed by a person, 4 from an AI read-through) |
| Accepted outputs judged wrong | at least 9 of 78 (12%, 95% CI 6-20%) |
| Accepted outputs an expert read | 5 of 78, all flagged first by an AI screen |
| Cost at list price | $2.92, about $0.037 per item |

This is development data. The claim gate, the labels file and the dev cases were all written after reading this run, so no result on it can show how the pipeline does on new inputs.

### Smoke run, 2026-11-03 (prompt version 10)

A paid format check of the v10 prompts, approved by Kevin with a $3 budget: 6 items (2 terms, 3 profiles) from `eval/data/terms-2026-11-03.json`, results in `eval/results/smoke-2026-11-03/`. It cost $0.34 at list price.

- All 9 verifier replies (6 first passes, 3 re-checks) parsed with both claim lists, and all 9 rewrites parsed.
- The gate held 3 of 6 first rewrites. All 3 regenerations passed, so 6 of 6 were accepted. The verifier quoted 15 field sentences and marked all 15 supported.
- One of the 3 holds was a false hold: "chart" in "summed or averaged row by row in a chart" matched the healthcare word for a patient chart.
- None of the 6 accepted rewrites used an analogy.

Six items show the format works. They say nothing about accuracy.

### Corrections to earlier claims

- "5 of 78 accepted outputs were wrong (6.4%)" counted only the 5 expert-confirmed outputs. One of them copied its error from the canonical entry, and 4 more outputs repeated canonical errors. At least 9 of 78 showed a learner a claim judged wrong.
- Costs were published at three times list price ($8.77 instead of $2.92), and the budget guard stopped the run at 79 items on that figure.
- The README said a parity check confirmed "all 747 prompt strings ... were byte-identical". No artifact of that check is in the repository, so the claim is removed. The eval now runs the same pipeline module as the Edge Function, which makes the question moot for new runs.

## Test sets

| Set | Status | Rule |
| --- | --- | --- |
| `eval/results/2026-10-30.jsonl` and its inputs | Development | Pinned in `eval/frozen-artifacts.json`. Never edited. |
| `eval/data/dev-cases-v1.json` | Development | May grow as new failure kinds are found. Never used for a headline. |
| A blind locked set | Not yet written | Written from a separate spec by people or models that have not seen this run or the gate code. Its hash goes into `eval/frozen-artifacts.json` before the first scoring run. Scored once. Any change to the pipeline after that makes it development data, and a new locked set is needed. |

## What a fair evaluation needs

1. **A blind set built for the question.** Terms across all three difficulty levels, at least 8 profiles written by someone other than the author (including clinical, education, trades, finance and sparse profiles), learners with real learned vocabulary, and planted cases for each known failure kind mixed with ordinary items. Every item has a reference judgment written before any output exists.
2. **A baseline.** The canonical text alone, and a plain rewrite with no personalization, judged the same way and blind to which arm produced the text.
3. **A verifier from a different model family** than the generator, run on the same candidates, so agreement between the two is measured rather than assumed.
4. **Expert review beyond the flagged items.** A random sample of accepted outputs (for example 30), mixed with held and rejected ones, read blind to the verdict by a person who knows the learner's field. That is the only way to estimate how many wrong outputs the checks let through.
5. **Every rate with its denominator and a 95% interval**, errors split into introduced and inherited, and holds reported as their own outcome (a hold is lost personalization, not an error shown).
6. **A learning measure** if the product claims one: retention or transfer against the canonical-only arm. Nothing so far measures learning.

## Running the tools

See `eval/README.md`. The offline tools make no model calls. A new run makes paid calls and needs an explicit budget.
