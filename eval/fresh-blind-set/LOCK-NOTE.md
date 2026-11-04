# Lock note: Part B blind set (labeled renderings)

Registered on 2026-11-03.

This folder pre-registers the paid verifier pass on the Part B blind set: 345 synthetic personalized renderings of 53 terms for 11 invented learners, each with a gold label. The set was written from the spec in [`SPEC.md`](SPEC.md). The set itself is not in this repository. It stays outside, read-only, until the one scoring run. This folder holds hashes (`lock.json`), this note, the spec, and the run plan (`RUN-PLAN.md`). No term, profile, rendering, label or verdict is stored here. Part A of the spec (the end-to-end set that needs generation) was not built.

## What is locked

- The staged set was hashed and set read-only at 01:27 UTC on 2026-11-04 (17:27 Pacific on 3 November). It holds 773 files. `lock.json` gives the hash of its lock file, the hash of its manifest (which lists every file), and the hash of each deliverable.
- Nothing from the set has been scored, and no verifier has seen a rendering. The paid pass has not started (see `RUN-PLAN.md`).
- After the lock, a clean JSON copy of the clinical review list was added next to the locked Markdown list, so a form can be built from it. The JSON holds the same 30 items in the same order. The script that wrote it rebuilt the Markdown from the JSON byte for byte, and the original lock still verifies on all 773 files. The JSON hash is in `lock.json` under `added_after_lock`.

## The set in numbers

- 345 renderings: 124 correct, 177 wrong-introduced, 24 wrong-inherited and 20 unsupported. They cover 14 kinds, with at least 18 renderings of each kind.
- 53 terms, 15 of them rated hard. 10 terms carry a deliberately wrong canonical entry, marked in the file. 11 profiles, 3 of them with a learned vocabulary and 1 sparse (a job title only).
- By domain of the learner: clinical 125, education 63, legal 34, hospitality 33, general 31, trades 31, finance 28.
- 157 renderings have the error only in the example sentence (78) or only in the "why it matters" paragraph (79), as the spec's mix minimum asks.

## Disclosures that go into every report that uses this set

1. **Two ordinary words were printed.** While fixing a name filter, the build agent printed two single words from the set: "workday" (profile `p-04`) and "windows" (term `t-048`). Nothing else from any term, profile, rendering, label or reason was printed or quoted by the build agent.
2. **What the build agent read.** It read no file of this repository by eye before the lock. The `eval/` folder and `supabase/functions/personalize-term/` were read only by scripts for the 8-word overlap check, which printed counts and ids. After the lock it read the prompts, the pipeline, the eval library, the gate and the recorded smoke-test usage to write the run plan. It read no verdict.
3. **Labelers are models.** Two model families, Grok 4.7 and Gemini 3.8 Flash, labeled every rendering on their own, and GPT 6.1 Sol adjudicated the disagreements. The spec asks for domain-expert human labelers. This is a change from the spec and it is recorded in `AMENDMENTS.md` of the staged set.
4. **Kevin's review is not in yet.** Kevin, a pharmacist, reviews 30 clinical items, all of them flagged ones (an adjudicated item, an item a labeler marked as needing an expert, a low-confidence item, or an item with extra issues). He has not answered. He reviews them on 4 November, before the scoring run. A label he overturns is applied through a dated amendment here that lists the item ids and the new hashes.
5. **Models only outside the clinical domain.** Education, trades, finance, legal, hospitality and general items were labeled by models only. No human domain expert has seen them. Clinical items outside the 30 in Kevin's list were also labeled by models only. Any report that uses this set must say so.

## Limits of the set

- **A selection effect.** A rendering is in the set only if the independently labeled gold equals the writer's design gold. Errors that both labelers missed are therefore absent, so the wrong renderings are easier than a raw sample of subtle errors would be. The dropped items are counted by kind in the staged `dropped.json`.
- **Family effect.** Each family also labeled its own renderings. Before adjudication, on the 202 Grok-written renderings the design gold matched Grok's label in 97.0 percent of cases and Gemini's in 98.5 percent. On the 197 Gemini-written renderings it matched Gemini's label in 96.4 percent and Grok's in 84.3 percent. The kept renderings agree between the two labelers on the four-way label in 335 of 345 cases (97.1 percent).
- **Adjudication.** 35 renderings needed adjudication. 22 of them were dropped because the adjudicator's gold differed from the design. Most were correct renderings (analogies and restrictive claims) that the adjudicator judged wrong, which leaves a cleaner set of correct renderings than the writers made.
- **Synthetic.** Every term, profile and rendering is invented. No real person, employer or patient appears.
