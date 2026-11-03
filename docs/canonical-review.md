# Canonical review

The personalize verifier compares every rewrite against the canonical entry for the term (`supabase/seed.sql`). Until prompt version 10 it was told to treat that entry as true. On the 2026-10-30 run three canonical entries were wrong, and one of those errors reached learners: the rewrites copied the false staging claim and the verifier accepted it because it matched the canonical text.

This page records what was corrected, what still needs a person, and how the pipeline now handles a canonical entry it doubts.

## How the pipeline treats canonical text now

- The verifier prompt says the canonical entry can be wrong. The verifier lists any doubtful canonical statement in `canonical_concerns`, and the claim gate holds the rewrite for review when that list is not empty. The learner sees the canonical text, and the log row is marked `needs_review`.
- `supabase/migrations/20261103000100_canonical_corrections.sql` corrects the three entries below. Each update only applies while the old text is still there, so a later curator edit is never overwritten. It also removes cached renderings of those three terms, since they were written from the old text.
- `scripts/audit-canonical.mjs` lists the entries a person should read first (see the audit section).

## Status: corrected, not yet reviewed by a person

Claude made these corrections on 2026-11-03 from the evaluation findings. No person has reviewed them yet. Kevin's decision: accept, edit or reject each one before the migration runs in production.

Every one of the 646 seed rows says `reviewed_by = 'curator'`. Nothing in the repository records who reviewed what or when, so that label is not evidence of review. The corrections leave the label as it is rather than add a second unsupported claim.


### `cloud-environment`

**example_in_sentence**

Before:

```text
the bug only shows up in the staging environment because that's the only place pointed at the real payment provider.
```

After:

```text
the bug shows up in the staging environment but not in production, because staging points at the payment provider's sandbox instead of the live account.
```

Why: Production is the environment pointed at the live payment provider. Staging normally points at the provider's sandbox, so 'the only place pointed at the real payment provider' is backwards. The 2026-10-30 rewrites inherited this claim and the verifier accepted it because it matched the canonical text.

**fill_in_blank_sentence**

Before:

```text
the bug only shows up in the staging ___ because that's the only place pointed at the real payment provider.
```

After:

```text
the bug shows up in the staging ___ but not in production, because staging points at the payment provider's sandbox instead of the live account.
```

Why: The quiz item repeated the same backwards claim, so the error was also being tested.


### `bi-calculated-column`

**why_it_matters**

Before:

```text
a calculated column is figured out once per row and frozen into the table, unlike a measure that recalculates with filters. mixing them up is a classic Power BI mistake — using a column where you needed a measure gives you totals that won't move when you slice.
```

After:

```text
a calculated column is figured out once per row and stored in the table, unlike a measure that recalculates with filters. mixing them up is a classic Power BI mistake. a margin percentage stored as a column gets added up or averaged row by row in a visual, so its total comes out wrong, while a margin measure divides the filtered totals and stays right as you slice.
```

Why: Totals built on a calculated column do move when you slice, because slicing filters the rows being added up. The real mistake is a per-row ratio: summing or averaging stored percentages gives a wrong total. 'Frozen' also overstates it, since the column is recomputed on refresh.


### `aid-parameters`

**long_definition**

Before:

```text
When you see a model described as "70B" or "405B," that "B" means billion parameters. Parameters are the internal settings a model fine-tuned during training — billions of tiny adjustments that together encode what it knows. More parameters generally mean better answers but slower responses and higher cost per inference. The biggest open-weight models (Llama 405B) and frontier models (Claude, GPT-5) are both in the hundreds of billions of parameters.
```

After:

```text
When you see a model described as "70B" or "405B," that "B" means billion parameters. Parameters are the internal numbers a model learns during training, billions of tiny adjustments that together encode what it knows. More parameters generally mean better answers but slower responses and higher cost per request. Open-weight models publish their size (Llama 3.1 405B has 405 billion parameters), while Anthropic and OpenAI do not publish parameter counts for Claude or GPT-5.
```

Why: Parameters are learned in training, and fine-tuning is a later, separate step. Anthropic and OpenAI have not published parameter counts for Claude or GPT-5, so stating them as hundreds of billions is unsupported.

**example_in_sentence**

Before:

```text
Llama 3 70B has 70 billion parameters — smaller than Claude but small enough to run on a laptop.
```

After:

```text
Llama 3 70B has 70 billion parameters, so running it yourself takes a machine with a lot of memory, even after it is compressed (quantized).
```

Why: Claude's size is unpublished, so 'smaller than Claude' cannot be checked. A 70B model needs about 140 GB of memory at 16-bit precision and roughly 40 GB at 4-bit, which is a high-memory workstation or a top-end laptop, not a laptop in general.

**why_it_matters**

Before:

```text
Reading product names like "GPT-5", "Claude Opus 4.7", "Gemini 2.5 Pro", or "Llama 405B" makes more sense once you know that the "B" is billions of parameters. It is the simplest rough comparison of model heft, even though parameters alone do not tell you everything about quality.
```

After:

```text
Open-weight model names like "Llama 3 70B" or "Llama 3.1 405B" make more sense once you know that the "B" is billions of parameters. Names like "GPT-5" or "Claude Opus 4.7" carry no size, because those companies do not publish it. Size is the simplest rough comparison of model heft, even though parameters alone do not tell you everything about quality.
```

Why: Only one of the four names listed carries a 'B'. The old wording implied the others encode a parameter count.


## Audit

Run `node scripts/audit-canonical.mjs` (add `--json` for the sentences). On the corrected seed it flags 146 of 646 entries:

| Flag | Entries | What it means |
| --- | --- | --- |
| `exclusive_claim` | 144 of 646 | A sentence says only, never, cannot, no one or similar. Two of the three known errors were claims of this kind. |
| `quiz_tests_claim` | 48 of 646 | The fill-in-the-blank sentence carries such a claim, so learners are graded on it. |
| `unpublished_or_dated` | 2 of 646 | A commercial model is named next to a size or a count. |
| `malformed_blank` | 0 of 646 | The fill-in-the-blank sentence does not have exactly one blank. |

A flag means "read this", not "this is wrong". Most flagged sentences are sound advice such as "never commit a secret". Suggested order: the 48 quiz sentences first, in batches of 20, then the rest of the exclusive claims.

What the audit cannot do:

- It finds marker words, not false statements. The calculated-column error ("totals that won't move when you slice") has no marker word, and the audit misses it.
- It was written after the three errors were known, so the fact that it flags two of them is a development check, not a measure of how many errors it would find.

## What a real review needs

- A person with the domain knowledge reads each flagged entry and records the decision, the reviewer and the date.
- Terms the ingest job writes (`source = 'ai-generated'`) start unreviewed. Learners do not see them until someone sets `reviewed_at` (`supabase/migrations/20261103000200_hide_unreviewed_generated_terms.sql`).
