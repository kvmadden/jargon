# Local model comparison of the original and candidate verifiers

Status: **prepared, not yet run.** This cloud session cannot run a local model. Kevin authorized free local models only, with no paid API. The script below is ready for Kevin to run on his own machine with Ollama.

## What it answers

When the same model reads the same frozen inputs, how do the unchanged original verifier and the candidate verifier differ in false acceptances, false rejections, regenerations and canonical fallbacks?

## The model is a substitute

The shipped verifier calls a hosted model (`PERSONALIZE_MODEL` in `supabase/functions/personalize-term/prompts.ts`). This comparison uses a small local model through Ollama instead. A 3B local model reads instructions very differently from the hosted model, so its verdicts are not production verdicts. **Results are indicative only.** They can show how the two verifiers differ given one model. They cannot show how either verifier behaves in production. Every results file states the substitute model and the shipped model it replaces.

## What is held fixed

- Both arms send the shipped Pass 2 system prompt and user message, unmodified, with the shipped token limits.
- On a failed verdict both arms regenerate once with the shipped Pass 3 prompt, re-verify, and otherwise fall back to canonical text, as the Edge Function does.
- The only difference between arms is the verdict parser. Original uses `parseVerdict`. Candidate uses `parseVerdict` plus the deterministic claim check from PR #1.
- Each arm makes its own model call with identical request bodies, temperature 0 and a fixed seed. Any first-verdict disagreement is listed per item.
- Frozen inputs: the 24-item synthetic set (hash checked) and the 78 saved accepted outputs from the 2026-10-30 run. The digest of the full input list is recorded.

Two settings differ from production and are recorded in each results file. The timeout defaults to 120 seconds instead of 30, because local models are slow. Transport errors are not retried, and they count as fallbacks.

## Labels used for scoring

| Set | Items | Labels |
| --- | ---: | --- |
| Synthetic challenge | 24 | 12 incorrect, 12 correct, synthetic author labels |
| Historical accepted outputs | 78 | 5 incorrect and 7 correct by Kevin Madden, PharmD. 66 unlabeled |

False acceptance means a labeled-incorrect item whose first verdict on the frozen candidate is pass. False rejection means a labeled-correct item whose first verdict is fail. An unparseable or errored verdict is neither, and is listed separately. Unlabeled items are run and recorded but not scored. Regenerated text is new and unlabeled, so whether it is correct is unknown.

The synthetic items are single claims without a canonical term. To run a verifier on them, each item gets a fixed term and fictional profile from [`eval/data/verifier-comparison-contexts-v1.json`](../../eval/data/verifier-comparison-contexts-v1.json), written before any model run. Two items (`heldout-11`, `heldout-12`) have no matching term and are marked `none`, and four are marked `nearest`. Verdicts on those items are confounded by the mismatch. All 24 share the same filler sentences, which a verifier may also reject on its own merits.

## Run it

```sh
ollama pull llama3.2:3b
npm ci
node eval/compare-verifiers-ollama.ts
```

Options: `OLLAMA_BASE_URL` (default: Ollama on the same computer, at its default port 11434), `OLLAMA_MODEL` (default `llama3.2:3b`), `OLLAMA_TEMPERATURE`, `OLLAMA_SEED`, `OLLAMA_TIMEOUT_MS`, `COMPARE_SETS=heldout,historical`, `COMPARE_LIMIT` for a smoke test and `COMPARE_TAG` for the file name. No API key is read.

Output goes to `eval/results/<tag>-ollama-verifier-comparison-<model>.jsonl` (one row per item with both arms, every raw model response, verdicts, regeneration and fallback reason) and a matching `.json` summary. The script refuses to overwrite an existing file, so earlier numbers are kept.

## Tests

`src/lib/verifier-comparison.test.ts` runs the full pipeline against a mocked Ollama endpoint. It checks identical requests for both arms, false acceptance and false rejection scoring, regeneration and fallback paths, unparseable output, HTTP errors, timeouts, the substitute-model labeling and the no-overwrite rule.

## What it cannot settle

A local substitute cannot meet the release gate's call for a faithful rerun of the shipped verifier. Running it gives indicative evidence about the policy layer. Whether that is enough to release is Kevin's decision.
