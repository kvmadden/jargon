# How personalize-term checks a rewrite

This page describes prompt version 10. The code is in `supabase/functions/personalize-term/`: `prompts.ts` (the prompts and parsers), `pipeline.ts` (the pass sequence), `claim-gate.ts` with `claim-text.ts` and `domain-lexicon.ts` (the deterministic gate), and `index.ts` (the Edge Function).

## Why it changed

On the 2026-10-30 run the verifier accepted 78 of 79 rewrites. Four accepted rewrites carried errors the rewrite itself introduced, and the verifier caught 0 of 4. All four were analogies that made a claim about the learner's own field, such as "you can only open charts for patients on your unit". The verifier compares the rewrite with the canonical entry, so a claim about nursing or pharmacy that the canonical entry never mentions has nothing to be checked against. Its own `uses_analogy` flag also waived the analogy checks when it said no, and it read only the definition field.

## The sequence

1. **Pass 1** writes a candidate from the canonical entry and the profile. The profile is sent as a JSON data block, so text in a profile cannot pose as a prompt section. The learned vocabulary goes to every pass, and a failed vocabulary lookup is sent as "unknown", not as "no vocabulary yet".
2. **Pass 2** grades 8 criteria and returns two lists: `domain_claims` (claims about the learner's field, each marked supported, unsupported or unsure) and `canonical_concerns` (canonical statements it doubts). A verdict missing either list is unreadable, not empty. The accept decision is computed in code from the 8 criteria. The model's own `overall` string is kept as `model_overall`, and a disagreement is logged.
3. **The claim gate** reads every sentence of all three fields and returns `pass`, `revise` or `needs_review`. It does not call a model.
4. If the verifier failed a criterion or the gate did not pass, **Pass 3** regenerates once, with the failed criteria and the gate's findings quoted. The regeneration goes through Pass 2 and the gate again.
5. If the second try still does not pass, the learner sees the canonical text. A held rewrite is logged as `held-needs-review` with the gate findings, and those rows are the review queue (`personalize_log.needs_review`).

## What the gate holds

| Rule | Holds when | Why |
| --- | --- | --- |
| Analogy into the learner's field | A sentence with a comparison marker (think of, like a, the same way, just as and similar) uses words from the learner's field | Those claims cannot be checked against the canonical entry. All 4 introduced errors were of this kind. |
| Restrictive claim about the field | only, never, cannot, no one or similar, next to field words, and not in the canonical entry | The RLS and OAuth errors were access rules stated as absolutes. "Do not assume" and other corrections are exempt. |
| New exclusive claim | The rewrite says only or solely where the canonical entry has no exclusive claim | The staging error was an "only" claim. |
| Verifier flags | Any `domain_claims` entry marked unsupported or unsure, or any `canonical_concerns` | The verifier's doubt is a reason to hold, not to pass. |
| Length | The rewrite is under 0.4 or over 2 times the canonical length | Asks for a revision, not a hold. |

The learner's field comes from the profile: curated lexicons for healthcare, education, finance, legal and trades work, switched on by the job and background, plus the profile's own work words. Words that appear in the canonical entry are removed, so the term's own vocabulary never counts as the learner's field.

An analogy a reviewer has approved can be listed in `approved-analogies.ts`, with the reviewer and the date. It stops being held for that one term only. The list is empty.

## What it cannot do

- It cannot see an error the canonical entry shares. The fix for that is correcting and reviewing the canonical text (`docs/canonical-review.md`), and the verifier is now told the canonical entry can be wrong.
- It misses a field claim with no marker word and no field vocabulary, for example an analogy from an interest ("like a slow-cooker recipe") that uses none of the learner's words. The dev cases document this gap.
- It holds some correct analogies. On the saved run it held 3 of the 9 outputs the AI read-through judged correct. A hold costs personalization, not accuracy: the learner sees the canonical text.
- It was built after reading the errors it catches. Its results on the saved run and on `eval/data/dev-cases-v1.json` are development results.

## What a learner sees

| Situation | Shown |
| --- | --- |
| A rewrite passed the verifier and the gate | The rewrite, cached |
| Held for review, failed twice, timed out, over the spend cap | The canonical text |
| The cached rewrite was made under an older prompt, profile or model | The canonical text while a new one is made. It was shown before, and an older check had accepted it. |
| The learner reported the rewrite | The canonical text. The report deletes the cached rewrite (the report keeps a copy for review). |
| A hold or verification failure in the last 24 hours for the same term and prompt version | The canonical text, with no model call |
