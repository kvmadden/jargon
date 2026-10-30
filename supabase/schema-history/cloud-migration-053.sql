-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-policy +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-policy` path. Brings ai-policy
--   from 7 → 11 terms. The path already has agi, alignment, bias,
--   frontier-model, governance, jailbreak, safety. This batch fills
--   four more load-bearing words a learner now hits in 2026 news,
--   product debate, and lawsuit coverage:
--     - copyright (d2): the legal/ethical question of training AI on
--       copyrighted material — books, articles, art, code
--     - watermark (d3): embedded markers identifying AI-generated
--       content, sometimes invisible
--     - liability (d2): who is legally responsible when AI causes harm —
--       the user, the developer, the deployer — open question
--     - existential-risk (d3): the long-tail concern that very capable
--       AI could pose civilization-scale risks; sometimes shortened to
--       "x-risk"; legitimately contested in the field
--
-- Depends on: cloud-migration-027 (AI domain paths in CHECK constraint),
--             earlier ai-policy migrations (these new rows reference
--             aid-training, aid-governance, aid-safety, aid-frontier-model,
--             aid-alignment, aid-agi, aid-hallucination as related/prereq).
--
-- DIFFICULTY MIX:
--   Two d2 (copyright, liability) — direct, graspable from one example,
--     things a learner has already heard about in news stories
--   Two d3 (watermark, existential-risk) — concepts that sit one level up.
--     Watermark requires understanding that AI text/images can be marked
--     in ways humans cannot see. Existential-risk requires the prior idea
--     that AI capability is on a trajectory, not a fixed snapshot, and
--     requires holding contested-terrain framing instead of a verdict.
--
-- POLICY-SPECIFIC VERIFIABILITY DISCIPLINE:
--   This batch sits on top of legal and contested-terrain ground. Hard
--   rules followed in every entry:
--     - NO specific legal verdicts. Lawsuits referenced are framed as
--       "filed" and "pending" only. No claims about who has won, settled,
--       or been ruled against.
--     - NO claims that any specific law clearly applies to AI. Where AI
--       law is unsettled (most of liability, most of copyright in the
--       training-data context), the canonical text says so.
--     - For existential-risk: the contested status is itself the content.
--       Some prominent researchers take it seriously; others dismiss it.
--       The entry presents BOTH positions without picking a side. the owner
--       can decide what he thinks; jargon does not.
--     - "x-risk" is mentioned as the short form, with a one-clause inline
--       gloss the first time it appears.
--
-- INLINE DEFINITION NOTES:
--   - "NYT" appears once in copyright with a one-clause inline gloss
--     ("the New York Times").
--   - "x-risk" appears once in existential-risk with a one-clause inline
--     gloss ("short for existential risk").
--   - No other unexplained acronyms in this batch.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── copyright (d2) ────────────────────────────────────────
('aid-copyright', 'copyright', null, 'ai-policy', 'ai', 2,
 'The legal and ethical question of whether AI labs can train models on copyrighted books, articles, art, and code without permission.',
 'AI copyright is the open question of what counts as fair use when a model learns from material someone else owns. The big AI labs trained their models on huge piles of text and images scraped from the web — including books, news articles, art, and code that the original creators did not license for that use. Several lawsuits have been filed: the NYT (the New York Times) sued OpenAI in late 2023, and groups of visual artists filed similar suits against image-generation companies. The cases are still working their way through the courts, and the underlying legal question — does training on copyrighted material count as fair use — is not settled. Different countries are arriving at different answers, and the rules will likely keep shifting for years.',
 'The new lawsuit is the latest copyright case asking whether AI labs can train on books and articles without paying for them.',
 'Copyright is one of the live fault lines in AI right now — it touches every creator whose work might end up in a training set. Knowing the term lets you read lawsuit headlines and licensing announcements without bouncing, and lets you tell the difference between "AI labs are being sued" (true) and "AI training has been ruled illegal" (not the same thing, and not the current state).',
 ARRAY['aid-training','aid-governance','aid-liability','aid-frontier-model']::text[],
 ARRAY['aid-training']::text[],
 null,
 ARRAY[
   'A feature that lets a creator stamp their name onto every AI-generated image',
   'The licensing fee a user pays to access a paid AI product like ChatGPT or Claude',
   'A protocol that automatically credits original sources every time an AI quotes them'
 ]::text[],
 'The new lawsuit is the latest ___ case asking whether AI labs can train on books and articles without paying for them.',
 'Use ''copyright'' in a sentence about the legal question of training AI on copyrighted material.',
 'curated', 'curator', '2026-05-06'),

-- ─── watermark (d3) ────────────────────────────────────────
('aid-watermark', 'watermark', null, 'ai-policy', 'ai', 3,
 'A marker embedded in AI-generated text, images, or video to flag that it came from an AI — sometimes visible, often invisible to humans.',
 'A watermark is a signal mixed into AI output that lets a detector later tell "this was made by a model." For images, it can be a faint pattern in the pixels that a human eye does not notice but a checking tool does. For text, it can be a subtle statistical bias in word choice that gets baked in during generation. Some watermarks are visible — a small "AI-generated" badge — but the more interesting ones are not. Watermarking is one of the leading proposals for handling deepfakes and AI-generated misinformation, but the techniques are still maturing, and a determined user can often strip a watermark out by editing or paraphrasing the output.',
 'The platform now adds a watermark to every AI-generated image so that fact-checkers can flag them later.',
 'Watermarking is one of the few technical answers to "how will we know what is AI-generated when it is everywhere." Knowing the word lets you read provenance and deepfake coverage without bouncing — and lets you ask the harder follow-up, which is always "how easily can the watermark be removed."',
 ARRAY['aid-governance','aid-safety','aid-multimodal','aid-hallucination']::text[],
 ARRAY['aid-governance']::text[],
 null,
 ARRAY[
   'A confidence score the AI shows next to each answer to indicate certainty',
   'The login badge a user gets after verifying their account on an AI platform',
   'A subscription perk that hides ads from a user''s AI-generated content'
 ]::text[],
 'The platform now adds a ___ to every AI-generated image so that fact-checkers can flag them later.',
 'Use ''watermark'' in a sentence about embedded markers identifying AI-generated content.',
 'curated', 'curator', '2026-05-06'),

-- ─── liability (d2) ────────────────────────────────────────
('aid-liability', 'liability', null, 'ai-policy', 'ai', 2,
 'The unsettled legal question of who is responsible when an AI causes harm — the user who prompted it, the company that deployed it, or the lab that built it.',
 'AI liability is the question of who pays when something goes wrong. If an AI assistant gives bad medical advice and someone follows it, who is responsible — the person who asked, the hospital that put the assistant in front of patients, or the company that trained the model? If a self-driving car crashes, is it the driver, the carmaker, or the AI vendor? Existing liability law was written before AI products, and courts and regulators are still working out how it applies. Different jurisdictions are coming to different answers, and the rules around "who is on the hook" will likely keep shifting as cases get decided. Treat liability as an open question, not a settled doctrine.',
 'The product team paused the launch until legal could figure out where liability sits if the assistant gives someone wrong information.',
 'Liability is the question every company actually has to answer before deploying AI in a high-stakes setting. Knowing the term lets you read product announcements with the right ear ("with human review in the loop" usually means "to keep liability in a known place") and tell the difference between "AI is allowed to do this" and "someone has clearly accepted responsibility for what happens when it goes wrong."',
 ARRAY['aid-governance','aid-safety','aid-copyright','aid-frontier-model']::text[],
 ARRAY['aid-governance']::text[],
 null,
 ARRAY[
   'The amount a user pays each month to access a premium AI product',
   'A technical limit on how many requests a single user can send per day',
   'The score an AI gives itself for how confident it is in a single answer'
 ]::text[],
 'The product team paused the launch until legal could figure out where ___ sits if the assistant gives someone wrong information.',
 'Use ''liability'' in a sentence about who is legally responsible when AI causes harm.',
 'curated', 'curator', '2026-05-06'),

-- ─── existential risk (d3) ────────────────────────────────────────
('aid-existential-risk', 'existential risk', null, 'ai-policy', 'ai', 3,
 'The contested concern that very capable future AI could pose risks at a civilization-wide scale — sometimes shortened to "x-risk."',
 'Existential risk — short for existential risk, sometimes written as "x-risk" — is the long-tail worry that a future AI system, if capable enough, could cause harm at the scale of civilization itself rather than at the scale of one user or one company. The concern is genuinely contested. Some prominent AI researchers and lab leaders take it seriously and call for slower development and more safety work; others find the framing speculative, distracting from concrete near-term harms like bias and copyright, or simply not supported by current evidence. There is no consensus position. Both camps include serious people, and the debate is one of the active fault lines in AI policy right now.',
 'The open letter brought existential risk back into the headlines, with one camp calling for a pause and the other arguing the worry is overblown.',
 'Existential risk shows up in major AI policy moments — open letters, lab-safety announcements, government hearings — and the framing matters. Knowing the term, AND knowing it is contested, lets you read the coverage without taking either side''s framing for granted: it is a real debate among serious people, not a settled fact in either direction.',
 ARRAY['aid-agi','aid-alignment','aid-safety','aid-frontier-model','aid-governance']::text[],
 ARRAY['aid-alignment','aid-agi']::text[],
 null,
 ARRAY[
   'The risk that an individual user becomes too dependent on a single AI assistant',
   'The financial risk a company takes on when it commits to a long-term AI vendor',
   'The risk that an AI product fails to launch on time and loses market share'
 ]::text[],
 'The open letter brought ___ back into the headlines, with one camp calling for a pause and the other arguing the worry is overblown.',
 'Use ''existential risk'' in a sentence about civilization-scale concerns from very capable AI.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
