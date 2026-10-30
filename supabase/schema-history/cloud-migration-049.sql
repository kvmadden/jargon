-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-tools +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-tools` path. The path already covers
--   the category words (assistant, chatbot, copilot, agent, llm, multimodal,
--   vision-model, voice-mode, deep-research). It is missing two of the
--   most-recognized PRODUCT NAMES a non-engineer hears every week — Claude
--   and ChatGPT — and two CAPABILITY words for what those products can
--   actually do during a chat: web search and file upload.
--     - claude (d1): the Anthropic AI assistant; named so the learner can
--       talk about "the one Anthropic makes" without confusion
--     - chatgpt (d1): the OpenAI AI assistant; the most-recognized AI
--       product name in the world; the one most people mean when they
--       say "I asked the AI"
--     - web search (d2): the AI capability that goes out to the live web
--       during a chat; explains why answers can be current, and what the
--       "with browsing" / "search the web" toggle does
--     - file upload (d2): adding a document to a chat as context; explains
--       why the AI can suddenly answer questions about a PDF, spreadsheet,
--       or image you just dragged in
--
-- Depends on: cloud-migration-027 (ai-tools in path CHECK constraint),
--             prior ai-tools migrations (these new rows reference
--             aid-assistant, aid-chatbot, aid-llm, aid-context-window,
--             aid-token, aid-grounding, aid-tool-call as related/prereq).
--
-- DIFFICULTY MIX:
--   Two d1 (claude, chatgpt) — proper-noun product names; if a learner
--   knows the word "AI assistant" they can attach a brand to it in one step
--   Two d2 (web search, file upload) — capability words that need one
--   level of frame ("the AI can do X during the conversation, not just
--   from training")
--
-- VERIFIABILITY DISCIPLINE:
--   Product claims about Claude and ChatGPT are kept to widely-true facts:
--   the maker, the conversational format, the tier structure (free + paid),
--   the position in the market. NO specific feature claims that change
--   month-to-month (no "uses Bing for search," no "supports up to N
--   attachments," no "GPT-5 powers it" — those drift). For web search and
--   file upload, the canonical text describes the GENERAL capability
--   "many AI assistants can do this" — not "Claude does it this way."
--   The personalize-term layer is where lived-domain analogies live; this
--   canonical content stays neutral and accurate.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── Claude (d1) ────────────────────────────────────────
('aid-claude', 'Claude', null, 'ai-tools', 'ai', 1,
 'The AI assistant made by Anthropic — a chat product millions of people use to ask questions, write, and think through problems.',
 'Claude is Anthropic''s AI assistant. Anthropic is the company; Claude is the product the company sells. You talk to Claude in plain language, the same way you would talk to ChatGPT or any other modern AI chat product. There is a free tier and a paid tier, and there are different model sizes available depending on how heavy the task is. Anthropic has positioned Claude around safety and careful reasoning, and the product is widely used in writing, research, and software work.',
 'I switched from ChatGPT to Claude for long-form writing because I liked the tone better.',
 'When someone says "ask Claude" or "the new Claude is out," they are talking about a specific product, not AI in general. Knowing the name lets you read tech news and product comparisons without guessing — and knowing the company is Anthropic, not Claude, keeps you from getting tripped up when both names show up in the same sentence.',
 ARRAY['aid-assistant','aid-chatgpt','aid-chatbot','aid-llm']::text[],
 ARRAY['aid-assistant']::text[],
 null,
 ARRAY[
   'The open-source AI model used to power most chatbots on the web',
   'The internal name for the team of researchers who built ChatGPT',
   'A protocol that lets different AI systems talk to each other'
 ]::text[],
 'I switched from ChatGPT to ___ for long-form writing because I liked the tone better.',
 'Use ''Claude'' in a sentence about the AI assistant made by Anthropic.',
 'curated', 'curator', '2026-05-06'),

-- ─── ChatGPT (d1) ────────────────────────────────────────
('aid-chatgpt', 'ChatGPT', null, 'ai-tools', 'ai', 1,
 'The AI assistant made by OpenAI — the product that put modern AI in front of mainstream users in late 2022.',
 'ChatGPT is OpenAI''s AI assistant. OpenAI is the company; ChatGPT is the product. It launched in November 2022 and became the fastest-growing consumer product in history, which is most of why "I asked the AI" entered everyday speech. Like other modern assistants, ChatGPT runs on top of large language models, has a free tier and paid tiers, and is used for everything from writing to coding to homework help. When most non-technical people say "AI" today, they often mean ChatGPT specifically.',
 'My mom started using ChatGPT to draft thank-you notes and now she will not stop talking about it.',
 'ChatGPT is the AI product non-technical people are most likely to have used. Knowing it is a specific product from a specific company (OpenAI) — not the name for AI itself — makes a lot of dinner-table and news-headline conversations make sense. It also lets you talk about other assistants like Claude or Gemini without the conversation flattening into "the AI."',
 ARRAY['aid-assistant','aid-claude','aid-chatbot','aid-llm']::text[],
 ARRAY['aid-assistant']::text[],
 null,
 ARRAY[
   'A general term for any AI that you talk to through a chat interface',
   'The chat feature built into Microsoft Office that summarizes documents',
   'An open-source AI project that anyone can download and run locally'
 ]::text[],
 'My mom started using ___ to draft thank-you notes and now she will not stop talking about it.',
 'Use ''ChatGPT'' in a sentence about the AI assistant made by OpenAI.',
 'curated', 'curator', '2026-05-06'),

-- ─── web search (d2) ────────────────────────────────────────
('aid-web-search', 'web search', null, 'ai-tools', 'ai', 2,
 'When an AI assistant goes out to the live web during your chat to look something up, instead of relying only on what it learned during training.',
 'By default, an AI assistant only knows what it saw during training, which means it has a cutoff date and cannot answer questions about anything newer. Web search is the capability that lets the assistant break out of that — it runs a real search query, reads a few of the top results, and uses what it finds to answer your question. Many modern assistants can do this on request, and some do it automatically when the question looks time-sensitive. The trade-off: web search is slower than a normal answer, and the quality of the response depends on whether the assistant grabbed good sources.',
 'I asked about today''s weather and the assistant kicked off a web search instead of guessing from old data.',
 'Web search is the difference between an AI that confidently makes up last week''s news and one that goes and checks. Knowing the word lets you tell what the assistant is actually doing when you see "searching the web..." flash across the screen — and lets you ask for it on purpose when freshness matters.',
 ARRAY['aid-tool-call','aid-grounding','aid-assistant','aid-deep-research']::text[],
 ARRAY['aid-assistant']::text[],
 null,
 ARRAY[
   'The way an AI is trained on a snapshot of the entire web before launch',
   'A premium feature that lets the assistant index your private files',
   'The internal database where an AI stores its memory of past conversations'
 ]::text[],
 'I asked about today''s weather and the assistant kicked off a ___ instead of guessing from old data.',
 'Use ''web search'' in a sentence about an AI looking something up live during a chat.',
 'curated', 'curator', '2026-05-06'),

-- ─── file upload (d2) ────────────────────────────────────────
('aid-file-upload', 'file upload', null, 'ai-tools', 'ai', 2,
 'Dropping a document, image, or spreadsheet into a chat so the AI can read it and answer questions about it.',
 'Most modern AI assistants let you attach a file to a message — a PDF, a spreadsheet, an image, sometimes a whole folder''s worth. The assistant reads the file as part of the conversation and can answer questions about it, summarize it, pull data out of it, or compare it to something else. The file does not become part of the AI''s long-term knowledge; it just sits in the current chat as context, the same way the rest of the conversation does. Different products support different file types and different size limits, but the basic move is the same everywhere: drag in the document, then ask questions about it.',
 'I uploaded the meeting notes and asked the assistant to pull out every action item.',
 'File upload is what turns an AI assistant from "answers from memory" into "answers about your specific stuff." Knowing the term — and knowing the file is just context for this chat, not new training — makes it easier to use the feature on purpose, and to understand what the AI does and does not retain after the conversation ends.',
 ARRAY['aid-context-window','aid-token','aid-multimodal','aid-assistant']::text[],
 ARRAY['aid-assistant','aid-context-window']::text[],
 null,
 ARRAY[
   'The process of saving a chat transcript to your computer as a file',
   'A premium feature that trains a custom model on your personal documents',
   'The handoff step where one AI assistant passes work to another'
 ]::text[],
 'I ___ the meeting notes and asked the assistant to pull out every action item.',
 'Use ''file upload'' in a sentence about adding a document to a chat for the AI to read.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
