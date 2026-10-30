-- jargon Stage B+1.17 — AI domain on-ramp expansion (batch 1: ai-foundations +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-foundations` path. Brings ai-foundations
--   from 4 → 8 terms. Closes the most-load-bearing on-ramp gap: a learner
--   coming to the AI domain currently has model + token + context-window +
--   temperature. They lack the words for the two halves of how AI works
--   (training vs inference), the unit news headlines use to compare model
--   sizes (parameters), and the word for what AI produces (generation).
--
-- Depends on: cloud-migration-027 (AI domain paths in CHECK constraint),
--             cloud-migration-039 + 040 (existing ai-foundations terms;
--             these new rows reference aid-model and aid-token as prereqs)
--
-- WHY THIS BATCH FIRST:
--   The user's stated goal for the AI domain is "follow modern AI
--   conversations" — read news, talk to product people, understand pricing
--   and capability claims. The four terms here unlock the four most-common
--   sources of confusion for a non-engineer:
--     - inference: what AI does when you ask it something (vs training)
--     - training: where AI's "knowledge" came from (and the cutoff date)
--     - parameters: the "B" number in "Llama 3 70B" / "GPT-5"
--     - generation: what AI's output is called (vs your input/prompt)
--   These are also the right difficulty mix: 2×d1 + 2×d2, balancing the
--   existing 2×d1 + 2×d2 and giving a clean d3 ceiling for batch 2.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── inference (d1) ────────────────────────────────────────
('aid-inference', 'inference', null, 'ai-foundations', 'ai', 1,
 'When you ask an AI a question and it answers, that act is called inference.',
 'Every time you type a prompt into ChatGPT or Claude, you are running an inference. The model takes your input, runs it through its trained knowledge, and produces an output. The model does not learn anything new during inference — it only applies what it already learned during training. This is also why AI services often price by "inferences" or "requests": one inference = one round-trip from prompt to answer.',
 'Each chat message I send fires off another inference on the server.',
 'Knowing the word "inference" lets you read AI pricing pages and product specs. When a service says "1M inferences per month," that is just "1 million AI question-and-answer pairs per month."',
 ARRAY['aid-model','aid-token']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A logical conclusion you draw from incomplete data',
   'The process of preparing AI training data',
   'A type of database query that returns multiple rows'
 ]::text[],
 'Each chat message I send fires off another ___ on the server.',
 'Use ''inference'' in a sentence about asking an AI a question.',
 'curated', 'curator', '2026-05-06'),

-- ─── training (d1) ────────────────────────────────────────
('aid-training', 'training', null, 'ai-foundations', 'ai', 1,
 'How a model became smart in the first place — by reading huge amounts of data over weeks or months.',
 'Before any model can answer your questions, it has to be trained — fed billions of pages of text and slowly shown which patterns matter. Training is the slow, expensive part of the AI lifecycle: it can take months, cost tens of millions of dollars, and require thousands of GPUs running in parallel. Once a model is trained, the result is a frozen snapshot of what it learned, which then gets shipped to users for inference. Training only happens once for any given model version.',
 'GPT-5 was trained on text scraped through 2025.',
 'When an AI does not know about something recent, training is usually why — the cutoff date is when training stopped. It also explains why making a brand-new model is so hard: training is most of the cost, and you cannot just "add" a few new facts without retraining.',
 ARRAY['aid-model','aid-inference','aid-parameters']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A test the AI takes after launch to prove it still works',
   'The onboarding flow when a user first installs an AI app',
   'The fine-tuning step that adapts a base model to a company''s data'
 ]::text[],
 'GPT-5 was ___ on text scraped through 2025.',
 'Use ''training'' in a sentence about how a model learned.',
 'curated', 'curator', '2026-05-06'),

-- ─── parameters (d2) ────────────────────────────────────────
('aid-parameters', 'parameters', null, 'ai-foundations', 'ai', 2,
 'A rough measure of model size — the number of "knobs" the model adjusted during training. Bigger usually means smarter, slower, and more expensive.',
 'When you see a model described as "70B" or "405B," that "B" means billion parameters. Parameters are the internal settings a model fine-tuned during training — billions of tiny adjustments that together encode what it knows. More parameters generally mean better answers but slower responses and higher cost per inference. The biggest open-weight models (Llama 405B) and frontier models (Claude, GPT-5) are both in the hundreds of billions of parameters.',
 'Llama 3 70B has 70 billion parameters — smaller than Claude but small enough to run on a laptop.',
 'Reading product names like "GPT-5", "Claude Opus 4.7", "Gemini 2.5 Pro", or "Llama 405B" makes more sense once you know that the "B" is billions of parameters. It is the simplest rough comparison of model heft, even though parameters alone do not tell you everything about quality.',
 ARRAY['aid-model','aid-training']::text[],
 ARRAY['aid-model','aid-training']::text[],
 null,
 ARRAY[
   'The arguments you pass to an AI API call (temperature, max_tokens, etc.)',
   'The settings page where users configure their AI assistant',
   'The fields a model fills in when extracting structured data'
 ]::text[],
 'Llama 3 70B has 70 billion ___.',
 'Use ''parameters'' in a sentence comparing the size of two AI models.',
 'curated', 'curator', '2026-05-06'),

-- ─── generation (d2) ────────────────────────────────────────
('aid-generation', 'generation', null, 'ai-foundations', 'ai', 2,
 'What the AI produces in response to your prompt — the actual text or image it makes.',
 'Generation is the AI''s output side: the text in a chat reply, the image in a Midjourney render, the code in a Copilot suggestion. It is what the model "generates" — built one token at a time, predicted from context. Generation can be fast (a few words per second) or slow (a long essay over a minute), and the cost is usually billed by the token. When people say "generative AI," generation is the part that makes it generative.',
 'The generation cut off mid-sentence because we hit the token limit.',
 'Knowing the split between input (your prompt) and generation (the AI''s reply) helps when reading API docs, pricing, and error messages — most providers charge separately for "input tokens" and "output tokens."',
 ARRAY['aid-token','aid-prompt','aid-temperature']::text[],
 ARRAY['aid-model','aid-token']::text[],
 null,
 ARRAY[
   'The version number of a model line — "this is the third generation"',
   'A type of AI specifically built to make images and video',
   'The internal step where the AI plans the structure of its response'
 ]::text[],
 'The ___ cut off mid-sentence because we hit the token limit.',
 'Use ''generation'' in a sentence about an AI''s output.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
