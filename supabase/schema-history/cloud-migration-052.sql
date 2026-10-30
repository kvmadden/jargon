-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-evaluation +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-evaluation` path. Brings ai-evaluation
--   from 7 → 11 terms. Cloud-migration-040 seeded benchmark, grounding,
--   and hallucination; cloud-migration-047 added evals, human eval,
--   drift, and red team. This batch fills the four most-load-bearing
--   STATISTICS-FROM-ML-BORROWED words a non-engineer hits the moment
--   they read a model evaluation report or a release blog post:
--     - accuracy (d1): the simplest score — "how often is the AI right."
--       The starting word; sits one step deeper than evals (which is
--       the test suite; accuracy is one number the test suite produces).
--     - precision (d2): when the AI says "yes," how often is it
--       actually yes. The false-alarm half of the trade-off.
--     - recall (d2): of all the things the AI should have flagged,
--       how many did it catch. The miss half of the trade-off.
--     - regression (d3): when the AI gets WORSE at something it used
--       to do well — usually after a retraining or update. The "it
--       used to handle this fine" word that shows up in every model
--       update post-mortem.
--
-- Depends on: cloud-migration-027 (ai-evaluation in path CHECK constraint),
--             cloud-migration-040 (aid-benchmark, aid-grounding,
--             aid-hallucination as related/prereq),
--             cloud-migration-047 (aid-evals, aid-human-eval, aid-drift
--             as related/prereq for these new rows),
--             cloud-migration-039 (aid-model, aid-training as prereqs).
--
-- DIFFICULTY MIX:
--   One d1 (accuracy) — the simplest score; "got it right" is graspable
--     immediately; the foundation precision and recall sit on top of.
--   Two d2 (precision, recall) — paired statistics terms. Each one is
--     graspable in isolation; the trade-off between them is what makes
--     them d2 instead of d1. Both canonical entries name the pairing
--     explicitly so the learner sees them as a set.
--   One d3 (regression) — sits one level up because (a) it requires
--     the prior idea that a model has a baseline to regress from, and
--     (b) it has a name collision with statistical regression that the
--     canonical entry has to address head-on.
--
-- INLINE DEFINITION NOTES (per HARD RULES — no unexplained jargon):
--   - precision and recall canonical entries DO NOT use the words
--     "true positive," "false positive," "false negative" without
--     inline glosses. Where the concepts appear, they are translated:
--     "the AI flagged something that was not actually there" instead
--     of "false positive." This keeps the entries grounded for a
--     learner with no statistics background.
--   - precision and recall each name the OTHER explicitly and call
--     out the trade-off in plain English ("you can usually push one
--     up by letting the other slide").
--   - regression has TWO meanings in ML/AI (statistical regression as
--     a modeling technique vs. behavior regression — a deployed model
--     getting worse). Canonical entry calls out the dual meaning in
--     one line and stays focused on the BEHAVIOR meaning, which is
--     what a non-engineer hits in release notes and post-mortems.
--
-- VERIFIABILITY DISCIPLINE (operating principle):
--   Examples in canonical content stay UNIVERSAL. No clinical decision
--   support. No specific medical/legal/financial claims. Examples use
--   neutral framings — "the model flagged X," "the assistant missed Y,"
--   "the new version got worse at Z" — that any learner can verify
--   from a single eval report. Lived-domain analogies belong to the
--   personalize-term layer, not here.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── accuracy (d1) ────────────────────────────────────────
('aid-accuracy', 'accuracy', null, 'ai-evaluation', 'ai', 1,
 'How often the AI gets the answer right — the share of test questions it answered correctly out of the total.',
 'Accuracy is the simplest score on a model''s report card. You take a set of test questions where you already know the right answer, run the AI on every one, and count what fraction it got right. If the model answered 87 out of 100 correctly, that is 87% accuracy. It is the first number people look at on a release announcement, and the first number a team checks when something feels off. The catch: accuracy alone can hide problems — a model that always says "no" can still look highly accurate if "no" is the right answer most of the time. That is why teams pair it with other measures.',
 'The new model hit 92% accuracy on the reasoning eval, four points higher than the previous version.',
 'Accuracy is the easiest AI quality number to read, which is exactly why it shows up in headlines. Knowing the word — and knowing it is one number out of several — lets you read a model release and ask the next question, which is always "accurate at what, and compared to what?"',
 ARRAY['aid-evals','aid-benchmark','aid-precision','aid-recall']::text[],
 ARRAY['aid-evals']::text[],
 null,
 ARRAY[
   'The speed at which an AI generates each word of its response',
   'A measure of how confident the AI is in its own answer',
   'The total number of test questions a model has been trained on'
 ]::text[],
 'The new model hit 92% ___ on the reasoning eval, four points higher than the previous version.',
 'Use ''accuracy'' in a sentence about how often an AI gets the answer right.',
 'curated', 'curator', '2026-05-06'),

-- ─── precision (d2) ────────────────────────────────────────
('aid-precision', 'precision', null, 'ai-evaluation', 'ai', 2,
 'When the AI says "yes, this is the thing," how often it is actually right — the share of its positive calls that turn out to be real, not false alarms.',
 'Precision answers a single, narrow question: of the times the AI flagged something, how often was it correct? If the model marked 100 emails as spam and 90 of them really were spam, that is 90% precision. The other 10 are false alarms — things the AI flagged that were not actually there. Precision is the number you care about when false alarms are expensive: every flag triggers a follow-up, an interruption, a wasted check. Precision pairs with recall (the next term in this path) — they trade off against each other, and you can usually push one up by letting the other slide. Reading precision alone tells you only half the story.',
 'The spam filter has 95% precision, which means almost everything it flags really is spam — but it might still be missing plenty.',
 'When a model release boasts "high precision," they mean its yes-calls are trustworthy — but they are NOT saying it caught everything. Knowing precision (and that it pairs with recall) lets you ask the right follow-up: "okay, but what is it missing?"',
 ARRAY['aid-recall','aid-accuracy','aid-evals','aid-benchmark']::text[],
 ARRAY['aid-accuracy']::text[],
 null,
 ARRAY[
   'How tightly an AI sticks to a specific output format',
   'The number of decimal places used in a model''s confidence score',
   'A measure of how short and direct the AI''s answers are'
 ]::text[],
 'The spam filter has 95% ___, which means almost everything it flags really is spam — but it might still be missing plenty.',
 'Use ''precision'' in a sentence about how often the AI''s positive calls are actually correct.',
 'curated', 'curator', '2026-05-06'),

-- ─── recall (d2) ────────────────────────────────────────
('aid-recall', 'recall', null, 'ai-evaluation', 'ai', 2,
 'Of all the things the AI was supposed to flag, how many it actually caught — the share of real cases it found, not the ones it missed.',
 'Recall answers the other half of the question precision answers. If 100 of the emails coming into your inbox were really spam and the filter caught 80 of them, that is 80% recall — the other 20 slipped through. Recall is the number you care about when MISSING something is expensive: a missed case is a problem the AI never raised. Recall pairs with precision and trades off against it: a model that flags everything will have near-perfect recall (it catches everything) but terrible precision (most flags are wrong); a cautious model that only flags the obvious cases will have high precision but low recall. Reading both together is the only honest picture.',
 'The new detection model improved recall from 70% to 85% — it is catching more of the real cases now, with only a small drop in precision.',
 'Recall is the half of the picture that release announcements often skip. Knowing the word lets you ask the question that matters most for high-stakes uses: "okay, but what did it miss?" — and read the precision/recall pair as the trade-off it actually is.',
 ARRAY['aid-precision','aid-accuracy','aid-evals','aid-benchmark']::text[],
 ARRAY['aid-accuracy']::text[],
 null,
 ARRAY[
   'The ability of an AI to remember earlier turns of the conversation',
   'How quickly an AI returns its answer after the prompt is sent',
   'A user-facing button that asks the AI to retry its last response'
 ]::text[],
 'The new detection model improved ___ from 70% to 85% — it is catching more of the real cases now, with only a small drop in precision.',
 'Use ''recall'' in a sentence about how many of the real cases an AI caught.',
 'curated', 'curator', '2026-05-06'),

-- ─── regression (d3) ────────────────────────────────────────
('aid-regression', 'regression', null, 'ai-evaluation', 'ai', 3,
 'When an AI gets WORSE at something it used to do well — usually after retraining or an update — even though it gets better elsewhere.',
 'A regression is the AI version of "it used to work fine." A team trains a new version of a model, ships it, and then notices the new version handles a task LESS well than the old one did — even though the overall scores went up. The word has two meanings in AI: statistical regression is a modeling technique (predicting a number from inputs), but THIS use of "regression" — the one that shows up in release notes and post-mortems — means a behavior step backward. Regressions are why teams keep the old eval results around: every new version gets compared to the previous one, side by side, so the wins do not quietly hide the losses.',
 'The new model got better at coding overall, but the team caught a regression on long-document summaries — the old version had handled them better.',
 'Regression is why "the new model is better" is rarely the whole story. There is almost always SOMETHING the new version handles worse. Knowing the word lets you read a release announcement honestly and ask the question every team has to answer: "great, what did it regress on?"',
 ARRAY['aid-evals','aid-drift','aid-accuracy','aid-benchmark']::text[],
 ARRAY['aid-evals','aid-model']::text[],
 null,
 ARRAY[
   'The technique of running a model backward to explain its prediction',
   'A pricing tier where users pay less when the AI''s confidence is low',
   'The phase of training where the model studies its own past mistakes'
 ]::text[],
 'The new model got better at coding overall, but the team caught a ___ on long-document summaries — the old version had handled them better.',
 'Use ''regression'' in a sentence about an AI getting worse at something it used to do well.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
