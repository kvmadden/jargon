-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-evaluation +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-evaluation` path. Brings ai-evaluation
--   from 3 → 7 terms. The path already has benchmark, grounding, and
--   hallucination (cloud-migration-040). This batch fills the four
--   most-load-bearing gaps a non-engineer hits when reading AI safety
--   posts, model-release blog posts, and "is this thing trustworthy?"
--   discourse:
--     - evals: the test-suite frame; the most-used word inside AI labs
--       and now the dominant word on every model release card. Without
--       it, "we ran the new model through our evals" is opaque.
--     - human eval: the ground-truth counterweight to automated evals.
--       The word every news story about "AI rated by human raters"
--       leans on, and the necessary pair to evals.
--     - drift: the watching-over-time word. Once a learner knows that
--       a deployed model can quietly start behaving differently —
--       without anyone retraining it — they have the frame for "why
--       did the AI start getting worse last month?"
--     - red team: the adversarial-testing word. Increasingly used in
--       AI safety announcements ("our red team found X before launch")
--       and the complement to benchmark + human eval.
--
-- Depends on: cloud-migration-027 (ai-evaluation in path CHECK constraint),
--             cloud-migration-040 (existing ai-evaluation terms;
--             these new rows reference aid-benchmark, aid-grounding,
--             aid-hallucination as related terms / prereqs),
--             cloud-migration-039 (aid-model, aid-training as prereqs),
--             cloud-migration-038 (aid-safety as related for red team).
--
-- DIFFICULTY MIX:
--   Two d2 (evals, human eval) — the everyday testing frame, named
--   in plain language. A learner who has worked any kind of QA or
--   review process can ground these immediately.
--   Two d3 (drift, red team) — concepts that sit one level up;
--   "drift" requires the prior idea that a model behaves predictably
--   in the first place; "red team" requires understanding that
--   adversarial testing is a deliberate, separate discipline.
--
-- MISSION TEST:
--   Each term personalizes cleanly through any lived domain. A
--   pharmacist reads "evals" as "the test suite for a clinical
--   decision tool"; an ecologist reads it as "the test cases for a
--   species-ID model"; a soccer fan reads it as "the scouting drills
--   used to compare players." "drift" is universal: "how the formulary
--   changes year over year," "how a coastline shifts season to season,"
--   "how a team''s style changes mid-season without a new coach."
--   "red team" is "the audit team that intentionally tries to break a
--   process before it ships" in any domain. "human eval" is "having a
--   human reviewer rate the output instead of an automated check"
--   anywhere — clinical chart review, peer review, referee review.
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── evals (d2) ────────────────────────────────────────
('aid-evals', 'evals', null, 'ai-evaluation', 'ai', 2,
 'The test suite an AI team runs against a model to measure how good it actually is.',
 'Evals — short for evaluations — are the test cases AI teams run to measure how a model performs. Each eval is a question or task with a known right answer; you run the model against thousands of them and score the percentage it gets right. Some evals test reasoning, some test math, some test writing, some test whether the model follows safety rules. Every model release blog post leans on evals: "the new model scored 12 points higher on our internal evals" is the AI version of "the new car got better mileage on the test track."',
 'Before shipping the new model, the team ran it through their full set of evals and saw a four-point jump on reasoning.',
 'Evals are how AI teams talk to each other about quality. Once you know "evals" is just "the test suite," release notes and research papers stop reading like alphabet soup — and you can ask the right follow-up question, which is always "what was on the eval?"',
 ARRAY['aid-benchmark','aid-human-eval','aid-model','aid-red-team']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'The internal name for a model''s confidence score on a single answer',
   'A leaderboard ranking AI products by user star ratings',
   'The settings panel where you adjust how an AI behaves at runtime'
 ]::text[],
 'Before shipping the new model, the team ran it through their full set of ___ and saw a four-point jump on reasoning.',
 'Use ''evals'' in a sentence about testing how good a model is.',
 'curated', 'curator', '2026-05-06'),

-- ─── human eval (d2) ────────────────────────────────────────
('aid-human-eval', 'human eval', null, 'ai-evaluation', 'ai', 2,
 'When real people read the AI''s answers and rate them, instead of an automated test doing the scoring.',
 'A human eval is what happens when "is this answer good?" is too subjective for a computer to score. You take a batch of model outputs, hand them to trained reviewers (sometimes contractors, sometimes domain experts), and ask them to rate each one — for accuracy, helpfulness, tone, safety. Human evals are slower and more expensive than automated ones, but for anything involving judgment ("did the assistant explain this clearly?" "was the response respectful?") they are the only honest measure. Most modern model launches pair automated evals with a human eval pass before shipping.',
 'The automated evals looked great, but the human eval caught that the new model''s tone had gotten subtly colder.',
 'Whenever you read "rated by human reviewers" or "scored by trained evaluators" in a model release, that is a human eval. Knowing the term lets you tell the difference between "the test scored it 95%" and "actual humans read it and thought it was good" — those are very different claims.',
 ARRAY['aid-evals','aid-benchmark','aid-red-team']::text[],
 ARRAY['aid-evals']::text[],
 null,
 ARRAY[
   'A user satisfaction survey shown to people after a chat ends',
   'The mode where the AI asks a human for help when it gets stuck',
   'A side-by-side comparison view that shows two model answers to the same prompt'
 ]::text[],
 'The automated evals looked great, but the ___ caught that the new model''s tone had gotten subtly colder.',
 'Use ''human eval'' in a sentence about real people rating AI output.',
 'curated', 'curator', '2026-05-06'),

-- ─── drift (d3) ────────────────────────────────────────
('aid-drift', 'drift', null, 'ai-evaluation', 'ai', 3,
 'When a deployed model''s behavior slowly changes over time without anyone retraining it.',
 'Drift is the quiet way an AI product gets worse (or weirder) without warning. The model itself has not changed — same weights, same training — but the answers start sliding: a feature that worked well last month is suddenly missing edge cases, the tone shifts, the same question gets a noticeably different answer. Sometimes drift comes from the inputs (the kinds of questions users are asking have changed); sometimes from the surrounding system (a new system prompt, a new tool, a new safety filter); sometimes from the model provider quietly updating something behind the scenes. Catching drift means re-running evals on a schedule and watching the scores instead of trusting that "it was fine when we shipped it."',
 'We caught the drift in the weekly eval run — accuracy was down four points and nobody had touched the model.',
 'Drift is why "we tested it once and it was fine" is not enough. Once an AI feature is live, it has to be re-checked over time. Knowing the word lets you read "we monitor for drift" on a vendor security page and understand the actual ongoing work being described.',
 ARRAY['aid-evals','aid-human-eval','aid-benchmark','aid-hallucination']::text[],
 ARRAY['aid-evals','aid-model']::text[],
 null,
 ARRAY[
   'The slow loss of context as a long conversation runs past the window',
   'The way a model drifts off-topic when a prompt is too vague',
   'The latency spike that happens when a server is under heavy load'
 ]::text[],
 'We caught the ___ in the weekly eval run — accuracy was down four points and nobody had touched the model.',
 'Use ''drift'' in a sentence about a deployed model''s behavior changing over time.',
 'curated', 'curator', '2026-05-06'),

-- ─── red team (d3) ────────────────────────────────────────
('aid-red-team', 'red team', null, 'ai-evaluation', 'ai', 3,
 'A group whose job is to attack the AI on purpose — trying to break it, trick it, or make it misbehave — before it ships to real users.',
 'A red team is the in-house adversary. While most testing asks "does this work right?" red-teaming asks "how can I make this go wrong?" — feeding the model the trickiest, sneakiest, most ill-intentioned prompts a real user might ever throw at it, and seeing what slips through. The term comes from the military and security worlds (a "red team" plays the attacker); AI labs borrowed it because shipping a model without a red team pass is now considered reckless. Red teams find the prompt-injection holes, the jailbreaks, the subtle factual failures, and the topics where the model gives confident wrong answers — all before the rest of the world finds them.',
 'The red team found three jailbreaks in the first afternoon and the launch slipped a week while the team patched them.',
 'When a company says "we red-teamed the model before launch," they are saying "we paid people to attack it on purpose." Knowing the word lets you read AI safety announcements without bouncing off the jargon — and ask the right follow-up: who was on the red team, and what did they find?',
 ARRAY['aid-safety','aid-evals','aid-human-eval','aid-prompt-injection']::text[],
 ARRAY['aid-evals','aid-safety']::text[],
 null,
 ARRAY[
   'The team responsible for branding and visual design at an AI company',
   'A live monitoring group that watches for outages once a model is shipped',
   'The internal name for the engineers who fine-tune a model after release'
 ]::text[],
 'The ___ found three jailbreaks in the first afternoon and the launch slipped a week while the team patched them.',
 'Use ''red team'' in a sentence about people deliberately trying to break an AI before launch.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
