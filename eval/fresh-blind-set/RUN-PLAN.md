# Run plan: the paid verifier pass on the Part B blind set

Registered on 2026-11-03, before any rendering has been sent to a verifier. The set is described in [`LOCK-NOTE.md`](LOCK-NOTE.md) and was written from [`SPEC.md`](SPEC.md). All hashes are in [`lock.json`](lock.json).

No term, profile, rendering, label or verdict is in this repository. Nothing is scored until the one scoring run in step 5 of "Order of events".

## Status

**The paid pass has not started.** Its cost projection is over the ceiling set for it, and the rule in "Cost gate" says it then does not start. No money has been spent on this set.

## 1. What is run

- **Items.** All 345 renderings, once each, through the verifier alone. There is no generator and no regeneration, because the renderings already exist. The deterministic claim gate is not a paid step. It is replayed offline on the saved verdicts at scoring time.
- **The verifier.** The pass-2 call of the personalize pipeline, as it stands at commit `d8aa9df6e490be83b3228bf07bf09bd79e5dc045`, the head of draft pull request 5 when this plan was written.
  - Model `claude-opus-4-7`, through the Messages API.
  - `max_tokens` 1200. No temperature is set, so the API default applies. A 30 second limit per call.
  - System prompt: `PASS2_SYSTEM_PROMPT` in `supabase/functions/personalize-term/prompts.ts` (12,298 characters, SHA-256 in `lock.json`), sent as one text block with `cache_control` set to `ephemeral`.
  - User message: `buildPass2UserMessage(term, candidate, profile, knownVocabulary)` from the same file. It holds the canonical entry, the candidate, the learner profile block and the learned vocabulary.
  - Reply: eight pass/fail criteria, the verifier's own `uses_analogy` call, `domain_claims` and `canonical_concerns`, read by `parseVerdict` from the same file. `overall` is computed in code from the eight criteria.
  - The hashes of `prompts.ts`, `pipeline.ts` and `eval/lib/eval-lib.ts` at that commit are in `lock.json` under `pinned_verifier`.
- **Why this commit.** The set was written for the pipeline in the spec, which is the one with a claims list and a claim gate. `main` holds an older verifier (a reply cap of 700 tokens, no claims list) and has no claim gate, so it cannot produce the claim-level results the spec asks for. Draft pull request 6 changes one sentence of the verifier's fourth criterion (capital letters and periods) and nothing else in the verifier request, so it is expected to behave the same. If the pass runs, it runs at the commit above, and a different pin needs a dated amendment first.
- **How a row is built.** The term row comes from `terms.jsonl` (the canonical entry, including the deliberately wrong ones, which the verifier is not told about). The candidate is the rendering's `long_definition`, `why_it_matters` and `example_in_sentence`. The profile block uses the profile's education level, job, interests, background text and places where terms are met. The other profile slots (where they are from, roles, goals) stay empty. The learned vocabulary is the profile's list, and an empty list for a profile with none.
- **Failures count.** A call that errors after the transport's own retries, hits the token cap, or returns a verdict that cannot be read counts as a rendering the verifier stopped, and the count is reported.
- **Saved.** For every call: the raw reply, the parsed verdict, the token usage, the stop reason and the latency. They are kept outside this repository and nobody reads them before scoring.

## 2. Cost gate

- **Ceiling.** The pass has a hard ceiling of 5.33 US dollars. The exact cost is recorded from the API's own usage figures after the run.
- **Rule.** The pass starts only if its projection is at or below the ceiling. The runner also stops before any call whose worst case could take the spend over the ceiling.
- **Projection, from recorded usage.** Two smoke runs on development data (6 items each) recorded the verifier calls' token use. At list prices of 5 dollars per million input tokens and 25 per million output tokens (cache reads at a tenth of the input price, cache writes at 1.25 times it), a verifier call costs about 0.021 dollars at the prompt's size and length of reply (about 960 uncached input tokens, 4,300 cached input tokens and 560 output tokens). For 345 renderings that is about **7.19 dollars** at the pinned prompt. The second smoke run, with longer replies (680 output tokens), gives about 8.05 dollars. Both are over the ceiling by about 1.9 to 2.7 dollars.
- **Result.** The pass did not start. This section records the projection, and nothing was charged.
- **Options on record.** None of these is chosen yet. Each needs a dated amendment here before the pass starts.
  1. The Message Batches API, same model, prompts and parameters, at half price. With the shared 4,300-token prompt cached, the projection is about 3.6 to 4.0 dollars. Caching is best effort in a batch, and with no cache hits the projection is about 6.9 to 7.4 dollars. A batch run would go in chunks, with a stop if the spend so far plus the projected rest passes the ceiling.
  2. A larger ceiling, which is Kevin's decision, because the whole project has a spending cap.
  3. A subset of about 230 to 250 renderings, chosen by a fixed seed and stratified by kind. This changes the design and the reported denominators.

## 3. How the scoring works

- **Gold.** The `gold` and `kind` of each rendering in `renderings.jsonl`, with Kevin's answers applied through a dated amendment before scoring.
- **Verifier alone.** A rendering is stopped when `overall` is fail (any of the eight criteria fails) or the call failed.
- **Verifier with the claim gate.** A rendering is stopped when the verifier alone stops it, or when the claim gate at the pinned commit returns `needs_review` or `revise` for the verifier's `uses_analogy`, `domain_claims` and `canonical_concerns`. The gate is deterministic and costs nothing. The gate in draft pull request 6 (head `ad867c3`) is replayed as a second, labeled column.
- **What is reported.** As the spec asks, each rate as k of n with a 95 percent Wilson interval, overall and per kind, per profile and per difficulty, for both arms side by side.
  - Wrong renderings stopped, out of all wrong renderings, per kind.
  - Correct renderings stopped, out of all correct renderings, with the correct field analogies shown separately.
  - Unsupported renderings stopped.
  - Clinical renderings (125) are shown separately from the rest. Everything outside the 30 items Kevin reviews was labeled by models only, and the report says so.
- **Not in this pass.** The spec also asks for a verifier from a different model family. It is not part of this plan and the report says it was not run.
- **Score once.** The scoring run happens one time, after the scoring script is frozen and Kevin's answers are in. If an error is found afterward, the report shows the original result and the corrected one side by side.

## 4. Not frozen yet

- **The verifier-only runner.** It does not exist yet. It is a small script that builds the requests above, calls the API under the cost rule and saves the replies. Its hash is added to `lock.json` by a dated amendment before the pass starts.
- **The Part B scoring script.** The repository has the claim gate, `replayGate`, `wilson95` and a replay script for the older result format, but nothing that scores Part B verdicts against these gold labels. The script is written from this plan, without reading any verdict, and its hash is added by amendment before scoring.
- **Frozen already.** The verifier prompt and code, the claim gate and its text helpers, the domain lexicon, the approved analogies, the replay script and the eval library, by the hashes in `lock.json`.

## 5. Choices fixed here

1. **Which verifier.** The head of draft pull request 5, for the reasons in section 1. If that pull request changes before the pass runs, the pin stays at the commit above.
2. **Failed calls count as stopped.** The spec counts a rewrite as stopped when it is held or failed.
3. **Kevin's answers.** A label he overturns changes the gold through a dated amendment that lists the item ids and the new hashes. The staged files are not edited.

## 6. Where this differs from the spec

1. Two model families label the renderings and a third adjudicates. The spec asks for human domain experts. Kevin reviews 30 clinical items.
2. Part A (the end-to-end set that needs generation) was not built.
3. The verifier from a different model family is not run in this pass.

## 7. Order of events

1. This registration is merged.
2. The coordinating session and Kevin decide how the pass is paid for (an option in section 2), and an amendment records the decision and the runner's hash.
3. Kevin reviews the 30 clinical items (4 November), and his answers are recorded by amendment.
4. The pass runs once, if the cost rule allows it.
5. The scoring script is frozen, and the single scoring run follows.
6. The set, the verdicts and the tables are published together.

## Amendments

### A1. 2026-11-03, the pass runs through the Message Batches API under a higher ceiling

This amendment follows Kevin's ruling and fixes how the pass runs. It changes the transport and the ceiling named in section 2, and nothing the model sees. The "Status" paragraph above is superseded: the pass is authorized and starts once this amendment is merged.

1. **Kevin's ruling.** "Batch it, allow up to $12.50." The project's paid evaluation spend for the day may reach 12.50 US dollars. 4.67 was already spent, so the ceiling for this pass is 7.83 dollars. It replaces the 5.33 in section 2. Option 1 in section 2 is the one chosen.
2. **Transport.** The Message Batches API, at half price, with the same model, system prompt, token cap and user message as the pin. Each request body is the production pass-2 request. The one difference is that the cache lifetime of the shared system prompt is asked for as 1 hour (`cache_control` with `ttl` set to `1h`). That changes billing and not what the model sees. No temperature is set. The runner refuses to start unless the staged files and the pinned checkout match the hashes in `lock.json`.
3. **Chunks.** The 345 renderings go in file order, in 8 chunks of 1, 24, 60, 60, 60, 60, 40 and 40. The first chunk is one rendering that writes the cache entry. Each chunk is sent only after the one before it has ended and been priced, so the later ones can read the cache.
4. **Stop rule.** After each chunk the runner prices the usage the API reported: 5 and 25 dollars per million input and output tokens, halved for the batch, with cache reads at 0.1 times and 1-hour cache writes at 2 times the input price. It stops without sending the next chunk if the spend so far, plus the renderings still to go times the highest per-rendering mean of any finished chunk after the first, would pass 7.83 dollars. Until such a chunk has finished it projects with 0.0213 dollars per rendering, the batch price with no cache hits. It also does not send a chunk whose worst case alone would pass the ceiling, taking every input token as written to the 1-hour cache and every reply as long as the 1,200-token cap allows. A stop is reported with the spend and the projection.
5. **Errors on the provider's side.** A request that ends in an API error, an overload, an expiry or a cancellation is sent once more, in one final batch, under the same ceiling. A reply that hit the token cap, a refusal and a rejected request are not sent again and count as stopped, as section 1 says.
6. **What is saved and shown.** The raw results of every batch are saved outside this repository, unchanged, with the request hashes, the batch ids and a summary. The summary and the display hold counts, token usage and costs only. Nobody reads a reply before scoring. The hashes of the results files are added here after the pass ends.
7. **Runner files.** `part-b-lib.ts`, `part-b-http.ts` and `run-verifier-batch.ts` in this folder, with their offline tests in `src/lib/part-b-lib.test.ts`. Their hashes are in `lock.json` under `runner`. The transport is plain fetch, like the eval library, so the repository gains no dependency. The key is read from standard input and is never printed or stored.
8. **Cost record.** The exact cost, computed from the usage the API reports, goes into the project's paid evaluation ledger after the pass, with the new running total.

### A2. 2026-11-03, the Part B scoring script is frozen

The scoring script is written and frozen before any verdict has been read and before any gold label has changed. It changes no rule of section 3.

1. **Files.** `part-b-score-lib.ts` (the rules, as pure functions) and `score-part-b.ts` (the command) in this folder, with offline tests in `src/lib/part-b-score-lib.test.ts` that use made-up fixtures. Their hashes are in `lock.json` under `scorer`. The command also uses `part-b-lib.ts` from amendment A1.
2. **Where each decision comes from.** The verdict reader (`parseVerdict`), the claim gate (`checkRendering`, with the approved analogies) and the Wilson interval (`wilson95`) are imported from the pinned checkout, after its commit and file hashes are checked against `lock.json`. The scorer does not reimplement any of them. The same check runs on the staged set.
3. **What counts as stopped.** As in section 3. By the verifier alone: no result, a failed call, a reply cut off at the token cap, a refusal, a reply that cannot be read, or an overall verdict of fail. With the claim gate: any of those, or the gate returning `needs_review` or `revise`. A rendering whose verdict cannot be read is stopped in both arms and is not given to the gate. The newest result for a rendering counts, so a request sent again after a provider error replaces its first result.
4. **What is reported.** For every arm: wrong renderings stopped, correct renderings stopped, unsupported renderings stopped, and correct field analogies stopped, each as k of n with a 95 percent Wilson interval. Then the stop rate by kind, by gold label, by profile, by term difficulty and by domain, and the number of renderings stopped only by the gate. A table of the headline rates is written next to the full report, with one row per rendering that holds its decisions and no text.
5. **The second gate column.** The gate of draft pull request 6 (head `ad867c3`) is replayed as a second, labeled arm from a second checkout, after its commit and file hashes are checked against `lock.json` (`second_gate`). It is shown beside the registered gate and does not replace it.
6. **Kevin's answers.** They enter as a JSON file of rendering ids and the label he gave. The scorer refuses a label that does not exist and an id that is not in the set. The report says how many labels changed, and the file's hash is recorded with the results.
7. **Checked before the real run.** The command ran end to end on made-up verdicts for the real set's structure, once with an override and the second gate, to prove the plumbing. Those numbers mean nothing and were not kept.

### A3. 2026-11-03, the paid pass ran

The pass ran through the Message Batches API as amendment A1 says, under the 7.83 dollar ceiling. This records its counts and cost. Nobody has read a reply, and scoring has not started.

1. **How it ran.** The registered set and the pinned checkout were verified before the first request. The 8 chunks held 1, 24, 60, 60, 60, 60, 40, 40 renderings and ran one after another, each priced before the next was sent. The shared system prompt was cached for 1 hour. The first chunk wrote the cache entry (4,279 tokens) and the later chunks read it. The stop rule never triggered.
2. **Counts, by rendering, using the newest result for each.** Of 345 renderings: 344 came back with a complete reply (344 of them with a verdict that reads), 1 was cut off at the 1,200-token cap, 0 were refused, 0 failed, 0 still had a provider-side error after the one resend, and 0 had no result. No request needed the resend. A reply that was cut off or cannot be read counts as stopped, as section 1 says.
3. **Cost.** 5.1773 US dollars, computed from the usage the API reported for every result: 5 and 25 dollars per million input and output tokens, halved for the batch, cache reads at 0.1 times and 1-hour cache writes at 2 times the input price (prices checked on 2026-11-03). Tokens: 456,681 input, 291,693 output, 1,471,976 read from the cache, 4,279 written to the 1-hour cache. The mean was 0.0150 dollars per rendering, against the 0.0213 the stop rule assumed with no cache hits. The project's running total for the day is 9.85 dollars of the 12.50 allowed.
4. **Saved.** The raw results of every batch are saved outside this repository, unchanged and read-only, with the request hashes, the batch ids and a summary of counts, tokens and costs. Their hashes are in `lock.json` under `pass_results`.
