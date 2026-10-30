-- jargon Stage B+1.16 — AI domain seed batch 2 (+12 anchor terms)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 12 more curated AI terms on top of cloud-migration-039's 10.
--   Total AI corpus after this lands: 22 terms across all 6 paths.
--
-- Depends on: cloud-migration-039 (initial 10 AI terms — referenced as
--   prereqs by some of the new entries)
--
-- WHY THIS EXISTS:
--   Batch 1 covered the foundational vocabulary (model, token, prompt,
--   embedding, RAG, agent, etc.) but left 6 of the 6 paths underweight.
--   Specifically: ai-policy was empty (no terms), and ai-prompting /
--   ai-evaluation / ai-tools each had only 1-2 anchors.
--
--   Batch 2 fills the gaps:
--     ai-foundations: + temperature
--     ai-tools:        + chatbot, copilot
--     ai-prompting:    + few-shot, chain of thought
--     ai-products:     + fine-tuning, tool call
--     ai-evaluation:   + grounding, benchmark
--     ai-policy:       + alignment, AGI, safety  (path now has content)
--
--   Path balance after batch 2:
--     ai-foundations: 4 (model, token, context window, temperature)
--     ai-tools:       4 (LLM, agent, chatbot, copilot)
--     ai-prompting:   4 (prompt, system prompt, few-shot, chain of thought)
--     ai-products:    4 (embedding, RAG, fine-tuning, tool call)
--     ai-evaluation:  3 (hallucination, grounding, benchmark)
--     ai-policy:      3 (alignment, AGI, safety)
--
-- VOCABULARY DISCIPLINE (B+1.16):
--   Each new term's body fields use only: plain English, the term being
--   defined, or another term in the prereqs list. Specifically:
--     - tool call references "agent" and "prompt" (both in prereqs)
--     - grounding references "hallucination" (in prereqs)
--     - chain of thought / few-shot / system prompt all reference "prompt"
--   References to product names (Claude, GPT-5, Anthropic, Microsoft,
--   GitHub, etc.) are concrete-noun signposts, not corpus teaching terms.
--
-- IDEMPOTENT: ON CONFLICT (id) DO NOTHING. Re-run safely.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── ai-foundations (+1) ────────────────────────────────────────
('aid-temperature', 'temperature', null, 'ai-foundations', 'ai', 2,
 'A dial that controls how random or creative the AI''s answers are — low = predictable, high = unexpected.',
 'Temperature is a number (usually 0 to 1 or 0 to 2) that affects how much randomness the model uses when picking each next token. At 0, the model picks the single most likely token every time — the same prompt gives the same answer. At higher values, it samples from a wider distribution — more creative, less predictable, sometimes wrong.',
 'Set temperature to 0 when you want the same answer every run.',
 'When you see API docs talking about "temperature: 0.7" that is the model''s creativity dial. Useful when explaining why the same prompt can produce different answers each time, or when you want deterministic output for code and decisions.',
 ARRAY['aid-model']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'How fast the model can respond to requests',
   'A measurement of how much electricity the model uses',
   'The size of the training dataset in gigabytes'
 ]::text[],
 'Set ___ to 0 when you want the same answer every run.',
 'Use ''temperature'' in a sentence about why the same prompt gave different answers.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-tools (+2) ──────────────────────────────────────────────
('aid-chatbot', 'chatbot', null, 'ai-tools', 'ai', 1,
 'An app where you type messages and an AI types back — the original AI product shape.',
 'Chatbots are the conversational UI for AI: a text box, a send button, a stream of replies. ChatGPT and Claude.ai are the canonical examples. Chatbots are easy to use but limit AI to a back-and-forth chat — no taking actions, no using tools.',
 'I open a chatbot tab when I am just thinking out loud.',
 'Most people''s first AI experience is a chatbot. Knowing the term separates "chatbot" (chat-only AI) from "agent" (AI that takes action) — different product categories.',
 ARRAY['aid-agent']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A small physical robot used in customer service',
   'An AI training method that uses only chat data',
   'A scripted reply system from before LLMs'
 ]::text[],
 'I open a ___ tab when I am just thinking out loud.',
 'Use ''chatbot'' in a sentence about how you use AI for everyday questions.',
 'curated', 'curator', '2026-05-06'),

('aid-copilot', 'copilot', null, 'ai-tools', 'ai', 2,
 'An AI that suggests as you work — completing your code, writing your email, finishing your sentence.',
 'Copilots sit alongside you in another tool (your code editor, your email app, your spreadsheet) and suggest the next thing you might want. You pick or skip. GitHub Copilot is the original; Microsoft Copilot, Cursor, and most modern editors have one. Different from a chatbot because the AI is embedded IN the work, not in a separate chat window.',
 'The copilot finished the function before I had finished thinking.',
 'When people say "AI is in everything now," they often mean copilots — the AI you do not open, you just see it suggesting in apps you already use. Knowing the word makes a lot of product launches make sense.',
 ARRAY['aid-model','aid-chatbot']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A second human teammate who reviews your work',
   'A backup AI that runs when the main one fails',
   'A feature for sharing AI conversations with others'
 ]::text[],
 'The ___ finished the function before I had finished thinking.',
 'Use ''copilot'' in a sentence about an AI that suggests inside an app you use.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-prompting (+2) ──────────────────────────────────────────
('aid-few-shot', 'few-shot', null, 'ai-prompting', 'ai', 2,
 'Showing the AI 2-3 worked examples inside your prompt so it copies the pattern.',
 'Few-shot prompting means including a few examples of input then output in your prompt before asking for the new one. The AI patterns off the examples and produces output in the same shape. "Zero-shot" is no examples; "few-shot" is 2-3; more than that and you are approaching fine-tuning territory.',
 'I gave it three sample resumes and asked for a fourth — few-shot got the format right immediately.',
 'Few-shot is the cheapest way to teach an AI a specific format or style without changing the model. When you want consistent output, examples beat instructions every time.',
 ARRAY['aid-prompt','aid-fine-tuning']::text[],
 ARRAY['aid-prompt']::text[],
 null,
 ARRAY[
   'A prompt limited to a few sentences total',
   'A way to send the same prompt to multiple models at once',
   'A safety rule that limits how often you can prompt the AI'
 ]::text[],
 'I gave it three sample resumes and asked for a fourth — ___ got the format right immediately.',
 'Use ''few-shot'' in a sentence about teaching the AI a format with examples.',
 'curated', 'curator', '2026-05-06'),

('aid-chain-of-thought', 'chain of thought', null, 'ai-prompting', 'ai', 2,
 'Asking the AI to show its reasoning step by step before answering — usually gets a more accurate answer.',
 'Chain of thought is when you tell the model to "think step by step" or show its work. The model writes out the intermediate reasoning before the final answer. Counterintuitively, this actually makes answers MORE accurate — the model uses its own written-out steps as scratch space.',
 'Adding "think step by step" fixed the math errors — it caught its own mistake.',
 'When an AI gets a tricky question wrong, asking for chain of thought is the cheapest fix you can try. It is also why thinking-mode and reasoning-mode features exist in newer models — they bake chain of thought in by default.',
 ARRAY['aid-prompt']::text[],
 ARRAY['aid-prompt']::text[],
 null,
 ARRAY[
   'A way of linking multiple chatbot conversations together',
   'An AI that explains its training process to the user',
   'A method for compressing prompts to save tokens'
 ]::text[],
 'Adding "think step by step" fixed the math errors — ___ caught its own mistake.',
 'Use ''chain of thought'' in a sentence about getting better math answers from AI.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-products (+2) ───────────────────────────────────────────
('aid-fine-tuning', 'fine-tuning', null, 'ai-products', 'ai', 3,
 'Continuing to train a base model on your own data so it learns your style or domain.',
 'Fine-tuning takes an existing trained model and exposes it to a smaller, focused dataset (your support tickets, your tone of voice, your domain documents). The model adjusts its weights to better match your data. More expensive than RAG but produces a model that "knows" your domain even when not given context.',
 'We fine-tuned the model on 10,000 of our past support replies so it sounds like our team.',
 'When RAG is not enough — when you need the AI to think LIKE your team, not just look up your docs — fine-tuning is the next lever. Knowing the difference is what lets you reason about which approach fits which problem.',
 ARRAY['aid-model','aid-rag']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A small adjustment to your prompt wording',
   'Selecting which sub-model to use within a model family',
   'A user feedback feature for rating AI responses'
 ]::text[],
 'We ___ the model on 10,000 of our past support replies so it sounds like our team.',
 'Use ''fine-tuning'' in a sentence about teaching an AI your team''s tone.',
 'curated', 'curator', '2026-05-06'),

('aid-tool-call', 'tool call', null, 'ai-products', 'ai', 3,
 'When the AI says "I need to use this service" and the system runs the request for it.',
 'Modern AI does not have to know everything — it can call tools (a calculator, a database, a service, your codebase) when it needs information or wants to take an action. The model emits a structured "tool call" request; the runtime fulfills it; the result feeds back into the model''s reasoning. This is the mechanism that turns chatbots into agents.',
 'The agent made three tool calls: read the file, ran the tests, then opened a fix.',
 'When you hear "AI is becoming agentic," tool calls are how. Without them the model can only output text; with them the model can read your data, run your scripts, send your messages.',
 ARRAY['aid-agent']::text[],
 ARRAY['aid-agent','aid-prompt']::text[],
 null,
 ARRAY[
   'A phone-call feature inside an AI chatbot',
   'A bug reporting button in an AI app',
   'A way of grouping similar prompts together'
 ]::text[],
 'The agent made three ___s: read the file, ran the tests, then opened a fix.',
 'Use ''tool call'' in a sentence about an AI doing real work, not just talking.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-evaluation (+2) ─────────────────────────────────────────
('aid-grounding', 'grounding', null, 'ai-evaluation', 'ai', 3,
 'Forcing the AI to cite real sources so its answers can be checked — the antidote to hallucination.',
 'Grounding means tying every claim the model makes to a specific source the model was actually shown. RAG systems do this by retrieving documents and asking the model to cite them. Well-grounded answers come with link or quote anchors; ungrounded answers are just the model''s general impressions.',
 'The bot is grounded in the help center — every answer ends with a citation.',
 'Grounding is what separates "AI that helps you research" from "AI that confidently lies." When you read product docs and they brag about "grounded answers," they mean: this AI cites real sources you can verify.',
 ARRAY['aid-hallucination','aid-rag']::text[],
 ARRAY['aid-hallucination']::text[],
 null,
 ARRAY[
   'A safety setting that limits AI to certain topics',
   'A feature that records every AI conversation for audit',
   'A way of slowing down AI responses to feel more natural'
 ]::text[],
 'The bot is ___ in the help center — every answer ends with a citation.',
 'Use ''grounding'' in a sentence about an AI that cites real sources.',
 'curated', 'curator', '2026-05-06'),

('aid-benchmark', 'benchmark', null, 'ai-evaluation', 'ai', 3,
 'A standardized test score that lets you compare different AI models on the same task.',
 'Benchmarks are fixed test suites — sets of prompts with known correct answers — that anyone can run against any model. The scores let you compare apples-to-apples: how well does GPT-5 do on this math benchmark vs Claude vs Gemini? Common benchmarks include MMLU (general knowledge), HumanEval (coding), and GPQA (graduate-level questions).',
 'The new model beats GPT-5 on MMLU but loses on coding benchmarks.',
 'Every model launch is announced with benchmark numbers. Knowing what a benchmark IS lets you read launch posts critically — and notice when a model claims a top score on a benchmark its competitors were not tested on.',
 ARRAY['aid-model']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'The minimum hardware required to run a model',
   'A way of measuring how fast an AI can type',
   'The cost in dollars of training a single model'
 ]::text[],
 'The new model beats GPT-5 on MMLU but loses on coding ___s.',
 'Use ''benchmark'' in a sentence about comparing two AI models.',
 'curated', 'curator', '2026-05-06'),

-- ─── ai-policy (+3 — first content for this path) ──────────────
('aid-alignment', 'alignment', null, 'ai-policy', 'ai', 3,
 'Making sure AI does what humans actually want — and does not go off in unexpected directions.',
 'Alignment is the engineering and research effort to make AI helpful and safe in line with human values. It includes everything from teaching the model to refuse harmful requests, to steering it away from deceptive behavior, to ensuring it tells the truth instead of telling people what they want to hear. Anthropic''s name comes from "AI safety / alignment."',
 'Alignment training is why the model will not help you build a weapon, even if you really want it to.',
 'The conversation about AI safety and risk is mostly an alignment conversation. When researchers talk about "aligned" or "misaligned" AI, this is what they mean — does the AI''s actual behavior match what its designers intended.',
 ARRAY['aid-model','aid-safety']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'Adjusting the AI''s output to match a specific writing style',
   'Synchronizing two AI models so they give the same answer',
   'A formatting rule that keeps AI responses left-justified'
 ]::text[],
 '___ training is why the model will not help you build a weapon, even if you really want it to.',
 'Use ''alignment'' in a sentence about why an AI refuses a harmful request.',
 'curated', 'curator', '2026-05-06'),

('aid-agi', 'AGI', 'A-G-I (artificial general intelligence)', 'ai-policy', 'ai', 3,
 'Artificial general intelligence — an AI as flexible and capable as a human across any task.',
 'AGI is the hypothetical AI that can do anything a human can do — reason, learn new fields, switch tasks, plan ahead, all without specialized training. Today''s models are narrow AI: very good at language, but they do not have continuous memory, body, or general agency. AGI is the line where this changes. Whether we are close, far, or already there depends entirely on how you define "general."',
 'The CEO claims they are 5 years from AGI; researchers in the field are split between agreeing and laughing.',
 'Most AI strategy and policy debates orbit around AGI: when does it arrive, who builds it, what happens after. Knowing the term lets you parse the debate even if no one agrees on the definition.',
 ARRAY['aid-model','aid-alignment']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A specific brand of AI sold by Anthropic',
   'The standard test for evaluating any new AI model',
   'A coding language used to build AI systems'
 ]::text[],
 'The CEO claims they are 5 years from ___; researchers are split between agreeing and laughing.',
 'Use ''AGI'' in a sentence about the long-term trajectory of AI capability.',
 'curated', 'curator', '2026-05-06'),

('aid-safety', 'safety', null, 'ai-policy', 'ai', 2,
 'Preventing AI systems from causing real-world harm — a research field, not just a slogan.',
 'AI safety is the field focused on ensuring AI systems do not cause harm — whether by accident (misaligned goals, hallucinated medical advice), by misuse (deepfakes, automated scams), or by structural failure (bias, privacy violation). Safety teams write evaluation suites, design model guardrails, and study failure modes BEFORE models ship widely.',
 'The safety team caught the model''s tendency to encourage risky behavior before launch.',
 'When a company says they "prioritize safety" or "invest in safety research," this is what they mean — concrete engineering work to find and prevent specific failure modes, not just marketing posture.',
 ARRAY['aid-model','aid-alignment']::text[],
 ARRAY['aid-model']::text[],
 null,
 ARRAY[
   'A privacy setting that hides your prompts from training data',
   'A backup plan in case the AI service goes offline',
   'The encryption used to protect API keys in transit'
 ]::text[],
 'The ___ team caught the model''s tendency to encourage risky behavior before launch.',
 'Use ''safety'' in a sentence about catching an AI failure mode before launch.',
 'curated', 'curator', '2026-05-06')

on conflict (id) do nothing;
