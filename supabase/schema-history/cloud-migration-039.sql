-- jargon Stage B+1.16 — AI domain seed (10 anchor terms)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 10 hand-curated anchor terms to the `ai` domain. Closes the
--   "registered but content-empty" gap from cloud-migration-027 (which
--   only extended the path CHECK constraint).
--
-- Depends on: cloud-migration-027 (AI paths in CHECK constraint),
--             cloud-migration-018 (terms.domain column with default 'coding')
--
-- WHY THIS EXISTS:
--   Multi-domain infrastructure has been in place since B+1.5/.8/.9 —
--   Domain registry, prompt templating, Deno-side mirrors, the picker
--   UI, even the AI domain registration. The one missing piece was
--   actual AI content. Without seed terms, a user with active_domain
--   = 'ai' lands on an empty path map. This migration fixes that.
--
--   The 10 anchor terms cover the core vocabulary a non-engineer needs
--   to follow modern AI conversations:
--     - 5 of the 6 paths represented (ai-foundations, ai-tools,
--       ai-prompting, ai-products, ai-evaluation). ai-policy deferred
--       to a later seed once the foundational vocab is in place.
--     - difficulties span d1 (foundational, no prereqs) → d3 (concepts
--       that build on multiple prereqs).
--     - prereq chains are explicit + minimal. e.g. `RAG` requires
--       `embedding` + `prompt`. `agent` requires `model` + `prompt`.
--       The lesson engine + topological sort (B+1.16) will respect
--       these dependencies automatically.
--
-- VOCABULARY DISCIPLINE (B+1.16):
--   Each term's body fields (long_definition, why_it_matters,
--   example_in_sentence) only reference: plain English, the term
--   being defined, or another term IN THE PREREQS list. Names like
--   "Claude" / "GPT-5" / "Gemini" appear as PRODUCT names, not as
--   in-domain teaching terms — these are concrete-noun signposts that
--   any AI user recognizes. The vocabulary-discipline audit script
--   should not flag these (they aren't in the corpus as terms).
--
-- IDEMPOTENT: ON CONFLICT DO NOTHING means re-running this migration
--   skips already-inserted ai-* rows. Safe to apply repeatedly.
--   (Used DO NOTHING rather than DO UPDATE because the owner may iterate
--   the seed copy via the dashboard — overwriting his edits would be
--   destructive.)

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── ai-foundations (3) ────────────────────────────────────────
('aid-model', 'model', null, 'ai-foundations', 'ai', 1,
 'The AI itself — a system trained on huge amounts of text that can answer questions and follow instructions.',
 'When people say "the AI," they usually mean a model — like GPT-5, Claude, or Gemini. Each model was trained on a particular set of text, so they have slightly different strengths, voice, and limits. Bigger or newer models usually answer better, but not always.',
 'I tried Claude''s biggest model on this and it caught the bug in one pass.',
 'Once you know that "model" means "one specific AI," a lot of news headlines start making sense — "OpenAI released a new model" is just "OpenAI shipped a new AI." It''s the unit of comparison when people compare AIs.',
 ARRAY['aid-llm','aid-prompt']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A small program that runs on your phone',
   'A 3D rendering of a real-world object',
   'A sample dataset used for testing'
 ]::text[],
 'I tried Claude''s biggest ___ on this and it caught the bug in one pass.',
 'Use ''model'' in a sentence about picking which AI to use for a task.',
 'curated', 'curator', '2026-05-06'),

('aid-token', 'token', null, 'ai-foundations', 'ai', 1,
 'The unit an AI processes — usually a chunk of word, like "play" + "ing".',
 'AI systems do not read text the way people do. They chunk it into tokens — sometimes whole words, sometimes word-pieces, sometimes single characters. This is why AI charges "per token" and why long inputs cost more. Roughly: 1 token is about 4 English characters.',
 'Pasting that whole transcript ate 12,000 tokens.',
 'When you see "context window: 200K tokens" in a model spec, you can do the rough math: that is about 150,000 English words. Tokens are the unit of billing AND the unit of memory.',
 ARRAY['aid-context-window']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A unique identifier used to log into an account',
   'A type of cryptocurrency',
   'A small piece of metadata attached to a file'
 ]::text[],
 'Pasting that whole transcript ate 12,000 ___s.',
 'Use ''token'' in a sentence about how much input you sent to an AI.',
 'curated', 'curator', '2026-05-06'),

('aid-context-window', 'context window', null, 'ai-foundations', 'ai', 2,
 'The most a model can read at once — measured in tokens.',
 'Every model has a context window — the maximum amount of text (in tokens) it can hold in its head at one time. Smaller models might handle 8,000 tokens; the biggest can handle a million or more. Anything beyond the window gets cut off or summarized.',
 'This whole codebase does not fit in the context window — the model only sees the first half.',
 'When you paste a long document and the AI seems to forget the beginning, the context window is usually the reason. Knowing the limit lets you trim, summarize, or pick a bigger model when you really need everything in scope.',
 ARRAY['aid-token','aid-model']::text[],
 ARRAY['aid-token']::text[],
 null,
 ARRAY[
   'The screen size of the user''s device',
   'A pop-up window for chat conversations',
   'The time limit for an AI response'
 ]::text[],
 'This whole codebase does not fit in the ___ — the model only sees the first half.',
 'Use ''context window'' in a sentence about feeding a long document to an AI.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-tools (2) ──────────────────────────────────────────────
('aid-llm', 'LLM', 'L-L-M (or large language model)', 'ai-tools', 'ai', 2,
 'Large language model — the kind of AI that produces text by predicting one token at a time.',
 'An LLM is a model trained on a massive amount of text to predict what word (token) comes next. Claude, GPT-5, and Gemini are all LLMs. The "language" part is what they generate; the "large" part is the size of the training data and the model itself.',
 'All the chat AIs are LLMs under the hood — they just have different wrappers.',
 'When someone says "LLM," they are naming the underlying technology rather than a specific product. It separates the model class (LLMs) from non-AI software, image models, audio models, etc. Useful when reading product launches or research.',
 ARRAY['aid-model','aid-token']::text[],
 ARRAY['aid-model','aid-token']::text[],
 null,
 ARRAY[
   'A small AI model that runs locally on a laptop',
   'A method for compressing language data',
   'A user interface library for chat apps'
 ]::text[],
 'All the chat AIs are ___s under the hood — they just have different wrappers.',
 'Use ''LLM'' in a sentence about how chat AIs work under the hood.',
 'curated', 'curator', '2026-05-06'),

('aid-agent', 'agent', null, 'ai-tools', 'ai', 3,
 'An AI that takes actions in the world — not just answers questions, but uses tools, opens files, sends emails.',
 'An agent is an AI loop: read a goal, plan a step, take an action (read a file, call a service, run a command), observe the result, and try again. Agents are how AI moves from chat to actual work — Claude Code is an agent that writes and runs your code, not just talks about it.',
 'I gave the agent a vague bug report and it traced through the codebase, found the cause, and submitted a fix.',
 'When people say "AI is becoming an agent" they mean the model is not just a chatbot anymore — it is reading, doing, deciding. This is the line between "helpful assistant" and "collaborator that gets things done."',
 ARRAY['aid-model','aid-prompt']::text[],
 ARRAY['aid-model','aid-prompt']::text[],
 null,
 ARRAY[
   'A salesperson hired to promote AI products',
   'A small program that runs in the background',
   'A user account with elevated permissions'
 ]::text[],
 'I gave the ___ a vague bug report and it traced through the codebase, found the cause, and submitted a fix.',
 'Use ''agent'' in a sentence about an AI that does the work, not just describes it.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-prompting (2) ──────────────────────────────────────────
('aid-prompt', 'prompt', null, 'ai-prompting', 'ai', 1,
 'The text you send to an AI to ask for what you want.',
 'A prompt is everything you type when you talk to an AI — the question, the instructions, any examples or context. The same AI gives you very different answers depending on how you phrase your prompt. Writing better prompts gets you better answers without changing the AI underneath.',
 'My first prompt was too vague — adding "in three sentences" fixed the output.',
 'Knowing the word "prompt" separates you from people who type random questions and get random answers. Treating the prompt as a craftable object — not just a chat message — is the first step to getting useful results.',
 ARRAY['aid-system-prompt']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A pop-up notification asking the user to take action',
   'An automatic suggestion shown while typing',
   'A welcome message shown to new users'
 ]::text[],
 'My first ___ was too vague — adding "in three sentences" fixed the output.',
 'Use ''prompt'' in a sentence about getting a better answer from an AI.',
 'curated', 'curator', '2026-05-06'),

('aid-system-prompt', 'system prompt', null, 'ai-prompting', 'ai', 2,
 'Hidden instructions the AI reads before you say anything — sets its role, tone, and rules.',
 'Most AI products have a system prompt that runs before your message — it tells the AI who it is pretending to be ("you are a helpful assistant"), what topics to avoid, what format to use, and so on. You usually cannot see it, but it shapes every reply. Power users build apps by writing their own system prompts.',
 'The system prompt told it to always cite sources, so it never makes up references.',
 'When AI apps feel different — Claude vs ChatGPT vs a custom assistant — much of that difference is the system prompt, not the underlying model. Knowing this is what lets you reason about why your AI behaves the way it does.',
 ARRAY['aid-prompt']::text[],
 ARRAY['aid-prompt']::text[],
 null,
 ARRAY[
   'The error message shown when an AI fails',
   'An automatically generated summary of past conversations',
   'A keyboard shortcut to interrupt the AI'
 ]::text[],
 'The ___ told it to always cite sources, so it never makes up references.',
 'Use ''system prompt'' in a sentence about why two AI apps behave differently.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-products (2) ───────────────────────────────────────────
('aid-embedding', 'embedding', null, 'ai-products', 'ai', 2,
 'A list of numbers that captures the meaning of a word or sentence — so AIs can compare meanings.',
 'An embedding turns a piece of text into a long list of numbers. Texts with similar meanings get similar lists, even if they do not share any words ("cat" and "kitten" end up close; "cat" and "spreadsheet" end up far apart). This is what powers semantic search, recommendations, and the retrieval part of RAG.',
 'We embed every help article, then look up the closest one to whatever the user types.',
 'When you hear "vector database" or "semantic search," an embedding is the underlying object. It is how AI compares meaning instead of just keywords — letting search find "how do I cancel my plan?" when the article is titled "subscription termination."',
 ARRAY['aid-model','aid-rag']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A way of compressing images for storage',
   'A snippet of HTML embedded in a page',
   'A widget you can drop into a website'
 ]::text[],
 'We ___ every help article, then look up the closest one to whatever the user types.',
 'Use ''embedding'' in a sentence about searching by meaning.',
 'curated', 'curator', '2026-05-06'),

('aid-rag', 'RAG', 'rag (or retrieval-augmented generation)', 'ai-products', 'ai', 3,
 'Retrieval-augmented generation — looking up real source material first, then handing it to the AI to answer from.',
 'RAG mixes search with AI. Before the AI answers, the system retrieves relevant documents (usually via embeddings) and stuffs them into the prompt. The AI then answers using the supplied sources rather than from its training data alone — fewer hallucinations, more recent info.',
 'The customer support bot uses RAG so it cites the actual help center articles, not what the model thinks they say.',
 'Most useful AI products today are RAG under the hood — a model alone does not know your data, your docs, or what shipped yesterday. RAG is how AI gets up-to-date without retraining the whole model.',
 ARRAY['aid-embedding','aid-hallucination']::text[],
 ARRAY['aid-embedding','aid-prompt']::text[],
 null,
 ARRAY[
   'A type of text formatting like markdown',
   'A method for cleaning up training data',
   'A standardized AI benchmark'
 ]::text[],
 'The customer support bot uses ___ so it cites the actual help center articles.',
 'Use ''RAG'' in a sentence about an AI that answers from your company''s docs.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-evaluation (1) ─────────────────────────────────────────
('aid-hallucination', 'hallucination', null, 'ai-evaluation', 'ai', 2,
 'When an AI confidently makes something up that is not true.',
 'AI models generate text that sounds confident even when they do not actually know the answer. Made-up facts, fake citations, invented services — these are hallucinations. They happen because the model is trained to produce plausible-sounding text, not to verify what it says.',
 'Watch out — that quote is a hallucination, the article never existed.',
 'Every AI user gets burned by hallucinations eventually. Knowing the term gives you the right warning to verify anything that matters — citations, code that references libraries, names, dates, numbers.',
 ARRAY['aid-model']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'When an AI refuses to answer a sensitive question',
   'When an AI takes too long to respond',
   'When an AI repeats the same answer twice'
 ]::text[],
 'Watch out — that quote is a ___, the article never existed.',
 'Use ''hallucination'' in a sentence about not trusting an AI''s citation.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
