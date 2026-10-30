-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-products +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-products` path. The path already has
--   the retrieval cluster (embedding, fine-tuning, knowledge-base, rag,
--   retrieval, semantic-search, tool-call, vector-database). This batch
--   adds the four most load-bearing words a non-engineer hits when
--   using AI products in 2026:
--     - streaming: the visual word-by-word reveal users SEE in chat
--       interfaces. The most-asked "why does it type out like that"
--       question, named.
--     - guardrails: the safety-boundaries word that shows up in every
--       enterprise AI rollout conversation. Pairs with refusal + safety.
--     - MCP: Model Context Protocol — the open standard for connecting
--       AI assistants to external tools and data sources. Anthropic
--       opened it in 2024; it''s now the dominant word in the "how does
--       Claude talk to my database" conversation.
--     - agent loop: the iterative think → act → observe → repeat
--       pattern that is what actually makes "agents" different from
--       one-shot AI assistants. Pairs with aid-agent.
--
-- Depends on: cloud-migration-027 (ai-products in path CHECK constraint),
--             earlier ai-products migrations (these new rows reference
--             aid-tool-call as a related term),
--             cloud-migration-038 (aid-refusal, aid-safety as related
--             for guardrails),
--             aid-agent (related for agent-loop, mcp).
--
-- DIFFICULTY MIX:
--   Two d2 (streaming, guardrails) — direct, observable from a single
--   chat session. A learner who has used any AI chat product has seen
--   streaming live; a learner who has hit a refusal has bumped into
--   guardrails.
--   Two d3 (MCP, agent loop) — concepts that sit one level up. MCP
--   requires understanding that AI tools talk to external systems
--   through a protocol, not a magic wire. Agent loop requires the prior
--   idea that a single AI response is "one shot" — only then does the
--   loop pattern read as different.
--
-- ACRONYM HANDLING:
--   - MCP is the term itself, so the inline expansion is part of the
--     definition: "Model Context Protocol — an open standard for...".
--     The id is `aid-mcp` (lowercase) but the display term is `MCP`
--     (capitalized as the acronym proper noun).
--   - No other unexplained acronyms in this batch. "API" appears once
--     in the agent-loop entry and gets a one-clause inline gloss
--     ("calling an API — a programmatic interface to another service").
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── streaming (d2) ────────────────────────────────────────
('aid-streaming', 'streaming', null, 'ai-products', 'ai', 2,
 'When the AI''s answer appears word-by-word as it''s being generated, instead of all at once when it''s done.',
 'Streaming is the typewriter-style reveal you see in most AI chat products: the answer shows up a few words at a time, growing on screen while the model is still working on the rest. The alternative is all-at-once — you wait, sometimes for many seconds, and then the whole answer drops in. Streaming feels faster (you start reading sooner), keeps long answers from feeling like a frozen screen, and lets you stop the model early if it''s going the wrong way. Most chat products stream by default; longer-running tasks like deep research or image generation often don''t.',
 'The new chat product streams responses word-by-word, so you start reading the answer almost immediately instead of staring at a loading spinner.',
 'Streaming is one of those design choices that shapes how AI feels to use. Knowing the word lets you ask the right question when something feels slow ("is this streaming or batched?") and lets you tell the difference between the model being slow and the interface being slow.',
 ARRAY['aid-generation','aid-response','aid-token','aid-chatbot']::text[],
 ARRAY['aid-generation']::text[],
 null,
 ARRAY[
   'When an AI plays back audio or video continuously instead of as a download',
   'A pricing model where you pay per minute of AI usage instead of per query',
   'The mode where an AI keeps a long conversation alive across many sessions'
 ]::text[],
 'The new chat product ___ responses word-by-word, so you start reading the answer almost immediately instead of staring at a loading spinner.',
 'Use ''streaming'' in a sentence about an AI''s answer appearing word-by-word.',
 'curated', 'curator', '2026-05-06'),

-- ─── guardrails (d2) ────────────────────────────────────────
('aid-guardrails', 'guardrails', null, 'ai-products', 'ai', 2,
 'The safety boundaries built into an AI product to keep it from producing harmful, off-topic, or unwanted output.',
 'Guardrails are the rules and filters that sit around an AI to keep it on the road. Some are baked in during training (the model learns to refuse certain requests); some are layered on at runtime (a separate check that scans the output before it reaches the user); some are structural (the model is only allowed to answer in a specific format, or only about a specific topic). A customer-support bot with guardrails won''t answer questions about competitors. A coding assistant with guardrails won''t write malware. The word covers all of it — the trained refusals, the content filters, the format constraints — anything that says "the AI should not go there."',
 'Before launching the customer-facing assistant, the team added guardrails so it would only answer questions about their own product.',
 'Whenever a company announces an AI product, "with guardrails" is a load-bearing claim — it''s telling you they put rails on what the model can say. Knowing the word lets you ask the right follow-up: what kind of guardrails, tested how, and what slips through?',
 ARRAY['aid-refusal','aid-safety','aid-system-prompt','aid-prompt-injection']::text[],
 ARRAY['aid-refusal']::text[],
 null,
 ARRAY[
   'The default settings a user sees the first time they open an AI product',
   'A type of warning shown when the AI is unsure about its answer',
   'The hardware-level limits on how much memory an AI is allowed to use'
 ]::text[],
 'Before launching the customer-facing assistant, the team added ___ so it would only answer questions about their own product.',
 'Use ''guardrails'' in a sentence about the safety boundaries built into an AI product.',
 'curated', 'curator', '2026-05-06'),

-- ─── MCP (d3) ────────────────────────────────────────
('aid-mcp', 'MCP', null, 'ai-products', 'ai', 3,
 'Model Context Protocol — an open standard for connecting AI assistants to external tools, data sources, and apps in a consistent way.',
 'MCP stands for Model Context Protocol. It''s a shared standard, opened by Anthropic in 2024, that defines how an AI assistant talks to the outside world — your files, your databases, your apps, your work tools. Before MCP, every AI product had its own bespoke way of plugging into external systems, and every integration was custom work. With MCP, anyone can build an "MCP server" for a tool or data source once, and any AI assistant that speaks MCP can use it. Think of it as the common adapter between AI assistants on one side and the long tail of tools and data on the other.',
 'The team built an MCP server for their internal docs so the AI assistant could pull answers straight from the source instead of guessing.',
 'MCP is becoming the connective tissue for AI products at work. Knowing the word lets you read product announcements ("now with MCP support") without bouncing — and lets you understand why the same AI assistant can suddenly read your calendar, query your database, and edit your files without each one being a custom build.',
 ARRAY['aid-tool-call','aid-agent','aid-context-window','aid-assistant']::text[],
 ARRAY['aid-tool-call']::text[],
 null,
 ARRAY[
   'A type of AI model designed to run on phones and other small devices',
   'The technique of compressing prompts before sending them to a model',
   'A subscription tier that gives you priority access to the newest models'
 ]::text[],
 'The team built an ___ server for their internal docs so the AI assistant could pull answers straight from the source instead of guessing.',
 'Use ''MCP'' in a sentence about connecting an AI assistant to external tools or data.',
 'curated', 'curator', '2026-05-06'),

-- ─── agent loop (d3) ────────────────────────────────────────
('aid-agent-loop', 'agent loop', null, 'ai-products', 'ai', 3,
 'The repeating pattern an AI agent runs through: take an action, see the result, decide the next action, repeat — until the task is done.',
 'An agent loop is the cycle that turns a one-shot AI into something that can actually finish a multi-step task. Step one, the AI decides what to do next. Step two, it does it — runs a search, edits a file, calls an API (a programmatic interface to another service). Step three, it reads the result. Step four, it picks the next move based on what just happened. Then it loops. The loop keeps running until the task is done or the AI decides it''s stuck. This is what makes "agents" different from a normal chat — a normal chat answers one prompt and stops; an agent keeps going on its own, reacting to what it finds along the way.',
 'The agent loop ran for about twelve steps before the AI hit the right answer — searching, reading the result, refining the query, and trying again.',
 'When a product says "agentic" or "autonomous AI," the agent loop is what they mean. Knowing the word lets you tell the difference between an AI that answers once and an AI that keeps working on its own — and lets you ask the right question, which is always "what does it do when it gets stuck?"',
 ARRAY['aid-agent','aid-tool-call','aid-reasoning','aid-mcp']::text[],
 ARRAY['aid-agent']::text[],
 null,
 ARRAY[
   'A bug where an AI keeps repeating the same answer no matter what you ask',
   'The animation that plays while an AI is loading its next response',
   'A subscription model where users pay per agent created instead of per query'
 ]::text[],
 'The ___ ran for about twelve steps before the AI hit the right answer — searching, reading the result, refining the query, and trying again.',
 'Use ''agent loop'' in a sentence about the repeating pattern of action, observation, and next action that an AI agent runs through.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
