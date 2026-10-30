-- jargon Stage B+1.17 — AI domain on-ramp expansion (batch 2: ai-foundations +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 more anchor terms to the `ai-foundations` path. Brings ai-foundations
--   from 8 → 12 terms. Pairs with batch 1 (cloud-migration-041) to give
--   ai-foundations a balanced d1/d2/d3 spread covering the full on-ramp.
--
-- Final ai-foundations distribution after this lands:
--   d1 (4): model, token, inference, training
--   d2 (5): context window, temperature, parameters, generation, neural network
--   d3 (3): pretraining, weights, reasoning
--
-- Depends on: cloud-migration-041 (batch 1 — references aid-training,
--             aid-fine-tuning, aid-generation as prereqs/related)
--
-- WHY THESE FOUR:
--   - neural network: lets a learner read "deep learning" / "neural net"
--     without bouncing off. The shared underlying-tech word.
--   - pretraining: pairs with `training` to explain the two-stage learning
--     pattern. "Trained on X" almost always means "pretrained on X."
--   - weights: the open-vs-closed-AI debate is most of public AI discourse;
--     "open weights" is the operative term.
--   - reasoning: 2025-era key term. Reasoning models (Opus, o3, R1) are now
--     a distinct mode and a distinct pricing tier. Without this word, AI
--     news in 2026 is mostly opaque.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── neural network (d2) ────────────────────────────────────────
('aid-neural-network', 'neural network', null, 'ai-foundations', 'ai', 2,
 'The underlying tech that makes AI work — a layered system loosely modeled on how brain cells connect.',
 'Inside every modern AI is a neural network — layers of mathematical "neurons" that pass signals to each other. Each neuron is a tiny number-cruncher: it adds up inputs, applies a math function, and passes the result to the next layer. Stacked together in the millions or billions, these neurons form the model. The "neural" name comes from a loose analogy with biological brains, but in practice it is linear algebra running at massive scale, not biology.',
 'The whole field rebooted around 2012 when neural networks finally beat older techniques at image recognition.',
 'When someone says "deep learning" or "AI" in a news article, the underlying machinery is almost always a neural network. Knowing the term lets you read past marketing into how a model actually works without feeling lost.',
 ARRAY['aid-parameters','aid-training','aid-model']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A network of computers running AI workloads in the cloud',
   'A graph showing which AIs reference which other AIs',
   'A messaging protocol used between separate AI systems'
 ]::text[],
 'The whole field rebooted around 2012 when ___s finally beat older techniques at image recognition.',
 'Use ''neural network'' in a sentence about the tech behind AI.',
 'curated', 'curator', '2026-05-06'),

-- ─── pretraining (d3) ────────────────────────────────────────
('aid-pretraining', 'pretraining', null, 'ai-foundations', 'ai', 3,
 'The first big phase of training, where a model reads huge piles of generic text before any specialization.',
 'Most modern models go through two training stages: pretraining (massive, generic) and then fine-tuning (smaller, targeted). Pretraining is where the model reads most of the public internet — billions of pages — and learns the structure of language, facts about the world, and how concepts relate. After pretraining, the model is a powerful generalist but does not yet know how to follow instructions cleanly. Fine-tuning teaches that, plus any company-specific behavior.',
 'OpenAI did most of the pretraining on a scraped snapshot of the web, then fine-tuned on human feedback.',
 'When a news article says "trained on X data," it almost always means "pretrained on X data." Knowing the split helps you understand why a fine-tuned model can be small but very good at one thing — most of its general smarts came from the pretrained base.',
 ARRAY['aid-training','aid-fine-tuning','aid-model']::text[],
 ARRAY['aid-training','aid-model']::text[],
 null,
 ARRAY[
   'The setup phase a user goes through before first using a model',
   'A test run on a small dataset to check the training pipeline',
   'The warm-up period for compute clusters before real training begins'
 ]::text[],
 'OpenAI did most of the ___ on a scraped snapshot of the web, then fine-tuned on human feedback.',
 'Use ''pretraining'' in a sentence about the two-stage way modern AI is built.',
 'curated', 'curator', '2026-05-06'),

-- ─── weights (d3) ────────────────────────────────────────
('aid-weights', 'weights', null, 'ai-foundations', 'ai', 3,
 'The actual file that gets shipped after training — billions of numbers that together are the model.',
 'After training, the model''s "knowledge" lives in its weights — the billions of parameters frozen into a giant file. When Meta releases Llama, what they release IS the weights file (sometimes 100GB+). When OpenAI keeps GPT-5 closed, they keep the weights private — you can call the API but never touch the file. "Open weights" means the file is downloadable; "closed weights" or "API-only" means it is not.',
 'Llama 3.1 has open weights, so anyone with a beefy GPU can run it locally.',
 'Open vs. closed weights is most of the public AI-policy debate. Companies that control weights control the AI; companies that release weights enable a whole ecosystem of fine-tunes and forks.',
 ARRAY['aid-parameters','aid-training','aid-fine-tuning']::text[],
 ARRAY['aid-training','aid-parameters']::text[],
 null,
 ARRAY[
   'How much importance the AI assigns to different parts of your prompt',
   'The size of a model measured in gigabytes on disk',
   'The numerical scores a model gives its candidate outputs to rank them'
 ]::text[],
 'Llama 3.1 has open ___, so anyone with a beefy GPU can run it locally.',
 'Use ''weights'' in a sentence about whether an AI is open or closed.',
 'curated', 'curator', '2026-05-06'),

-- ─── reasoning (d3) ────────────────────────────────────────
('aid-reasoning', 'reasoning', null, 'ai-foundations', 'ai', 3,
 'When a model thinks step by step before answering — a mode some newer models can switch into.',
 'Reasoning is the newer trick: instead of producing an answer in one shot, the model first writes out its working — sometimes for thousands of tokens — then commits to a final answer. This produces much better results on hard math, code, and logic problems, but takes longer and costs more. Models like Claude Opus, OpenAI o3, and DeepSeek R1 have explicit reasoning modes; older models can be coaxed into something similar with chain-of-thought prompting, but they are less reliable at it.',
 'Switch the model to reasoning mode if you need it to actually solve the math, not just pattern-match an answer.',
 'When a product page says "reasoning model," "thinking model," or "extended thinking," this is what they mean. Reasoning unlocks tasks that one-shot generation gets wrong, but it is slower and burns more tokens — pricing tiers usually reflect this.',
 ARRAY['aid-chain-of-thought','aid-generation','aid-model']::text[],
 ARRAY['aid-model','aid-generation']::text[],
 null,
 ARRAY[
   'The internal routing logic that picks which model handles a request',
   'The explanation an AI gives at the end for why it chose its answer',
   'The text the AI retrieves from a knowledge base before generating'
 ]::text[],
 'Switch the model to ___ mode if you need it to actually solve the math.',
 'Use ''reasoning'' in a sentence about a model that thinks step by step.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
