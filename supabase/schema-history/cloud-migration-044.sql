-- jargon Stage B+1.17 — AI domain on-ramp expansion (batch: ai-tools +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 modern-capability terms to the `ai-tools` path. Brings ai-tools
--   from 4 → 8 terms. Pairs with the bedrock ai-tools entries (aid-agent,
--   aid-chatbot, aid-copilot, aid-llm) by covering the four capability
--   modes a learner now sees in every product page in 2026:
--     - voice mode: the spoken-conversation interface
--     - vision model: the AI that can read images
--     - multimodal: the umbrella for "text + image + voice in one"
--     - deep research: the long-thinking research mode
--
-- Depends on: cloud-migration-027 (AI domain paths in CHECK constraint),
--             cloud-migration-043 (bedrock terms aid-ai, aid-assistant,
--             aid-response — referenced as prerequisites here),
--             cloud-migration-042 (aid-reasoning — referenced as related
--             for deep-research).
--
-- WHY THESE FOUR:
--   The user is a pharmacist who already uses ChatGPT and Claude on his
--   phone. The ai-tools path needs the words for what those products do
--   NOW — not the older "type a question, get text" model. Voice mode,
--   vision, multimodal, and deep research are the four capability axes
--   ChatGPT, Claude, Gemini, and Copilot all advertise on their landing
--   pages in 2026. Without these words, "the new AI features" is opaque.
--
--   Difficulty mix: 2×d2 (voice mode, vision model — concrete, you can
--   point at them) + 2×d3 (multimodal, deep research — umbrella concepts
--   that sit one level up). Mirrors the d1/d2/d3 spread of ai-foundations.
--
-- MISSION TEST:
--   Each term personalizes cleanly through any lived domain. A pharmacist
--   reads "vision model" as "AI that looks at the prescription bottle";
--   an ecologist reads it as "AI that looks at the field photo"; a soccer
--   fan reads it as "AI that looks at the play diagram." The structural
--   pattern (AI + a sense / mode / depth) is universal — Opus 4.7 only
--   needs to swap the example noun.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── voice mode (d2) ────────────────────────────────────────
('aid-voice-mode', 'voice mode', null, 'ai-tools', 'ai', 2,
 'The setting in an AI app that lets you talk out loud and have the AI talk back, instead of typing.',
 'Voice mode turns an AI assistant into something you can actually have a conversation with — you tap a button, speak, and the AI replies through your phone speaker in a few hundred milliseconds. Under the hood it is doing two extra steps the typed version skips: turning your speech into text, and turning the AI''s reply back into speech. Most modern assistants (ChatGPT, Gemini, Claude on mobile) ship a voice mode, and the voices have gotten good enough to feel close to a real call. It is the right mode for hands-busy moments — driving, walking, cooking — where typing is awkward.',
 'I switched ChatGPT to voice mode on the drive home and just talked through the problem out loud.',
 'Voice mode is how AI starts feeling like an actual assistant instead of a search bar. Once you know the product calls it "voice mode," you can find the toggle (usually a microphone-and-headphones icon next to the send button) and stop fighting with the keyboard.',
 ARRAY['aid-assistant','aid-multimodal','aid-response']::text[],
 ARRAY['aid-assistant']::text[],
 null,
 ARRAY[
   'A speaker setting that reads any AI reply out loud after it appears',
   'A privacy setting that prevents the AI from saving your voice recordings',
   'A premium tier that unlocks faster typing-based replies'
 ]::text[],
 'I switched ChatGPT to ___ on the drive home and just talked through the problem out loud.',
 'Use ''voice mode'' in a sentence about talking to an AI hands-free.',
 'curated', 'curator', '2026-05-06'),

-- ─── vision model (d2) ────────────────────────────────────────
('aid-vision-model', 'vision model', null, 'ai-tools', 'ai', 2,
 'An AI that can look at a picture you give it and describe, read, or reason about what is in it.',
 'A vision model is the half of modern AI that handles images: you upload a photo, screenshot, or scanned document, and the AI can read the text on it, identify what is shown, or answer questions about it. The same products you already use for chat — ChatGPT, Claude, Gemini — have a vision model built in; that is why you can drag a picture into the chat and ask "what is this?" Vision models are how AI turns a phone camera into a research tool: snap a label, a chart, a handwritten note, and ask questions about it in plain language.',
 'I sent a photo of the lab printout to Claude and the vision model pulled the numbers out for me.',
 'Vision is what makes AI useful away from the keyboard. Once you know the AI can actually see the image, you stop describing what is in a screenshot and just send the screenshot — saves a lot of typing, and the AI usually catches details you would have missed.',
 ARRAY['aid-model','aid-multimodal','aid-assistant']::text[],
 ARRAY['aid-model','aid-assistant']::text[],
 null,
 ARRAY[
   'A camera filter app that uses AI to enhance photos before posting',
   'The internal preview of what the AI is "seeing" while it generates an image',
   'A diagnostic tool that checks whether your webcam is working properly'
 ]::text[],
 'I sent a photo of the lab printout to Claude and the ___ pulled the numbers out for me.',
 'Use ''vision model'' in a sentence about an AI looking at an image.',
 'curated', 'curator', '2026-05-06'),

-- ─── multimodal (d3) ────────────────────────────────────────
('aid-multimodal', 'multimodal', 'mul-tee-MOH-dul', 'ai-tools', 'ai', 3,
 'An AI that can handle more than one kind of input — text, images, and voice — inside the same conversation.',
 'Older AI handled one thing at a time: a chat model read text, an image model read pictures, a voice model handled audio. Multimodal AI rolls all of those into one — you can paste a paragraph, drop in a photo, and ask a follow-up out loud, and the AI tracks the whole thread. "Modal" here just means "kind of input." Most modern flagships (GPT-5, Claude Opus, Gemini) are multimodal by default; the word shows up on product pages whenever a company wants to advertise that their AI is not text-only.',
 'The new release is fully multimodal — you can mix a screenshot, a voice note, and typed text in one message.',
 'Multimodal is the umbrella word that ties voice mode and vision together. When a product page says "multimodal," it is shorthand for "this AI handles whatever you throw at it" — and that is now the baseline a learner should expect from any flagship assistant.',
 ARRAY['aid-voice-mode','aid-vision-model','aid-model']::text[],
 ARRAY['aid-model','aid-voice-mode','aid-vision-model']::text[],
 null,
 ARRAY[
   'An AI that can run on more than one device (phone, laptop, watch) at once',
   'A pricing tier that bundles multiple AI products into one subscription',
   'The mode an AI uses when several users are talking to it at the same time'
 ]::text[],
 'The new release is fully ___ — you can mix a screenshot, a voice note, and typed text in one message.',
 'Use ''multimodal'' in a sentence about an AI that handles text, images, and voice together.',
 'curated', 'curator', '2026-05-06'),

-- ─── deep research (d3) ────────────────────────────────────────
('aid-deep-research', 'deep research', null, 'ai-tools', 'ai', 3,
 'A long-running AI mode that goes off, reads many sources, and comes back later with a written report.',
 'Deep research is a newer mode in modern AI assistants where you give the AI a question, walk away, and come back five to thirty minutes later to a written report with citations. While you wait, the AI is reading the web, comparing sources, and writing — much more work than a normal chat reply. ChatGPT, Gemini, and Claude all ship versions of this; the names vary ("Deep Research", "Research", "Extended Research") but the shape is the same: ask once, wait, get a structured answer with links. It is the right mode for "I would normally spend an hour on Google" questions, not "what is the weather."',
 'I kicked off a deep research run on the new pricing model and it came back twenty minutes later with eight sources.',
 'Deep research is how AI starts replacing the open-twenty-tabs phase of a real research task. Knowing the mode exists — and that the slow wait is the whole point — keeps you from giving up after fifteen seconds and assuming the AI froze.',
 ARRAY['aid-reasoning','aid-assistant','aid-grounding']::text[],
 ARRAY['aid-assistant','aid-response']::text[],
 null,
 ARRAY[
   'A premium tier that gives you longer, more detailed normal chat replies',
   'The internal log showing every source the AI considered before answering',
   'A setting that lets the AI ask you clarifying questions before answering'
 ]::text[],
 'I kicked off a ___ run on the new pricing model and it came back twenty minutes later with eight sources.',
 'Use ''deep research'' in a sentence about an AI that takes a long time and returns a written report.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
