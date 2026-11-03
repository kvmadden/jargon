-- Canonical corrections from the 2026-11-03 review (docs/canonical-review.md).
--
-- The verifier compared every rewrite against these canonical entries and
-- treated them as true. Three of them were wrong, and one error (the staging
-- environment claim) reached learners through rewrites that copied it.
--
-- Each update is guarded on the old text, so an entry a curator has since
-- edited is left alone. Running this twice changes nothing the second time.
-- reviewed_by is not changed: these corrections still need a human review,
-- and the review doc records who made them and why.

-- cloud-environment.example_in_sentence
update terms
   set example_in_sentence = 'the bug shows up in the staging environment but not in production, because staging points at the payment provider''s sandbox instead of the live account.'
 where id = 'cloud-environment'
   and example_in_sentence = 'the bug only shows up in the staging environment because that''s the only place pointed at the real payment provider.';

-- cloud-environment.fill_in_blank_sentence
update terms
   set fill_in_blank_sentence = 'the bug shows up in the staging ___ but not in production, because staging points at the payment provider''s sandbox instead of the live account.'
 where id = 'cloud-environment'
   and fill_in_blank_sentence = 'the bug only shows up in the staging ___ because that''s the only place pointed at the real payment provider.';

-- bi-calculated-column.why_it_matters
update terms
   set why_it_matters = 'a calculated column is figured out once per row and stored in the table, unlike a measure that recalculates with filters. mixing them up is a classic Power BI mistake. a margin percentage stored as a column gets added up or averaged row by row in a visual, so its total comes out wrong, while a margin measure divides the filtered totals and stays right as you slice.'
 where id = 'bi-calculated-column'
   and why_it_matters = 'a calculated column is figured out once per row and frozen into the table, unlike a measure that recalculates with filters. mixing them up is a classic Power BI mistake — using a column where you needed a measure gives you totals that won''t move when you slice.';

-- aid-parameters.long_definition
update terms
   set long_definition = 'When you see a model described as "70B" or "405B," that "B" means billion parameters. Parameters are the internal numbers a model learns during training, billions of tiny adjustments that together encode what it knows. More parameters generally mean better answers but slower responses and higher cost per request. Open-weight models publish their size (Llama 3.1 405B has 405 billion parameters), while Anthropic and OpenAI do not publish parameter counts for Claude or GPT-5.'
 where id = 'aid-parameters'
   and long_definition = 'When you see a model described as "70B" or "405B," that "B" means billion parameters. Parameters are the internal settings a model fine-tuned during training — billions of tiny adjustments that together encode what it knows. More parameters generally mean better answers but slower responses and higher cost per inference. The biggest open-weight models (Llama 405B) and frontier models (Claude, GPT-5) are both in the hundreds of billions of parameters.';

-- aid-parameters.example_in_sentence
update terms
   set example_in_sentence = 'Llama 3 70B has 70 billion parameters, so running it yourself takes a machine with a lot of memory, even after it is compressed (quantized).'
 where id = 'aid-parameters'
   and example_in_sentence = 'Llama 3 70B has 70 billion parameters — smaller than Claude but small enough to run on a laptop.';

-- aid-parameters.why_it_matters
update terms
   set why_it_matters = 'Open-weight model names like "Llama 3 70B" or "Llama 3.1 405B" make more sense once you know that the "B" is billions of parameters. Names like "GPT-5" or "Claude Opus 4.7" carry no size, because those companies do not publish it. Size is the simplest rough comparison of model heft, even though parameters alone do not tell you everything about quality.'
 where id = 'aid-parameters'
   and why_it_matters = 'Reading product names like "GPT-5", "Claude Opus 4.7", "Gemini 2.5 Pro", or "Llama 405B" makes more sense once you know that the "B" is billions of parameters. It is the simplest rough comparison of model heft, even though parameters alone do not tell you everything about quality.';

-- Personalized renderings of these three terms were written from the old
-- text, so they are removed and regenerate from the corrected entries.
delete from user_term_renderings
 where term_id in ('aid-parameters', 'bi-calculated-column', 'cloud-environment');
