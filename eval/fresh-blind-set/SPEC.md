# Fresh blind test set for jargon personalize-term (v10)

This spec is for writers who have not seen the jargon evaluation work. Write the set from this page alone. Do not read the jargon repository's `eval/` folder, its claim-gate code (`supabase/functions/personalize-term/claim-*.ts`, `domain-lexicon.ts`), its dev cases, the 2026-10-30 outputs, or any review or register of them. A set written by someone who has seen the known errors measures recall on those errors, not on new ones.

Writers should come from a model family other than Claude, which generates and verifies in the pipeline under test. Domain labels must come from people with the domain knowledge (see Labeling).

## What is being tested

jargon rewrites a technical term's canonical entry (a long definition, a "why it matters" paragraph and an example sentence) for one learner, using that learner's job, background and interests. The pipeline under test has three parts:

1. A generator that writes the rewrite.
2. A verifier model that grades 8 criteria and lists claims it cannot support.
3. A deterministic claim gate that holds a rewrite for human review when it cannot verify a claim. A held rewrite shows the learner the canonical text instead.

The question the set must answer: of the rewrites a learner would see, how many contain a false or unsupported claim, and how many good rewrites does the pipeline throw away?

## Part B first: a labeled rendering set (no generation needed)

This part measures the verifier and the gate without running the generator, so it can be scored offline and repeated with a different verifier.

**Size.** At least 240 renderings, each a triple of `long_definition`, `why_it_matters` and `example_in_sentence` for one term and one profile.

**Mix.**

- At least 100 correct renderings. At least 40 of them use an analogy from the learner's own field that is accurate (for example a correct comparison between a database transaction and a pharmacy's double count of a controlled substance). At least 15 state a correct restrictive claim ("only the prescriber can change the order") and at least 10 use corrective framing ("do not assume every system logs reads"). These measure false holds.
- At least 100 wrong renderings, spread across these kinds, at least 10 of each:
  - an access or permission rule invented about the learner's workplace
  - two scopes conflated (a store and a chain, a unit and a hospital, a class and a district)
  - an artifact, form or document that does not exist in the learner's field
  - a false contrast or a false "only" claim
  - a wrong number, date, size or version
  - reversed cause and effect, or a reversed comparison
  - a correct technical claim paired with a wrong claim about the learner's field
  - an error copied from a wrong canonical entry (write the wrong canonical entry too, and mark it)
  - an analogy drawn from an interest rather than the job, with a false claim in it
  - a claim that is unsupported rather than false (an unpublished figure stated as fact)
- At least 40 renderings where the error, if any, sits only in the example sentence or only in the "why it matters" paragraph.

**Do not** paraphrase any of these known cases, which are already development data: a nurse who "can only open charts on your unit", a pharmacy tech who "only sees patients tied to their store", a "tamper-evident script label", a patient's "login to their pharmacy chart", or staging being "the only place pointed at the real payment provider".

**Profiles.** At least 8, written by the set's authors, fictional, with no real person's details. Cover at least: hospital nurse, community pharmacist, pharmacy technician, high-school teacher, school administrator, electrician or plumber, accountant or bookkeeper, paralegal, and one sparse profile (a job title and nothing else). Give 3 of them a learned vocabulary of 10 to 40 terms.

**Terms.** At least 40 software, data, security, cloud and AI terms, with at least 12 rated hard. Write the canonical entry for each. For the inherited-error cases, write a deliberately wrong canonical entry and say what is wrong with it.

## Part A: an end-to-end set (generation needed, paid)

This part runs the whole pipeline and is judged afterwards.

- At least 40 terms (at least 12 hard) times at least 8 profiles, so at least 320 items.
- Three arms on the same items: the canonical text alone, a plain rewrite with no personalization, and the full pipeline.
- Judges see the three arms' texts in random order without knowing which arm wrote which.

## Labeling

- Every Part B rendering gets a gold label written before any pipeline output exists: `correct`, `wrong-introduced`, `wrong-inherited` or `unsupported`, with the claim quoted, the field it sits in, and a one-sentence reason.
- Two labelers label each rendering independently. Disagreements go to a third person, and the agreement rate is reported.
- Clinical items are labeled by a pharmacist or nurse, education items by a teacher, and so on. The labeler's role is recorded, never their name or employer.
- For Part A, judges read every held output and a random sample of at least 60 accepted outputs, blind to the verdict, using the same labels.

## Locking and scoring

1. Write all files. Compute the SHA-256 of each and record them in `lock.json` with the date.
2. Commit the files and the lock before any scoring run. After that, no file changes.
3. Score once. Report every rate as k of n with a 95% Wilson interval, overall and per kind, per profile and per difficulty.
4. If the pipeline changes after scoring, this set becomes development data, and a new set is needed for the next headline.

## Metrics to report

For Part B, for each of: the verifier alone, the verifier with the claim gate, and a verifier from a different model family:

- Wrong renderings stopped (held or failed), out of all wrong renderings, per kind.
- Correct renderings stopped, out of all correct renderings, with correct field analogies reported separately.
- Unsupported renderings stopped.

For Part A:

- Accepted, held and fallen back, out of all items, per arm.
- Wrong among accepted outputs, estimated from the blind sample, with its interval.
- Judge preference between arms, and whether personalization changed comprehension if a comprehension check is included.

## File formats

`terms.jsonl`, one object per line:

```json
{"id": "t-001", "term": "idempotent", "difficulty": 2, "one_line_definition": "...", "long_definition": "...", "why_it_matters": "...", "example_in_sentence": "...", "canonical_is_wrong": false, "canonical_error": null}
```

`profiles.jsonl`:

```json
{"id": "p-01", "job": "community pharmacist", "education_level": "doctorate", "background_text": "...", "interests": ["..."], "encounter_contexts": ["..."], "known_vocabulary": ["branch", "commit"]}
```

`renderings.jsonl` (Part B):

```json
{"id": "r-0001", "term_id": "t-001", "profile_id": "p-01", "long_definition": "...", "why_it_matters": "...", "example_in_sentence": "...", "uses_analogy": true, "gold": "wrong-introduced", "kind": "invented_access_rule", "field": "example_in_sentence", "claim": "...", "reason": "...", "labelers": ["pharmacist", "pharmacist"], "agreed": true}
```

`items.jsonl` (Part A): `{"id": "a-001", "term_id": "t-001", "profile_id": "p-01"}`.

## Ground rules

- No real patient data and no real person's details. Every person is invented.
- No proprietary material from any employer.
- Nothing in the set may be tuned against the pipeline's output. The writers never run the pipeline.
