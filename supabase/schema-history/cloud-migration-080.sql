-- jargon Stage B+1.40 - AI agent foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 6 exact atlas IDs that round out the AI/agent concept lane:
-- RAG, embeddings, tool calls, vector stores, evals, and guardrails.
--
-- Scope:
--   - terms rows only
--   - coding domain only
--   - no profile/rendering cache rewrites
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

('ai-rag', 'RAG', 'rag', 'ai-engineering', 'coding', 1,
 'A pattern that retrieves outside knowledge and gives it to the model before it answers.',
 'RAG stands for Retrieval-Augmented Generation. A RAG system searches trusted documents, pulls the most relevant chunks into context, and asks the model to answer from that retrieved material. It is useful when the answer depends on private, current, or source-specific knowledge the model should not invent from memory.',
 'The support assistant used RAG so it could answer from the latest help-center article.',
 'RAG is the standard pattern behind many useful AI apps. It helps you distinguish giving a model fresh evidence at answer time from training or fine-tuning the model.',
 ARRAY['ai-embedding','ai-vector-store','ai-grounding','aid-rag']::text[],
 ARRAY['ai-llm','ai-embedding']::text[],
 'ai-grounding',
 ARRAY[
   'Training a model to change its weights',
   'Forcing model output into valid JSON',
   'Blocking unsafe model behavior with policy checks'
 ]::text[],
 'The support assistant used ___ so it could answer from the latest help-center article.',
 'Use ''RAG'' in a sentence about retrieving trusted documents before an AI answers.',
 'curated', 'curator', '2026-05-26'),

('ai-embedding', 'embedding', null, 'ai-engineering', 'coding', 1,
 'A numeric representation of meaning that lets software compare text by similarity.',
 'An embedding turns text, images, or other content into a list of numbers that captures useful meaning. Similar ideas land near each other in that numeric space, so software can search for "close enough" matches even when the exact words differ. Embeddings are the raw material for vector stores and many RAG systems.',
 'The system made an embedding for each document chunk before saving it for search.',
 'Embedding is the bridge between language and math. It helps you understand how search can find related ideas instead of only exact keywords.',
 ARRAY['ai-rag','ai-vector-store','ml-feature','aid-embedding']::text[],
 ARRAY['ai-llm']::text[],
 'ai-vector-store',
 ARRAY[
   'A reusable test that measures model behavior',
   'A runtime request to execute a named tool',
   'A login session stored by the browser'
 ]::text[],
 'The system made an ___ for each document chunk before saving it for search.',
 'Use ''embedding'' in a sentence about representing meaning as numbers.',
 'curated', 'curator', '2026-05-26'),

('ai-tool-call', 'tool call', null, 'ai-engineering', 'coding', 2,
 'A structured request from an AI model to run a real tool outside the model.',
 'A tool call happens when the model stops producing ordinary text and asks the runtime to run a named tool with specific arguments. The tool might search files, query a database, call an API, send a message, or run a test. The tool result comes back into the conversation, and the model uses that result to decide the next step.',
 'The agent made a tool call to read the failing test before editing the file.',
 'Tool call is the action word for agents. It helps you separate the model thinking from the outside-world operation that actually changes files, fetches data, or verifies work.',
 ARRAY['ai-agent','ai-function-calling','ai-structured-output','aid-tool-call']::text[],
 ARRAY['ai-agent','ai-function-calling']::text[],
 'ai-agent-loop',
 ARRAY[
   'A benchmark score for comparing two models',
   'A database that stores embeddings by similarity',
   'A safety rule that blocks risky model output'
 ]::text[],
 'The agent made a ___ to read the failing test before editing the file.',
 'Use ''tool call'' in a sentence about an AI asking software to perform an action.',
 'curated', 'curator', '2026-05-26'),

('ai-vector-store', 'vector store', null, 'ai-engineering', 'coding', 2,
 'A database-like system that stores embeddings so similar meanings can be searched.',
 'A vector store keeps embeddings and lets software search by meaning instead of exact words. In a RAG system, documents are split into chunks, turned into embeddings, saved in a vector store, and retrieved when a question is semantically close to those chunks.',
 'The RAG pipeline saved support-document embeddings in a vector store.',
 'Vector store is the memory-shelf word for RAG. It helps you understand where retrieved knowledge lives before the model reads it.',
 ARRAY['ai-embedding','ai-rag','ai-vector-db','aid-vector-database']::text[],
 ARRAY['ai-embedding']::text[],
 'ai-rag',
 ARRAY[
   'A prompt instruction with higher priority than the user message',
   'A model answer that invents a source',
   'A structured request to run a tool'
 ]::text[],
 'The RAG pipeline saved support-document embeddings in a ___.',
 'Use ''vector store'' in a sentence about searching stored embeddings by meaning.',
 'curated', 'curator', '2026-05-26'),

('ai-evals', 'evals', 'EE-valz', 'ai-engineering', 'coding', 2,
 'Tests that measure whether an AI system behaves well enough for the task.',
 'Evals means evaluations. An eval is a repeatable test for model behavior: give the system inputs, compare the outputs to expected behavior, and score whether a prompt, model, tool, or agent change made things better or worse. Evals can be simple unit-test-like checks or larger judged datasets.',
 'The new prompt sounded better in chat but failed the evals for citation accuracy.',
 'Evals is the measurement word for AI work. It helps you push past vibes and ask how anyone knows a model change is actually better.',
 ARRAY['ai-eval','ai-benchmark','ai-hallucination','aid-evals']::text[],
 ARRAY['ai-model','ai-prompt']::text[],
 'ai-guardrails',
 ARRAY[
   'Rules that constrain model behavior before it ships',
   'A database that stores embeddings for semantic search',
   'A browser rule for cross-origin requests'
 ]::text[],
 'The new prompt sounded better in chat but failed the ___ for citation accuracy.',
 'Use ''evals'' in a sentence about testing AI behavior with repeatable examples.',
 'curated', 'curator', '2026-05-26'),

('ai-guardrails', 'guardrails', null, 'ai-engineering', 'coding', 2,
 'Rules, checks, and limits that keep an AI system inside acceptable behavior.',
 'Guardrails are the constraints around an AI system. They can block unsafe requests, require citations, validate structured output, stop tool calls that violate policy, or route risky cases to a human. Guardrails do not make a model perfect; they reduce known failure modes around safety, correctness, and control.',
 'The agent had guardrails that blocked live deploy commands without operator approval.',
 'Guardrails is the safety-and-control word. It helps you understand why real AI apps need policies, validators, and approval gates around the model.',
 ARRAY['ai-evals','ai-hallucination','ai-grounding','aid-guardrails']::text[],
 ARRAY['ai-agent','ai-evals']::text[],
 'ai-grounding',
 ARRAY[
   'A numbered file that changes a database schema',
   'A request from a model to run a tool',
   'A data store used for embedding search'
 ]::text[],
 'The agent had ___ that blocked live deploy commands without operator approval.',
 'Use ''guardrails'' in a sentence about rules that constrain AI behavior.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
