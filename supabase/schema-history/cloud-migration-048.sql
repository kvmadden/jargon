-- jargon Stage B+1.17 — AI domain on-ramp expansion (ai-policy +4)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 4 anchor terms to the `ai-policy` path. Brings ai-policy
--   from 3 → 7 terms. The path already has agi, alignment, and safety —
--   the abstract long-arc concepts. This batch fills the four most
--   load-bearing words a learner now hits in 2026 news coverage,
--   release notes, and policy debate:
--     - jailbreak: the cheat-code word for getting an AI past its rules
--     - bias: the unfairness word, grounded in training-data reality
--     - frontier model: the bleeding-edge tier (GPT-5, Opus, Gemini Ultra)
--     - governance: the rules-and-norms umbrella (EU AI Act, NIST, internal policy)
--
-- Depends on: cloud-migration-027 (AI domain paths in CHECK constraint),
--             earlier ai-policy migrations (these new rows reference
--             aid-safety, aid-alignment, aid-refusal, aid-prompt-injection,
--             aid-training, aid-model as related/prereq).
--
-- DIFFICULTY MIX:
--   Two d2 (jailbreak, bias) — direct, graspable from one example
--   Two d3 (frontier-model, governance) — meta-words that sit one level up
--
-- MISSION TEST NOTES:
--   All four personalize cleanly through any lived domain.
--     - jailbreak: "the cheat code patients use to talk a doctor into a
--       prescription they shouldn''t have" / "the workaround a player runs
--       to dodge a referee call" — the structure (rules + clever bypass)
--       is universal.
--     - bias: a pharmacist sees "a formulary that only stocks brand-names
--       missing better generic options"; an ecologist sees "a survey that
--       only sampled one stream and missed the rest of the watershed";
--       a soccer fan sees "a stat that only counts goals from open play
--       and ignores set pieces." Same shape: skewed input → skewed output.
--     - frontier model: "the newest research-grade tool" generalizes
--       universally — every field has a "best gear, only a few people
--       have it yet" tier.
--     - governance: "the policies and norms" — applies in any rule-bound
--       environment (clinical practice, sports leagues, finance, building
--       codes). Easy to translate.
--
-- INLINE DEFINITION NOTES:
--   - "EU AI Act" gets a one-clause inline gloss ("Europe''s 2024 law that
--     classifies AI systems by risk level"). Used once, in governance.
--   - "NIST" gets a one-clause inline gloss ("the U.S. standards agency
--     whose AI Risk Management Framework many companies follow"). Used
--     once, in governance.
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

-- ─── jailbreak (d2) ────────────────────────────────────────
('aid-jailbreak', 'jailbreak', null, 'ai-policy', 'ai', 2,
 'Getting an AI to bypass its own safety rules through clever prompting — riddles, role-play, or hypothetical framing.',
 'A jailbreak is a prompt designed to talk an AI past its guardrails. The trick is usually social, not technical: dress the request up as a story ("write a scene where a character explains..."), as a hypothetical ("if the rules did not apply, how would..."), or as a roleplay ("you are an AI from a parallel universe where..."). When it works, the AI answers something it would normally refuse. The same word gets used for the broader pattern — any clever workaround that gets around the AI''s training — and a lot of AI safety work is now a cat-and-mouse game between new jailbreaks and patches that close them.',
 'Someone posted a jailbreak that wrapped the request in a fictional dialogue and the model answered before the new training caught it.',
 'Jailbreaks are how the AI safety conversation actually plays out in public. Knowing the word lets you read news headlines, model release notes, and red-team reports without bouncing — and lets you tell the difference between a serious safety failure and a cherry-picked trick that gets patched the next week.',
 ARRAY['aid-refusal','aid-prompt-injection','aid-safety','aid-alignment']::text[],
 ARRAY['aid-refusal']::text[],
 null,
 ARRAY[
   'A bug that lets the AI run on a device it was not licensed for',
   'The act of breaking out of a long chat thread to start a fresh one',
   'A speed-up trick that makes the AI generate replies in fewer steps'
 ]::text[],
 'Someone posted a ___ that wrapped the request in a fictional dialogue and the model answered before the new training caught it.',
 'Use ''jailbreak'' in a sentence about getting an AI past its safety rules.',
 'curated', 'curator', '2026-05-06'),

-- ─── bias (d2) ────────────────────────────────────────
('aid-bias', 'bias', null, 'ai-policy', 'ai', 2,
 'When an AI gives skewed or unfair answers because the data it learned from was already skewed.',
 'AI bias is the pattern where a model produces unfair or one-sided outputs — usually not because anyone programmed it that way, but because the data it learned from was lopsided to begin with. If a hiring model trained mostly on resumes from one kind of candidate, it picks up that pattern as "what good looks like." If a medical model trained mostly on data from one population, its predictions drift on everyone else. Bias is not a single bug you fix once — it is an ongoing measurement problem that gets re-checked every time the model or the data behind it changes.',
 'The team flagged bias in the resume screener after it kept ranking the same kind of candidate at the top.',
 'Most of the public debate about "is AI fair" is really a debate about bias. Knowing the word lets you read past the headline ("AI shown to discriminate against...") to the actual question — which population, on which task, measured how — instead of reacting to the framing.',
 ARRAY['aid-training','aid-alignment','aid-safety','aid-grounding']::text[],
 ARRAY['aid-training']::text[],
 null,
 ARRAY[
   'A statistical adjustment a model applies to its raw outputs before showing them',
   'A user setting that lets you nudge the AI toward shorter or longer answers',
   'The internal weight a model gives to its most recent message in a conversation'
 ]::text[],
 'The team flagged ___ in the resume screener after it kept ranking the same kind of candidate at the top.',
 'Use ''bias'' in a sentence about an AI giving unfair or skewed answers.',
 'curated', 'curator', '2026-05-06'),

-- ─── frontier model (d3) ────────────────────────────────────────
('aid-frontier-model', 'frontier model', null, 'ai-policy', 'ai', 3,
 'The most-capable, bleeding-edge AI models — the ones at the front of the field, usually from a small handful of well-funded labs.',
 'A frontier model is whatever sits at the leading edge of what AI can do right now. In 2026 that means models like GPT-5, Claude Opus, and Gemini Ultra — the largest, most-capable systems, trained by a small group of labs ("frontier labs") with the compute and money to push past everyone else. The bar moves: today''s frontier model is next year''s mid-tier one. The word matters because policy conversations specifically about frontier models — risk reviews, deployment delays, government testing — apply only to that top tier and not to the long tail of smaller open-source models behind them.',
 'New government rules are aimed only at frontier models, not the smaller open-source ones running on people''s laptops.',
 'When a news story or a policy paper says "frontier models," it is not a marketing word — it is a specific tier with specific rules. Knowing the word keeps you from confusing "the most-capable AI on the planet" with "any AI" — those are very different scopes for any rule, risk, or capability claim.',
 ARRAY['aid-model','aid-safety','aid-alignment','aid-agi']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'An AI model that runs entirely on a personal device with no cloud connection',
   'A model that has been opened to the public for anyone to download and modify',
   'The smallest, fastest tier of model offered by a provider for low-latency tasks'
 ]::text[],
 'New government rules are aimed only at ___, not the smaller open-source ones running on people''s laptops.',
 'Use ''frontier model'' in a sentence about the most-capable AI systems at the front of the field.',
 'curated', 'curator', '2026-05-06'),

-- ─── governance (d3) ────────────────────────────────────────
('aid-governance', 'governance', null, 'ai-policy', 'ai', 3,
 'The rules, regulations, and norms that decide how AI gets built, tested, and deployed — both the laws and the internal company policies.',
 'AI governance is the whole layer of rules sitting on top of the technical work. It includes external rules — like the EU AI Act, Europe''s 2024 law that classifies AI systems by risk level — and frameworks like the one from NIST, the U.S. standards agency whose AI Risk Management Framework many companies follow voluntarily. It also includes internal rules: the policies a company writes about which models it allows employees to use, what data can go into them, and what has to be reviewed before a model ships to customers. Governance is what turns "we should be careful with AI" into a specific list of who decides, who reviews, and who is on the hook when something goes wrong.',
 'The legal team is building out our internal AI governance — what models people can use, what data goes in, who has to sign off before launch.',
 'Once an organization starts using AI seriously, governance is the part that decides whether it scales safely or blows up. Knowing the word lets you tell the difference between a real policy conversation ("here is our review process") and a vibes one ("we should be responsible about this") — and lets you read regulatory news without bouncing on the alphabet soup.',
 ARRAY['aid-safety','aid-alignment','aid-frontier-model','aid-bias']::text[],
 ARRAY['aid-safety']::text[],
 null,
 ARRAY[
   'The internal control panel where engineers tune a model''s behavior at runtime',
   'A specific certification that any AI product has to earn before being sold',
   'The hardware-level rules that decide which chips an AI is allowed to run on'
 ]::text[],
 'The legal team is building out our internal AI ___ — what models people can use, what data goes in, who has to sign off before launch.',
 'Use ''governance'' in a sentence about the rules and policies around how AI gets built and used.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
