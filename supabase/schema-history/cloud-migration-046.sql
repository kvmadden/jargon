-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-products +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-products` path. Brings ai-products
--   from 4 → 8 terms. Closes the most-load-bearing gap in the path:
--   a learner currently has embedding, fine-tuning, rag, tool-call.
--   They lack the words for HOW retrieval-augmented systems are actually
--   built — where embeddings live (vector database), what kind of search
--   they enable (semantic search), what the AI is grounded against
--   (knowledge base), and the act itself (retrieval).
--
-- Depends on: cloud-migration-027 (AI domain paths in CHECK constraint),
--             cloud-migration-038 (existing ai-products terms;
--             these new rows reference aid-rag, aid-embedding,
--             aid-grounding as related terms / prereqs)
--
-- WHY THIS BATCH:
--   "RAG" is now the dominant pattern for AI-in-products: enterprise
--   search, customer support bots, internal knowledge tools, and most
--   "talk to your docs" features all use it. Without these four words,
--   product pages and architecture diagrams in 2026 read as alphabet soup:
--     - vector database: where the embeddings live (Pinecone, Weaviate, pgvector)
--     - semantic search: search by meaning, the user-facing payoff of embeddings
--     - knowledge base: the source-of-truth corpus the AI quotes from
--     - retrieval: the act itself — fetching the right context before generating
--   Difficulty mix: 2×d2 (the technical-but-direct ones) + 2×d3 (the abstract
--   meta-words) gives a balanced ladder.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── vector database (d2) ────────────────────────────────────────
('aid-vector-database', 'vector database', null, 'ai-products', 'ai', 2,
 'A special kind of storage built to hold embeddings and find the closest matches fast.',
 'A vector database stores embeddings — the long lists of numbers that represent the meaning of text — and answers one question very quickly: "what items in here are most similar to this one?" Regular databases are great at exact matches ("find the row where the name equals Smith"); vector databases are great at fuzzy meaning matches ("find the notes that talk about something like this"). They are the storage layer underneath almost every modern search and retrieval feature. Common ones include Pinecone, Weaviate, and the pgvector extension for Postgres.',
 'We loaded all of last year''s notes into a vector database so the assistant can pull up the relevant ones during a conversation.',
 'Whenever a product page says "your data, searchable by AI" or "talk to your documents," there is almost always a vector database doing the heavy lifting. Knowing the term lets you read past the marketing layer into how the system actually finds things.',
 ARRAY['aid-embedding','aid-rag','aid-semantic-search','aid-retrieval']::text[],
 ARRAY['aid-embedding']::text[],
 null,
 ARRAY[
   'A backup copy of a regular database stored as a single large file',
   'A spreadsheet that tracks vectors and arrows in geometry problems',
   'The internal table where a model stores its weights between sessions'
 ]::text[],
 'We loaded all of last year''s notes into a ___ so the assistant can pull up the relevant ones during a conversation.',
 'Use ''vector database'' in a sentence about where embeddings get stored.',
 'curated', 'curator', '2026-05-06'),

-- ─── semantic search (d2) ────────────────────────────────────────
('aid-semantic-search', 'semantic search', null, 'ai-products', 'ai', 2,
 'Search that matches by meaning instead of by exact words.',
 'Old-school search looks for the literal keywords you typed — if you ask for "headache" and the document says "migraine," you get nothing. Semantic search compares the meaning of your question against the meaning of each document, so "headache" and "migraine" land near each other. Underneath, it works by turning your question and every document into embeddings and finding the closest ones. The user-facing payoff: you can ask in your own words and still get the right answer, even when the source uses different language.',
 'After we switched to semantic search, people stopped having to guess the exact phrase the manual used.',
 'Most of the search-quality jumps you have noticed in the last few years (smarter site search, "related articles" that actually relate, better customer-support bots) are semantic search showing up. Knowing the word makes product reviews and procurement decks much easier to read.',
 ARRAY['aid-embedding','aid-vector-database','aid-retrieval','aid-rag']::text[],
 ARRAY['aid-embedding']::text[],
 null,
 ARRAY[
   'A search feature that auto-corrects typos and suggests completions as you type',
   'A privacy-preserving mode that searches only inside your own files',
   'A premium tier of search that returns a single AI-written answer instead of links'
 ]::text[],
 'After we switched to ___, people stopped having to guess the exact phrase the manual used.',
 'Use ''semantic search'' in a sentence about finding things by meaning.',
 'curated', 'curator', '2026-05-06'),

-- ─── knowledge base (d3) ────────────────────────────────────────
('aid-knowledge-base', 'knowledge base', null, 'ai-products', 'ai', 3,
 'The collection of trusted documents an AI is told to ground its answers in.',
 'A knowledge base is whatever pile of source material the AI is supposed to lean on instead of making things up — internal manuals, past tickets, policy documents, training materials, product specs. The AI does not know these by default; you connect them, they get indexed, and then every question gets answered with that pile as the source-of-truth. The same model talking to two different knowledge bases will sound like two different experts. Keeping the knowledge base accurate and up to date is most of the ongoing work of running an AI product.',
 'We pointed the assistant at our knowledge base of policy documents so it stops guessing and starts quoting.',
 'When you read "your AI, trained on your data" on a product page, "trained on" is almost always a marketing softening of "connected to your knowledge base." The model itself did not learn anything — it is just being told where to look. Knowing the difference matters when you are evaluating tools or budgeting for them.',
 ARRAY['aid-rag','aid-grounding','aid-retrieval','aid-vector-database']::text[],
 ARRAY['aid-rag']::text[],
 null,
 ARRAY[
   'The internal memory the AI keeps about a single ongoing conversation',
   'The list of facts the model memorized during pretraining',
   'A glossary of technical terms the AI uses to translate jargon for users'
 ]::text[],
 'We pointed the assistant at our ___ of policy documents so it stops guessing and starts quoting.',
 'Use ''knowledge base'' in a sentence about the documents an AI is supposed to rely on.',
 'curated', 'curator', '2026-05-06'),

-- ─── retrieval (d3) ────────────────────────────────────────
('aid-retrieval', 'retrieval', null, 'ai-products', 'ai', 3,
 'The step where the system pulls the right pieces of source material before the AI starts answering.',
 'Retrieval is the "go grab the relevant pages" step. When you ask a question, the system first searches the knowledge base for the few chunks most likely to help, then hands those chunks to the model along with your question. The model writes its answer with that material in front of it. Retrieval is the R in RAG, and how good it is mostly decides how good the final answer is — feed the model bad context and you get a confident wrong answer; feed it the right context and you get a real one.',
 'If retrieval pulls the wrong section, the model will answer your question against the wrong policy and sound confident doing it.',
 'Most "the AI gave a wrong answer" failures are actually retrieval failures — the model never had the right material in front of it. Knowing the word lets you ask the precise question when something goes wrong: "is the model bad, or is retrieval bad?"',
 ARRAY['aid-rag','aid-knowledge-base','aid-semantic-search','aid-grounding']::text[],
 ARRAY['aid-rag']::text[],
 null,
 ARRAY[
   'The act of downloading a model''s weights from a provider',
   'The way a model recalls something from earlier in the same conversation',
   'A specialized fine-tuning step that teaches a model to cite sources'
 ]::text[],
 'If ___ pulls the wrong section, the model will answer your question against the wrong policy and sound confident doing it.',
 'Use ''retrieval'' in a sentence about pulling relevant context before generating an answer.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
