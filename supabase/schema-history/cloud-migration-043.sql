-- jargon Stage B+1.17 — AI domain on-ramp correction (acronyms, re-tier, bedrock)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Three corrections to the AI on-ramp, applied as one migration:
--
-- 1. ACRONYM CLEANUP — migrations 041 + 042 introduced GPU and API in
--    canonical content without defining them as terms first. This violates
--    the project rule "no unexplained acronyms." Rewriting affected long
--    definitions, examples, fill-blanks, and distractors to use plain
--    English ("specialized chips", "remote", "developer documentation").
--    GPU and API are coding-domain concepts; the AI domain learner does
--    not need them as standalone terms.
--
-- 2. RE-TIER — `aid-token` and `aid-inference` were marked difficulty=1 but
--    are technical terms most novices have never heard. Bumping both to
--    difficulty=2 ("you have used AI a bit, here is the technical word for
--    what is happening"). Difficulty 1 is reserved for words a complete
--    novice would already half-recognize.
--
-- 3. BEDROCK TERMS — adding three difficulty=1 entries that any user who
--    has ever opened ChatGPT can answer: `aid-ai`, `aid-assistant`,
--    `aid-response`. These are deliberately chosen because they
--    personalize beautifully into ANY lived domain (the personalize-term
--    Edge Function can ground "asking AI a question and getting back an
--    answer" in pharmacy, ecology, finance, etc. — the structural pattern
--    is universal).
--
-- Depends on: cloud-migration-039 (aid-token, aid-inference originally d1),
--             cloud-migration-041 (aid-training, aid-generation, aid-parameters
--             with acronym violations), cloud-migration-042 (aid-weights with
--             multiple acronym violations).
--
-- IDEMPOTENT: UPDATEs by id only touch existing rows; INSERTs use
--   on-conflict do nothing. Safe to re-apply.

-- ============================================================
-- 1. ACRONYM CLEANUP
-- ============================================================

-- aid-training: replace "thousands of GPUs running in parallel"
update terms set
  long_definition = 'Before any model can answer your questions, it has to be trained — fed billions of pages of text and slowly shown which patterns matter. Training is the slow, expensive part of the AI lifecycle: it can take months, cost tens of millions of dollars, and require thousands of specialized chips running in parallel. Once a model is trained, the result is a frozen snapshot of what it learned, which then gets shipped to users for inference. Training only happens once for any given model version.'
where id = 'aid-training';

-- aid-generation: replace "API docs"
update terms set
  why_it_matters = 'Knowing the split between input (your prompt) and generation (the AI''s reply) helps when reading developer documentation, pricing, and error messages — most providers charge separately for "input tokens" and "output tokens."'
where id = 'aid-generation';

-- aid-parameters: replace "AI API call" in distractor #1
update terms set
  multiple_choice_distractors = ARRAY[
    'The settings you adjust when sending a request to an AI service (temperature, max length, etc.)',
    'The settings page where users configure their AI assistant',
    'The fields a model fills in when extracting structured data'
  ]::text[]
where id = 'aid-parameters';

-- aid-weights: replace "API" (×2), "GPU" — long_def + example + fill_in_blank
update terms set
  long_definition = 'After training, the model''s "knowledge" lives in its weights — the billions of parameters frozen into a giant file. When Meta releases Llama, what they release IS the weights file (sometimes 100GB or more). When OpenAI keeps GPT-5 closed, they keep the weights private — you can talk to the model remotely but never download it. "Open weights" means the file is downloadable; "closed weights" or "remote-only" means it is not.',
  example_in_sentence = 'Llama 3.1 has open weights, so anyone with a powerful enough computer can run it locally.',
  fill_in_blank_sentence = 'Llama 3.1 has open ___, so anyone with a powerful enough computer can run it locally.'
where id = 'aid-weights';

-- ============================================================
-- 2. RE-TIER token + inference from d1 → d2
-- ============================================================

update terms set difficulty = 2 where id in ('aid-token', 'aid-inference');

-- ============================================================
-- 3. BEDROCK d1 TERMS — universally personalizable
-- ============================================================

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── aid-ai (d1) — the umbrella word ────────────────────────────
('aid-ai', 'AI', 'A-I', 'ai-foundations', 'ai', 1,
 'A computer program that can hold a real conversation, write things, and answer questions the way a person would.',
 'AI — short for artificial intelligence — is the umbrella name for software that does work that used to require a human. The kind of AI most people use today (ChatGPT, Claude, Gemini, Copilot) is good with language: reading, writing, summarizing, explaining, brainstorming. Older systems called "AI" were much narrower (a chess engine, a spell-checker); today''s AI is broad and conversational, which is why it suddenly shows up in news, products, and meetings everywhere.',
 'I asked the AI to summarize the case notes before our meeting.',
 'When the news, an ad, or a coworker says "the AI said..." or "AI is going to change everything," knowing what AI actually means lets you cut through the hype and ask the real question: which AI, doing what specifically.',
 ARRAY['aid-assistant','aid-model','aid-chatbot']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A search engine that finds exact keyword matches across the web',
   'A physical robot that performs tasks like cleaning or assembly',
   'Software that watches your behavior and personalizes ads'
 ]::text[],
 'I asked the ___ to summarize the case notes before our meeting.',
 'Use ''AI'' in a sentence about asking a computer to help with a task.',
 'curated', 'curator', '2026-05-06'),

-- ─── aid-assistant (d1) — the product category ──────────────────
('aid-assistant', 'AI assistant', null, 'ai-foundations', 'ai', 1,
 'The product name for an AI you talk to in a chat — ChatGPT, Claude, Gemini, and Copilot are all AI assistants.',
 'When companies say "AI assistant," they mean an AI you ask questions and have a back-and-forth conversation with. The category includes ChatGPT (OpenAI), Claude (Anthropic), Gemini (Google), Copilot (Microsoft), and many others. Each has slightly different strengths, tone, and pricing, but all share the same basic shape: you type, it answers, the thread keeps going. The "assistant" is what users interact with; the "model" is what is under the hood.',
 'My team uses three different AI assistants, one for each kind of task.',
 'Assistant is the everyday word; model is the technical word. You pick an assistant in the app store; the company picked the model that powers it. Knowing the split makes product pages and reviews much easier to read.',
 ARRAY['aid-ai','aid-model','aid-chatbot','aid-copilot']::text[],
 ARRAY['aid-ai']::text[],
 null,
 ARRAY[
   'A team of remote human contractors you hire to do tasks for you',
   'A search engine that returns a single answer instead of a list of links',
   'Software that automates repetitive tasks based on rules you set up'
 ]::text[],
 'My team uses three different AI ___s, one for each kind of task.',
 'Use ''AI assistant'' in a sentence about a chat-based AI you have used.',
 'curated', 'curator', '2026-05-06'),

-- ─── aid-response (d1) — the AI's output, in everyday language ──
('aid-response', 'response', null, 'ai-foundations', 'ai', 1,
 'What the AI sends back when you ask it something — the answer, output, or reply.',
 'A response is what comes out of the AI side of the chat: the paragraph, list, code snippet, or apology you get after sending a prompt. Same idea as a reply in any back-and-forth conversation, but with one quirk: AI responses are written one word at a time, so longer responses take longer to finish coming back. If a response cuts off mid-sentence, the model usually hit a length cap.',
 'The response was thorough but it took 30 seconds to finish typing.',
 'Every conversation with AI is a back-and-forth of prompts and responses. Once you have the everyday word for both halves, the rest of the AI vocabulary clicks into place faster.',
 ARRAY['aid-prompt','aid-generation','aid-token']::text[],
 ARRAY['aid-ai']::text[],
 null,
 ARRAY[
   'The internal step where the AI picks which sources to use',
   'The user''s rating of how good an answer was',
   'The error message shown when an AI cannot answer'
 ]::text[],
 'The ___ was thorough but it took 30 seconds to finish typing.',
 'Use ''response'' in a sentence about what the AI sent back.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
