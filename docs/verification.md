# How personalize-term checks a rewrite

This page describes prompt version 10. The code is in `supabase/functions/personalize-term/`: `prompts.ts` (the prompts and parsers), `pipeline.ts` (the pass sequence), `claim-gate.ts` with `claim-text.ts` and `domain-lexicon.ts` (the deterministic gate), and `index.ts` (the Edge Function).

## Why it changed

On the 2026-10-30 run the verifier accepted 78 of 79 rewrites. Four accepted rewrites carried errors the rewrite itself introduced, and the verifier caught 0 of 4. All four were analogies that made a claim about the learner's own field, such as "you can only open charts for patients on your unit". The verifier compares the rewrite with the canonical entry, so a claim about nursing or pharmacy that the canonical entry never mentions has nothing to be checked against. Its own `uses_analogy` flag also waived the analogy checks when it said no, and it read only the definition field.

## Before any model call (prompt version 11)

The function first reads the learner's field from the profile. It offers a personalized lesson only for nurses, pharmacists, pharmacy technicians and teachers, and only for a term with a comparison a person has vetted for that field. Otherwise it makes no model call, logs `skipped-unsupported-field` or `skipped-no-analogy`, and returns the standard lesson with the reason. With a vetted comparison, the rewrite must use it word for word. A sentence that is exactly the vetted comparison skips the field rules, and a rewrite without it is held (`missing_vetted_analogy`).

## The sequence

1. **Pass 1** writes a candidate from the canonical entry and the profile. The profile is sent as a JSON data block, so text in a profile cannot pose as a prompt section. The learned vocabulary goes to every pass, and a failed vocabulary lookup is sent as "unknown", not as "no vocabulary yet".
2. **Pass 2** grades 8 criteria and returns two lists: `domain_claims` (claims about the learner's field, each marked supported, unsupported or unsure) and `canonical_concerns` (canonical statements it doubts). A verdict missing either list is unreadable, not empty. The accept decision is computed in code from the 8 criteria. The model's own `overall` string is kept as `model_overall`, and a disagreement is logged.
3. **The claim gate** reads every sentence of all three fields and returns `pass`, `revise` or `needs_review`. It does not call a model.
4. If the verifier failed a criterion or the gate did not pass, **Pass 3** regenerates once, with the failed criteria and the gate's findings quoted. The regeneration goes through Pass 2 and the gate again.
5. If the second try still does not pass, the learner sees the canonical text. A held rewrite is logged as `held-needs-review` with the gate findings, and those rows are the review queue (`personalize_log.needs_review`).

## What the gate holds

The gate reads every sentence of all three fields. A sentence that uses the learner's field vocabulary is a field sentence, unless nearly all of its words, and every field word, come from the canonical entry (a restatement).

| Rule | Holds when | Even when the verifier vouches? |
| --- | --- | --- |
| Unvouched field sentence | The verifier did not quote the sentence in `domain_claims` as supported | Not applicable. Vouching is what clears it. |
| Analogy into the learner's field | The sentence has a comparison marker (think of, like a, similar to, the same way, just as and similar), or the verifier says the rewrite uses an analogy | Yes. All 4 introduced errors were of this kind. |
| Restriction about the field | only, only if, never, cannot, no one, restricted to, unless, locked out, keeps ... inside, just the, does not let and similar, unless a canonical sentence states the same restriction about the same things | Yes. The access-rule errors were restrictions stated as fact. A correction ("do not assume ...") is exempt for its own clause only. |
| Verifier flags | Any `domain_claims` entry marked unsupported or unsure | Not applicable |
| Disputed canonical text | The rewrite repeats a canonical statement the verifier disputes. A disputed statement always goes to canonical review, even when the rewrite is shown. | Not applicable |
| Length | Under 0.4 or over 2 times the canonical length | Asks for a revision, not a hold |

Words with a common software meaning (store, claim, label, unit, parent, shift, alarm, clause, judge and others) never count as field words on their own. They count inside unambiguous phrases such as "their store", "insurance claim" or "script label".

The learner's field comes from the profile: curated lexicons for healthcare, education, finance, legal and trades work, switched on by the job and background, plus the profile's own work words and interests.

An analogy a reviewer has approved can be listed in `approved-analogies.ts`, with the reviewer and the date. For its own term, it clears only the analogy rule, and only in the sentence that contains its anchor as whole words. The list is empty.

## What it cannot do

- It cannot tell that a claim is copied from a wrong canonical entry. The fix for that is correcting and reviewing the canonical text (`docs/canonical-review.md`), and the verifier is now told the canonical entry can be wrong.
- It trusts the verifier's vouch for a field sentence that has no marker and no restriction. A vouched universal claim ("every dispensing label carries a signature") passes.
- It misses an analogy that uses none of the learner's words, for example one drawn from an interest's world ("a network of bird feeders" for a learner whose interest is birdwatching). The dev cases keep this gap visible.
- It misses a field claim worded only with ambiguous words (store, unit, claim and the rest) outside the listed phrases.
- It holds many correct rewrites. On the saved run it holds 76 of 78 accepted outputs when nothing is vouched for and 25 of 78 when everything is, and 9 or 3 of the 9 outputs the AI read-through judged correct. On the 55 dev cases it holds 9 of the 24 labeled correct, and 29 of the 30 labeled wrong.
- The spend check refuses a request whose own worst case could cross a cap, but it does not reserve spend for requests running at the same time.
- It was built after reading the errors it catches and the review findings. Every result on that material is a development result.

## What a learner sees

| Situation | Shown |
| --- | --- |
| A rewrite passed the verifier and the gate | The rewrite, cached |
| Held for review, failed twice, timed out, over the spend cap | The canonical text |
| The cached rewrite was made under an older prompt, profile or model | The canonical text while a new one is made. It was shown before, and an older check had accepted it. |
| The learner reported the rewrite | The canonical text. The report deletes the cached rewrite (the report keeps a copy for review). |
| A hold or verification failure in the last 24 hours for the same term, prompt version and profile version | The canonical text, with no model call. A skipped request does not end the backoff. |
