-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-prompting +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-prompting` path. Brings ai-prompting
--   from 8 → 12 terms. The path already covers prompt, system-prompt,
--   few-shot, zero-shot, chain-of-thought, role-prompting, prompt-injection,
--   and refusal — the asking-style + safety vocabulary. This batch adds
--   the four most-load-bearing PRACTICE words a non-engineer hits the
--   moment they actually start using AI day-to-day:
--     - step-by-step: explicitly asking the AI to break a task into
--       ordered steps (the everyday version of chain-of-thought)
--     - iteration: refining a prompt across multiple turns instead of
--       expecting the first answer to be the final one
--     - output-format: telling the AI what shape you want — bullets,
--       a table, a JSON object with named fields
--     - prompt-template: a reusable prompt skeleton with placeholders
--       for the variable parts (the meta-move once you know the others)
--
-- Depends on: cloud-migration-027 (ai-prompting in path CHECK constraint),
--             cloud-migration-039/040/045 (these new rows reference
--             aid-prompt, aid-chain-of-thought, aid-system-prompt,
--             aid-response, aid-context-window as related/prereq).
--
-- DIFFICULTY MIX:
--   Three d2 (step-by-step, iteration, output-format) — direct,
--     graspable from one example, things a learner DOES not learns ABOUT
--   One d3 (prompt-template) — meta-word that sits one level up
--
-- MISSION TEST NOTES:
--   All four canonical entries stay in plain English with universal
--   examples — no domain analogies. The personalize-term layer adds
--   the lived-domain framing at runtime.
--     - step-by-step: example uses a generic planning task
--     - iteration: example uses a generic draft-and-refine pattern
--     - output-format: examples use bullet lists and JSON (with the
--       JSON acronym defined inline per the hard rules)
--     - prompt-template: example uses a generic placeholder pattern
--
-- INLINE DEFINITION NOTES:
--   - "JSON" gets a one-clause inline gloss the first time it appears
--     ("JSON — a structured-data format computers and AI both speak")
--     used once in output-format. No other unexplained acronyms.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── step-by-step (d2) ────────────────────────────────────────
('aid-step-by-step', 'step by step', null, 'ai-prompting', 'ai', 2,
 'Asking the AI to break a task into ordered steps before answering — a small phrase that often makes the answer noticeably better.',
 'Adding "step by step" (or "think step by step," or "walk me through this in order") to a prompt tells the AI to slow down and lay out its work in sequence instead of jumping straight to a conclusion. It is the everyday, plain-English version of chain-of-thought prompting. The phrase tends to help most on tasks with multiple parts — planning, math, anything where a missed step changes the outcome. It does not help on tasks the AI can answer in one shot, like a quick definition or a simple lookup.',
 'I added "go step by step" to the prompt and the plan came back ordered instead of jumbled.',
 'It is the cheapest, most reliable prompting move there is. One phrase, no template, no setup — and on the right kind of task it turns a vague answer into a usable one. Knowing the move means you reach for it without thinking.',
 ARRAY['aid-chain-of-thought','aid-prompt','aid-iteration']::text[],
 ARRAY['aid-prompt']::text[],
 null,
 ARRAY[
   'Sending a long prompt as several short messages instead of one big one',
   'A setting that makes the AI type one word at a time on screen',
   'Restarting a chat from scratch every time you change the topic'
 ]::text[],
 'I added "go ___" to the prompt and the plan came back ordered instead of jumbled.',
 'Use ''step by step'' in a sentence about asking AI to break a task into ordered steps.',
 'curated', 'curator', '2026-05-06'),

-- ─── iteration (d2) ────────────────────────────────────────
('aid-iteration', 'iteration', null, 'ai-prompting', 'ai', 2,
 'Refining a prompt across multiple back-and-forth turns instead of expecting the first answer to be the final one.',
 'Iteration is the habit of treating the AI''s first reply as a draft, not a verdict. You read what it gave you, notice what is off — too long, wrong tone, missed a key point — and send a follow-up that fixes that one thing. A few rounds of "shorter," "less formal," "add a section on X" usually gets you somewhere a single perfect prompt would not. The people who get the most out of AI tools are almost never the ones who write a long opening prompt; they are the ones who keep the conversation going for three or four turns.',
 'It took three rounds of iteration to get the email to the right length and tone.',
 'New users tend to send one prompt, get a so-so answer, and decide the AI is not very good. Knowing iteration is the actual workflow reframes that whole experience — first answers are starting points, and the value comes from the edits.',
 ARRAY['aid-prompt','aid-step-by-step','aid-output-format','aid-context-window']::text[],
 ARRAY['aid-prompt']::text[],
 null,
 ARRAY[
   'The number of times an AI model was retrained on the same dataset',
   'A loop the AI runs internally before it starts generating a reply',
   'A version number stamped on each release of an AI product'
 ]::text[],
 'It took three rounds of ___ to get the email to the right length and tone.',
 'Use ''iteration'' in a sentence about refining a prompt across multiple turns.',
 'curated', 'curator', '2026-05-06'),

-- ─── output-format (d2) ────────────────────────────────────────
('aid-output-format', 'output format', null, 'ai-prompting', 'ai', 2,
 'Telling the AI what shape you want the answer in — three bullet points, a table, a short paragraph, a JSON object with specific fields.',
 'Output format is the part of the prompt where you describe the SHAPE of the answer, not the content. "Give me three bullet points." "Reply as a table with columns for name, date, and status." "Return a JSON object — JSON is a structured-data format computers and AI both speak — with the keys title, summary, and tags." The model defaults to long flowing prose unless you ask for something else, and asking for something else costs nothing. Specifying the format up front saves a whole round of "actually, can you reformat that as a list."',
 'I asked for the output format to be three bullets and a one-line summary, and it came back exactly that.',
 'Most disappointing AI answers are not wrong — they are the wrong shape. Knowing to specify output format up front is the difference between getting a wall of text you have to clean up and getting something you can paste straight into where it needs to go.',
 ARRAY['aid-prompt','aid-iteration','aid-step-by-step','aid-system-prompt']::text[],
 ARRAY['aid-prompt']::text[],
 null,
 ARRAY[
   'The font and color the AI uses to display its answers on screen',
   'The maximum length the AI is allowed to generate in a single response',
   'A hidden setting that controls which language the AI replies in'
 ]::text[],
 'I asked for the ___ to be three bullets and a one-line summary, and it came back exactly that.',
 'Use ''output format'' in a sentence about telling AI what shape you want the answer in.',
 'curated', 'curator', '2026-05-06'),

-- ─── prompt-template (d3) ────────────────────────────────────────
('aid-prompt-template', 'prompt template', null, 'ai-prompting', 'ai', 3,
 'A reusable prompt skeleton with placeholders for the parts that change — write it once, fill in the blanks every time after.',
 'A prompt template is a prompt you have written carefully ONE time, with placeholders where the variable details go. Something like: "act as a careful editor. read the draft below and give me three pieces of feedback on clarity, tone, and length. draft: {paste here}." The fixed parts (role, instructions, output format) stay the same. Only the input changes. Templates are how people scale up from "I prompt the AI fresh every time" to "I have five prompts I trust and I just plug new content into them." Most AI products that let you save prompts are really just template tools.',
 'Once I had a prompt template for review feedback, I stopped rewriting the instructions every time.',
 'The shift from one-off prompts to templates is the shift from using AI casually to using it as a real tool. A learner who knows the word can recognize the pattern in product features ("save this prompt," "create a custom assistant") and start building their own.',
 ARRAY['aid-prompt','aid-system-prompt','aid-iteration','aid-output-format','aid-role-prompting']::text[],
 ARRAY['aid-prompt','aid-system-prompt']::text[],
 null,
 ARRAY[
   'A pre-written reply the AI sends when it does not understand the question',
   'The default starting message every new chat session begins with',
   'A frozen copy of an old prompt kept for legal record-keeping'
 ]::text[],
 'Once I had a ___ for review feedback, I stopped rewriting the instructions every time.',
 'Use ''prompt template'' in a sentence about a reusable prompt with placeholders.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
