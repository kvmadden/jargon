-- Canonical corrections from the 2026-11-03 review (docs/canonical-review.md).
--
-- The verifier compared every rewrite against these canonical entries and
-- treated them as true. Three of them were wrong, and one error (the staging
-- environment claim) reached learners through rewrites that copied it.
--
-- Each update is guarded on the old text, so an entry a curator has since
-- edited is left alone. Running this twice changes nothing the second time.
-- Kevin accepted these corrections on 2026-11-03 and asked that they stay as
-- short and plain as a typical entry, so the text below is the shortened
-- version. reviewed_by is not changed, and the review doc records who made
-- each correction and why.

-- cloud-environment.example_in_sentence
update terms
   set example_in_sentence = 'The bug shows up in staging but not in production, since staging uses a test payment account.'
 where id = 'cloud-environment'
   and example_in_sentence = 'the bug only shows up in the staging environment because that''s the only place pointed at the real payment provider.';

-- cloud-environment.fill_in_blank_sentence
update terms
   set fill_in_blank_sentence = 'The bug shows up in the staging ___ but not in production, since staging uses a test payment account.'
 where id = 'cloud-environment'
   and fill_in_blank_sentence = 'the bug only shows up in the staging ___ because that''s the only place pointed at the real payment provider.';

-- bi-calculated-column.why_it_matters
update terms
   set why_it_matters = 'A calculated column is worked out once per row and stored. A measure recalculates for the filters in use. Mixing them up causes wrong totals, such as a margin percentage that gets added up row by row.'
 where id = 'bi-calculated-column'
   and why_it_matters = 'a calculated column is figured out once per row and frozen into the table, unlike a measure that recalculates with filters. mixing them up is a classic Power BI mistake — using a column where you needed a measure gives you totals that won''t move when you slice.';

-- aid-parameters.long_definition
update terms
   set long_definition = 'When a model is called "70B" or "405B," the "B" means billions of parameters. Parameters are the numbers a model learns in training. More parameters usually mean better answers but slower, costlier responses. Anthropic and OpenAI do not publish counts for Claude or GPT-5.'
 where id = 'aid-parameters'
   and long_definition = 'When you see a model described as "70B" or "405B," that "B" means billion parameters. Parameters are the internal settings a model fine-tuned during training — billions of tiny adjustments that together encode what it knows. More parameters generally mean better answers but slower responses and higher cost per inference. The biggest open-weight models (Llama 405B) and frontier models (Claude, GPT-5) are both in the hundreds of billions of parameters.';

-- aid-parameters.example_in_sentence
update terms
   set example_in_sentence = 'Llama 3 70B has 70 billion parameters, so it needs a machine with a lot of memory.'
 where id = 'aid-parameters'
   and example_in_sentence = 'Llama 3 70B has 70 billion parameters — smaller than Claude but small enough to run on a laptop.';

-- aid-parameters.why_it_matters
update terms
   set why_it_matters = 'Names like "Llama 3 70B" make sense once you know the "B" means billions of parameters. Size gives a rough sense of a model''s power and cost, but it does not tell you everything about quality.'
 where id = 'aid-parameters'
   and why_it_matters = 'Reading product names like "GPT-5", "Claude Opus 4.7", "Gemini 2.5 Pro", or "Llama 405B" makes more sense once you know that the "B" is billions of parameters. It is the simplest rough comparison of model heft, even though parameters alone do not tell you everything about quality.';

-- Personalized renderings of these three terms were written from the old
-- text, so they are removed and regenerate from the corrected entries.
delete from user_term_renderings
 where term_id in ('aid-parameters', 'bi-calculated-column', 'cloud-environment');
