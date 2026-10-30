-- Jargon Stage B3 — 27 more curated anchor terms for the ai-ml path
-- All difficulty 1, all curated, reviewed by the curator on 2026-05-04.
-- Voice matches the existing 3 ai-ml anchors (ai-llm / ai-rag / ai-embedding
-- template) — translator-not-professor: name what the thing IS in plain
-- English, ground "why_it_matters" in (a) following Claude Code or (b)
-- talking to dev family who throw these terms at the owner daily.
--
-- Idempotent: `on conflict (id) do nothing` so re-runs don't fail and don't
-- overwrite anything an upstream cloud migration already inserted.
--
-- Dictionary count after this migration:
--   ai-ml: 3 → 30  (3 existing + 27 new)
--   total: 129 → 156
--
-- Distractor strategy: each row's three distractors describe OTHER AI/ML
-- concepts (or adjacent dev tooling) so a half-knowledgeable learner gets
-- tricked. For example, ai-fine-tuning's distractors describe RAG, prompt
-- engineering, and distillation — same neighborhood, distinct concepts.
--
-- Cross-references: every related_terms / prerequisites / stretch_term id
-- resolves to one of the existing 129 anchors or one of these 27. Rich
-- internal cross-linking inside the path:
--   • ai-llm ↔ ai-model ↔ ai-parameters (the model family)
--   • ai-prompt ↔ ai-completion ↔ ai-system-prompt ↔ ai-temperature (input/output mechanics)
--   • ai-vector ↔ ai-embedding ↔ ai-vector-db ↔ ai-rag (semantic search family)
--   • ai-fine-tuning ↔ ai-training ↔ ai-inference ↔ ai-distillation (model lifecycle family)
--   • ai-hallucination ↔ ai-grounding (the trust pair)
--   • ai-agent ↔ ai-function-calling ↔ cc-agent ↔ cc-tool-use (cross-path agent family)
--   • ai-chain-of-thought ↔ ai-few-shot ↔ ai-zero-shot (prompting techniques family)
--   • ai-attention → ai-transformer (attention is the building block of transformers)
--   • ai-eval ↔ ai-benchmark (measurement family)
--   • ai-open-weights ↔ ai-llm ↔ ai-multimodal (model-types family)
--
-- Cross-path notes:
--   • ai-system-prompt is the GENERAL concept; cc-system-prompt is Claude Code's specific instance.
--   • ai-agent is the GENERAL agent loop; cc-agent is Claude Code's specialized subagent.

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── ai-ml: model family (3) ───────────────────────────────────
('ai-model', 'model', null, 'ai-ml', 1,
 'A trained AI system that takes input and produces output — Claude, GPT, and Gemini are all models.',
 'A model is the actual artifact you talk to: weights baked from a training run, packaged so you can send it a prompt and get a response. When someone says "which model are you using?" they mean which specific brain — Opus 4.7, Sonnet 4.5, GPT-5, etc. Different models trade speed, cost, and intelligence in different mixes.',
 'I''m switching the agent over to a smaller model — Sonnet should be plenty for this batch.',
 'Every Claude Code session you run starts by picking a model. Knowing the term means when your dev family asks "what model do you use for that?" you understand they''re asking which specific brain, not which company.',
 ARRAY['ai-llm','ai-parameters','ai-inference']::text[],
 ARRAY['ai-llm']::text[],
 'ai-parameters',
 ARRAY[
   'A diagram showing how data flows through a system',
   'A mock dataset used for testing an app',
   'A blueprint a designer uses to lay out a UI'
 ]::text[],
 'I''m switching the agent over to a smaller ___ — Sonnet should be plenty for this batch.',
 'Use ''model'' in a sentence about choosing which AI to send a task to.',
 'curated', 'curator', '2026-05-04'),

('ai-parameters', 'parameters / weights', null, 'ai-ml', 1,
 'The billions of numbers inside a model that got tuned during training — the actual "knowledge" of the AI.',
 'When people say a model has "70 billion parameters," they mean it has 70 billion numbers inside it that were nudged into shape during training. Those numbers are the model''s memory of patterns, facts, and language. Bigger parameter counts usually mean smarter models, but also slower and more expensive ones.',
 'Llama 3 70B has roughly 70 billion parameters — that''s where the "70B" in the name comes from.',
 'Every "what size is that model?" comparison is really a parameter-count comparison. Knowing the term means when your dev family says "the 8B is fine for this," you understand they''re talking about the actual numerical size of the brain.',
 ARRAY['ai-model','ai-training','ai-llm']::text[],
 ARRAY['ai-model']::text[],
 'ai-distillation',
 ARRAY[
   'The settings you pass to a function when you call it',
   'The configuration values stored in an env file',
   'The arguments a CLI command accepts'
 ]::text[],
 'Llama 3 70B has roughly 70 billion ___ — that''s where the "70B" in the name comes from.',
 'Use ''parameters'' or ''weights'' in a sentence about how big or small an AI model is.',
 'curated', 'curator', '2026-05-04'),

('ai-inference', 'inference', null, 'ai-ml', 1,
 'The act of actually USING a trained model to get an answer — what happens every time you send Claude a message.',
 'Inference is the runtime side of AI: the model is already trained, you send it input, it produces output. Every message you send to Claude Code triggers an inference call on Anthropic''s servers. Training happens once (and costs millions); inference happens every single request (and costs pennies). The two phases use the same model but very different compute setups.',
 'Inference on the big model is slower — that''s why streaming the response feels gradual.',
 'When devs say "inference is expensive at scale" or "we''re optimizing inference latency," they mean every-request runtime cost. Knowing the term separates "training the model" from "calling the model" — two completely different jobs.',
 ARRAY['ai-training','ai-model','cc-token']::text[],
 ARRAY['ai-model']::text[],
 'ai-fine-tuning',
 ARRAY[
   'The process of teaching a model from scratch on raw data',
   'Adjusting a trained model with extra examples',
   'Compressing a large model into a smaller one'
 ]::text[],
 '___ on the big model is slower — that''s why streaming the response feels gradual.',
 'Use ''inference'' in a sentence about actually running a trained model to get an answer.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: input/output mechanics (4) ─────────────────────────
('ai-prompt', 'prompt', null, 'ai-ml', 1,
 'Whatever text you send into an LLM — the question, instruction, or context that triggers a response.',
 'A prompt is the input side of the conversation. It can be a single sentence ("explain RAG to me") or a giant blob (system instructions + chat history + a file Claude just read + your latest message). The model reads the entire prompt and produces a completion. Prompt quality is most of what makes AI feel smart or dumb.',
 'I rewrote the prompt three times before the model finally returned clean JSON.',
 'When dev family says "your prompt is doing too much" or a podcast says "prompt engineering," they mean exactly this — the input you craft. Knowing the term lets you talk about the lever you can actually pull when an AI gives you a bad answer.',
 ARRAY['ai-completion','ai-system-prompt','ai-few-shot']::text[],
 ARRAY['ai-llm']::text[],
 'ai-system-prompt',
 ARRAY[
   'The output an LLM produces in response to input',
   'A login screen asking the user for credentials',
   'A pop-up notification on a phone'
 ]::text[],
 'I rewrote the ___ three times before the model finally returned clean JSON.',
 'Use ''prompt'' in a sentence about the input you send to an LLM.',
 'curated', 'curator', '2026-05-04'),

('ai-completion', 'completion / response', null, 'ai-ml', 1,
 'What the model gives you back after reading your prompt — the answer, the generated text, the AI''s reply.',
 'Completion is the output side. The historical name comes from the original GPT API — "complete this text for me" — and stuck even though modern models do far more than autocomplete. Today "completion" and "response" are interchangeable: the chunk of text (or tool call, or JSON) the model produces in answer to a prompt.',
 'The completion came back truncated — looks like we hit the max-tokens limit.',
 'When devs say "the completion is bad" or "we''re streaming completions to the UI," they mean the AI''s output. Knowing the term means you can talk specifically about the answer side instead of vaguely about "what the AI did."',
 ARRAY['ai-prompt','ai-temperature','cc-token']::text[],
 ARRAY['ai-prompt']::text[],
 null,
 ARRAY[
   'The text the user types into the chat box',
   'A finished product shipped to customers',
   'A confirmation that a task was completed in a todo app'
 ]::text[],
 'The ___ came back truncated — looks like we hit the max-tokens limit.',
 'Use ''completion'' or ''response'' in a sentence about the text an LLM produces.',
 'curated', 'curator', '2026-05-04'),

('ai-system-prompt', 'system prompt', null, 'ai-ml', 1,
 'A special instruction baked into the start of the prompt that sets the model''s identity, role, and rules.',
 'Every modern LLM API has a slot called "system" that comes before the user''s message — that''s where you tell the model who it is, how to behave, what rules to follow. Claude Code''s system prompt is enormous (tools, CLAUDE.md, behavioral rules); a chatbot''s might be one sentence. The model treats the system prompt as higher-priority than user messages.',
 'I added one line to the system prompt and the responses got 10x more on-brand.',
 'Cross-path with cc-system-prompt — that''s Claude Code''s specific giant instance. The general concept matters because every AI app you build (or hear about) has one. Knowing the term means you understand where "personality" actually lives.',
 ARRAY['ai-prompt','ai-completion','cc-system-prompt']::text[],
 ARRAY['ai-prompt']::text[],
 'cc-system-prompt',
 ARRAY[
   'The first message a user types in a conversation',
   'A configuration file for a deployment',
   'A markdown doc explaining how to use a project'
 ]::text[],
 'I added one line to the ___ and the responses got 10x more on-brand.',
 'Use ''system prompt'' in a sentence about setting an LLM''s rules or persona.',
 'curated', 'curator', '2026-05-04'),

('ai-temperature', 'temperature', null, 'ai-ml', 1,
 'A knob between 0 and 1 (or 2) that controls how much the model improvises vs. plays it safe.',
 'Temperature 0 = same input gives the same answer every time, the model picks the most likely next word. Temperature 1 = the model rolls the dice more, picks less-likely words sometimes, gets creative. For code or facts you want low temperature. For brainstorming or creative writing you crank it up. Most APIs default around 0.7.',
 'Drop the temperature to 0 for the JSON-output call — we want deterministic results.',
 'When devs say "set temp to zero" they mean exactly this dial. Knowing the term means you can shape AI output yourself — locking it down for facts, loosening it for ideas — instead of just hoping the model behaves.',
 ARRAY['ai-prompt','ai-completion','ai-inference']::text[],
 ARRAY['ai-completion']::text[],
 null,
 ARRAY[
   'The number of tokens the model is allowed to generate',
   'How many GPUs are running the model in parallel',
   'A timeout setting that kills slow requests'
 ]::text[],
 'Drop the ___ to 0 for the JSON-output call — we want deterministic results.',
 'Use ''temperature'' in a sentence about tuning how creative or strict an AI''s answers are.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: vectors & semantic search (2) ──────────────────────
('ai-vector', 'vector', null, 'ai-ml', 1,
 'A long list of numbers that represents something — a piece of text, an image, a sound — in a way computers can compare.',
 'A vector in AI is just an array of numbers, often hundreds or thousands long, that encodes meaning. Two vectors that are "close" in numerical space mean two similar things. It''s the underlying data type for embeddings, for image search, for recommendation systems — anywhere a computer needs to compare meanings.',
 'Each note gets converted to a vector — 1,536 numbers — so we can compare them by meaning.',
 'Whenever embedding, RAG, or vector database comes up, the underlying object is this. Knowing the term means when family says "we store vectors for every doc," you understand they''re storing arrays of numbers, not the docs themselves.',
 ARRAY['ai-embedding','ai-vector-db','ai-rag']::text[],
 ARRAY['ai-llm']::text[],
 'ai-embedding',
 ARRAY[
   'A type of branch in version control',
   'A drawing made of lines instead of pixels',
   'A unit of memory on a graphics card'
 ]::text[],
 'Each note gets converted to a ___ — 1,536 numbers — so we can compare them by meaning.',
 'Use ''vector'' in a sentence about representing meaning as numbers.',
 'curated', 'curator', '2026-05-04'),

('ai-vector-db', 'vector database', null, 'ai-ml', 1,
 'A database built specifically to store millions of vectors and find the closest matches fast.',
 'Regular databases are great at "find rows where email = X." Vector databases are great at "find rows whose vector is closest to this one." Pinecone, Weaviate, Qdrant, pgvector are all vector databases. They''re the storage layer underneath every RAG system, semantic search, and "find similar items" feature.',
 'We moved the embeddings into a vector database so search latency dropped from seconds to milliseconds.',
 'When dev family says "we''re using pgvector" or "we spun up a Pinecone instance," it''s a vector database. Knowing the term lets you understand the storage half of every RAG conversation, not just the "ask the LLM" half.',
 ARRAY['ai-vector','ai-embedding','ai-rag']::text[],
 ARRAY['ai-vector','ai-embedding']::text[],
 null,
 ARRAY[
   'A traditional SQL database storing customer records',
   'A spreadsheet of training examples',
   'A cache of recent API responses'
 ]::text[],
 'We moved the embeddings into a ___ so search latency dropped from seconds to milliseconds.',
 'Use ''vector database'' in a sentence about storing embeddings for semantic search.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: model lifecycle (3) ────────────────────────────────
('ai-training', 'training', null, 'ai-ml', 1,
 'The expensive, one-time process of building a model from scratch by feeding it huge amounts of data.',
 'Training is where the model''s parameters get their values. Researchers feed billions of words (or images, or both) into the system, repeatedly nudging the parameters until the model gets good at predicting whatever it''s being trained for. A frontier model''s training run can cost tens of millions of dollars and take months on thousands of GPUs.',
 'Training the next-gen model took six months and a small power plant''s worth of compute.',
 'Knowing the term means you understand why "the model''s training cutoff is January 2026" matters — it can''t know about anything that happened after training ended. Inference happens daily; training happens once.',
 ARRAY['ai-inference','ai-fine-tuning','ai-parameters']::text[],
 ARRAY['ai-model']::text[],
 'ai-fine-tuning',
 ARRAY[
   'Running a trained model to get an answer',
   'Compressing a big model into a small one',
   'Looking up information in an external database'
 ]::text[],
 '___ the next-gen model took six months and a small power plant''s worth of compute.',
 'Use ''training'' in a sentence about how an AI model gets built in the first place.',
 'curated', 'curator', '2026-05-04'),

('ai-fine-tuning', 'fine-tuning', null, 'ai-ml', 1,
 'Taking an already-trained model and nudging it with extra examples so it gets better at one specific job.',
 'Fine-tuning is "training, but small." You start with a pre-trained model, feed it a few thousand examples of the exact behavior you want (medical Q&A, your company''s tone, classifying support tickets), and update the parameters slightly. The model keeps everything it knew and gets sharper on your specific task. Cheaper and faster than training from scratch.',
 'We fine-tuned a small open-weights model for the customer-service workflow.',
 'When dev family says "we fine-tuned Llama for our use case," they mean exactly this. Knowing the term separates fine-tuning (modify the model) from RAG (give the model docs at runtime) — same goal, different mechanism.',
 ARRAY['ai-training','ai-rag','ai-model']::text[],
 ARRAY['ai-training']::text[],
 'ai-distillation',
 ARRAY[
   'Adding documents to a prompt at runtime so the model can cite them',
   'Writing better instructions in the system prompt',
   'Compressing a big model into a smaller one for cheaper inference'
 ]::text[],
 'We ___ a small open-weights model for the customer-service workflow.',
 'Use ''fine-tuning'' in a sentence about adapting an existing model for a specific task.',
 'curated', 'curator', '2026-05-04'),

('ai-distillation', 'distillation', null, 'ai-ml', 1,
 'Training a smaller, cheaper model to copy the behavior of a bigger, smarter one.',
 'In distillation, the big model (the "teacher") generates lots of answers, and a smaller model (the "student") gets trained to produce the same answers. The student ends up much faster and cheaper than the teacher, while keeping most of the smarts on the specific tasks you distilled. Most "small but capable" models you hear about — Haiku, mini, lite — are distilled from larger siblings.',
 'Haiku is essentially distilled from a larger Claude — same vibe, fraction of the cost.',
 'When dev family says "they distilled the big one down to a 7B," they mean this exact process. Knowing the term means you understand why some small models punch above their weight class.',
 ARRAY['ai-fine-tuning','ai-training','ai-model']::text[],
 ARRAY['ai-training']::text[],
 null,
 ARRAY[
   'Removing duplicates from a training dataset',
   'Filtering offensive content out of model outputs',
   'Splitting a long prompt into smaller chunks'
 ]::text[],
 'Haiku is essentially ___ from a larger Claude — same vibe, fraction of the cost.',
 'Use ''distillation'' in a sentence about training a small model to copy a big one.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: trust & accuracy (2) ───────────────────────────────
('ai-hallucination', 'hallucination', null, 'ai-ml', 1,
 'When an LLM confidently makes something up that sounds true but isn''t — a fake citation, a wrong fact, a non-existent function.',
 'LLMs predict plausible-sounding next words; sometimes the most plausible-sounding thing is wrong. The model isn''t lying — it has no concept of truth, just statistical likelihood. Hallucinations are the #1 reason production AI apps need guardrails: a hallucinated drug dose or legal citation can do real damage.',
 'The model started hallucinating function names that don''t exist in the library.',
 'Every dev family conversation about "why we don''t trust the LLM blindly" comes back to hallucinations. Knowing the term means you can name the failure mode instead of just calling it "wrong."',
 ARRAY['ai-grounding','ai-rag','ai-eval']::text[],
 ARRAY['ai-llm']::text[],
 'ai-grounding',
 ARRAY[
   'A model returning a response slower than expected',
   'A model refusing to answer a question for safety reasons',
   'A model running out of context window mid-answer'
 ]::text[],
 'The model started ___ function names that don''t exist in the library.',
 'Use ''hallucination'' in a sentence about an LLM making something up.',
 'curated', 'curator', '2026-05-04'),

('ai-grounding', 'grounding', null, 'ai-ml', 1,
 'Giving the model real source material in the prompt so its answer is anchored in facts, not its memory.',
 'Grounding means feeding the model the actual document, database row, or search result it should base its answer on — instead of trusting it to remember. RAG is the most common grounding pattern: retrieve relevant chunks first, then ask the LLM to answer from them. Grounded answers can cite sources; ungrounded ones are guesses dressed up as facts.',
 'Grounding the answer in the actual policy doc cut hallucinations to almost zero.',
 'When dev family says "we ground the model in the customer''s data," this is what they mean. Knowing the term gives you the opposite of hallucination — the engineering technique people actually reach for to fix it.',
 ARRAY['ai-hallucination','ai-rag','ai-prompt']::text[],
 ARRAY['ai-hallucination']::text[],
 'ai-rag',
 ARRAY[
   'Lowering the temperature to zero for deterministic output',
   'Running the model on more powerful GPUs',
   'Switching to a larger model with more parameters'
 ]::text[],
 '___ the answer in the actual policy doc cut hallucinations to almost zero.',
 'Use ''grounding'' in a sentence about anchoring an LLM''s answer in real source material.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: agents & tool use (2) ──────────────────────────────
('ai-agent', 'agent', null, 'ai-ml', 1,
 'An LLM hooked up to tools and a planning loop so it can take actions, not just chat.',
 'A chat AI just talks back. An agent reads your goal, decides what to do, calls a tool (search the web, run code, send an email), reads the result, decides what to do next, and keeps looping until the job is done. Claude Code is an agent. So is any "AI does the thing for you" product. The pattern is LLM + tools + loop.',
 'The agent worked through 30 tool calls before it finished the refactor.',
 'Cross-path with cc-agent — Claude Code calls its specialized helpers "agents" too. The general concept matters because the whole industry is shifting from chatbots to agents. Knowing the term means you can follow that conversation.',
 ARRAY['ai-function-calling','cc-agent','cc-tool-use']::text[],
 ARRAY['ai-llm']::text[],
 'cc-agent',
 ARRAY[
   'An employee at an AI company who handles support tickets',
   'A user account in a SaaS product',
   'A type of LLM trained specifically for coding'
 ]::text[],
 'The ___ worked through 30 tool calls before it finished the refactor.',
 'Use ''agent'' in a sentence about an LLM that takes actions, not just answers questions.',
 'curated', 'curator', '2026-05-04'),

('ai-function-calling', 'function calling / tool use', null, 'ai-ml', 1,
 'A feature where the LLM can decide to invoke a function you provided instead of just replying with text.',
 'Function calling (a.k.a. tool use) is what makes agents possible. You describe a set of functions to the model — "search_docs takes a query, returns matches" — and the model can choose to call one in the middle of its response. The function runs, returns a result, the model reads it and continues. Every Claude Code tool call is one of these.',
 'I added function calling for the database query so the model could fetch live data.',
 'Cross-path with cc-tool-use — Claude Code''s tool calls are exactly this mechanism. Knowing the general term means you can follow any AI-engineering conversation, not just Claude Code-specific ones.',
 ARRAY['ai-agent','cc-tool-use','cc-bash-tool']::text[],
 ARRAY['ai-llm']::text[],
 'ai-agent',
 ARRAY[
   'A model invoking another model to double-check its work',
   'A user typing a slash command into a chat',
   'A scheduled job that runs an AI task at a fixed time'
 ]::text[],
 'I added ___ for the database query so the model could fetch live data.',
 'Use ''function calling'' or ''tool use'' in a sentence about an LLM invoking code instead of just replying.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: prompting techniques (3) ───────────────────────────
('ai-chain-of-thought', 'chain of thought (CoT)', 'C-o-T', 'ai-ml', 1,
 'A prompting technique where you ask the model to think step-by-step before answering — accuracy goes up.',
 'Chain of thought means literally saying "think through this step by step" or showing the model an example that reasons out loud. The model spends extra tokens working through intermediate steps and gets the right answer more often, especially on math and logic problems. It''s the simplest prompt technique that actually moves benchmarks.',
 'Adding "think step by step" to the prompt was a chain-of-thought trick — accuracy jumped 12%.',
 'When dev family says "use CoT for the math reasoning step," this is what they mean. Knowing the term means you can name the most reliable accuracy-bump technique in modern prompting.',
 ARRAY['ai-few-shot','ai-zero-shot','ai-prompt']::text[],
 ARRAY['ai-prompt']::text[],
 'ai-few-shot',
 ARRAY[
   'A pattern where the model retrieves docs before answering',
   'A way to combine multiple models into one ensemble',
   'A technique for compressing model parameters'
 ]::text[],
 'Adding "think step by step" to the prompt was a ___ trick — accuracy jumped 12%.',
 'Use ''chain of thought'' or ''CoT'' in a sentence about asking an LLM to reason step-by-step.',
 'curated', 'curator', '2026-05-04'),

('ai-few-shot', 'few-shot', null, 'ai-ml', 1,
 'Showing the model a handful of input-output examples in the prompt so it gets what you want.',
 'Few-shot prompting means including examples directly in the prompt — "here''s a sentence and the right tag, here''s another sentence and the right tag, now do this one." The model patterns-matches on your examples and produces output in the same shape. Three to five examples is usually the sweet spot. The opposite is zero-shot: just asking, no examples.',
 'I gave the model a few-shot prompt with three labeled examples and the classification got way more consistent.',
 'When dev family says "throw a few-shot in the prompt," they mean show examples. Knowing the term means you have a tool for fixing inconsistent AI outputs without fine-tuning anything.',
 ARRAY['ai-zero-shot','ai-chain-of-thought','ai-prompt']::text[],
 ARRAY['ai-prompt']::text[],
 null,
 ARRAY[
   'Asking the model with no examples at all',
   'Training a model on a small dataset',
   'A prompt that retrieves docs from a knowledge base'
 ]::text[],
 'I gave the model a ___ prompt with three labeled examples and the classification got way more consistent.',
 'Use ''few-shot'' in a sentence about teaching a model with a few examples in the prompt.',
 'curated', 'curator', '2026-05-04'),

('ai-zero-shot', 'zero-shot', null, 'ai-ml', 1,
 'Asking the model to do something with no examples — just the instruction.',
 'Zero-shot is the default mode of prompting: write what you want, the model does it. "Translate this to French." "Summarize this article." No examples, no demonstrations, just the ask. Modern frontier models are surprisingly good zero-shot, which is why simple prompts often just work — but few-shot still helps when output shape matters.',
 'Zero-shot worked fine for the summary, but for the JSON I needed a few-shot example to lock the format.',
 'When dev family says "the model is a zero-shot classifier now," they mean no training, no examples — just ask. Knowing the term means you can describe the simplest baseline before reaching for fancier techniques.',
 ARRAY['ai-few-shot','ai-chain-of-thought','ai-prompt']::text[],
 ARRAY['ai-prompt']::text[],
 'ai-few-shot',
 ARRAY[
   'A model with zero parameters fine-tuned',
   'A prompt that includes one example for the model to follow',
   'An evaluation metric that scores model accuracy'
 ]::text[],
 '___ worked fine for the summary, but for the JSON I needed a few-shot example to lock the format.',
 'Use ''zero-shot'' in a sentence about asking an AI something without giving it examples.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: data & evaluation (3) ──────────────────────────────
('ai-dataset', 'dataset', null, 'ai-ml', 1,
 'A curated collection of examples used to train, fine-tune, or evaluate an AI model.',
 'A dataset is just a structured pile of examples — text-and-label pairs, image-and-caption pairs, prompt-and-ideal-response pairs. Training a model means feeding it a dataset; evaluating one means scoring it on a held-out dataset. The quality of the dataset is usually the ceiling on the model''s quality — garbage in, garbage out.',
 'We curated a 500-example dataset of pharmacist questions to evaluate the medical chatbot.',
 'When dev family says "the dataset is the moat" or "we''re open-sourcing the dataset," they mean this curated pile. Knowing the term means you understand what actually shapes a model — the examples it learned from.',
 ARRAY['ai-training','ai-fine-tuning','ai-benchmark']::text[],
 ARRAY['ai-training']::text[],
 'ai-benchmark',
 ARRAY[
   'A trained model packaged for download',
   'A live database of user interactions',
   'A spreadsheet of API rate limits'
 ]::text[],
 'We curated a 500-example ___ of pharmacist questions to evaluate the medical chatbot.',
 'Use ''dataset'' in a sentence about a collection of examples used in AI work.',
 'curated', 'curator', '2026-05-04'),

('ai-benchmark', 'benchmark', null, 'ai-ml', 1,
 'A standardized test that scores AI models on a fixed task so you can compare them apples-to-apples.',
 'Benchmarks are how the AI industry compares models. MMLU tests broad knowledge, HumanEval tests code, GPQA tests grad-level reasoning, SWE-bench tests fixing real GitHub issues. Each benchmark has a fixed dataset and a scoring rule, so when a press release says "75% on SWE-bench," you can compare it to last year''s 30%.',
 'The new model jumped from 50% to 72% on SWE-bench — that''s a huge benchmark leap.',
 'Every "model X is better than model Y" tweet is grounded in benchmark numbers. Knowing the term means you can read those comparisons critically instead of taking the percentage at face value.',
 ARRAY['ai-eval','ai-dataset','ai-model']::text[],
 ARRAY['ai-model']::text[],
 'ai-eval',
 ARRAY[
   'A user-facing demo of a model''s capabilities',
   'The training run that produced the model',
   'A leaderboard of the fastest GPUs'
 ]::text[],
 'The new model jumped from 50% to 72% on SWE-___ — that''s a huge leap.',
 'Use ''benchmark'' in a sentence about scoring AI models on a standardized test.',
 'curated', 'curator', '2026-05-04'),

('ai-eval', 'eval (evaluation)', null, 'ai-ml', 1,
 'A test you run on an AI model to measure how well it does your specific job — your private benchmark.',
 'Evals are like unit tests for AI. You write a set of inputs and the answers you''d call correct, run the model on them, and score. Public benchmarks tell you how a model does on standardized tasks; your evals tell you how it does on YOUR task. Every serious AI team has an eval suite they run before shipping a prompt change.',
 'The new prompt looked great in spot-checks but tanked the eval — rolling it back.',
 'When dev family says "we''re running evals on the new model," they mean this. Knowing the term means you understand the only way to actually KNOW if an AI change is good — not by vibes, by evals.',
 ARRAY['ai-benchmark','ai-dataset','ai-prompt']::text[],
 ARRAY['ai-benchmark']::text[],
 'ai-benchmark',
 ARRAY[
   'A live preview of a model''s output',
   'A meeting to review AI strategy',
   'A budget for AI inference costs'
 ]::text[],
 'The new prompt looked great in spot-checks but tanked the ___ — rolling it back.',
 'Use ''eval'' in a sentence about testing whether an AI model is good at your specific task.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: model types & releases (2) ─────────────────────────
('ai-open-weights', 'open weights / open source', null, 'ai-ml', 1,
 'A model whose parameters are published publicly, so anyone can download, run, fine-tune, or build on it.',
 'When a model''s weights are "open," you can grab them off Hugging Face and run them on your own hardware — no API key, no per-token billing. Llama, Mistral, DeepSeek, Qwen are open-weights. Claude and GPT are not. Open weights means you can fine-tune, you can self-host, you can audit — but you''re also responsible for the GPUs.',
 'We fine-tuned an open-weights model so we wouldn''t have to send patient data to an external API.',
 'When dev family says "we''re running an open-weights model on a private server," this is what they mean. Knowing the term means you understand the closed-vs-open frontier divide that shapes every AI procurement conversation.',
 ARRAY['ai-llm','ai-model','ai-fine-tuning']::text[],
 ARRAY['ai-model']::text[],
 'ai-fine-tuning',
 ARRAY[
   'A free trial of a commercial AI API',
   'A model that runs entirely in the browser',
   'An open-source web framework with AI features bolted on'
 ]::text[],
 'We fine-tuned an ___ model so we wouldn''t have to send patient data to an external API.',
 'Use ''open weights'' in a sentence about a model whose parameters are publicly downloadable.',
 'curated', 'curator', '2026-05-04'),

('ai-multimodal', 'multimodal', null, 'ai-ml', 1,
 'A model that can handle more than one kind of input or output — text plus images, audio, or video.',
 'Old LLMs only read and wrote text. Multimodal models can also see images, hear audio, or watch video — and sometimes generate them. Claude reads screenshots; GPT-4o talks; Gemini watches video. The "modal" part means modality (text, image, audio, video); "multi" means more than one. Most frontier models in 2026 are multimodal by default.',
 'I dropped a screenshot in and the multimodal model walked me through what was wrong with the layout.',
 'When you paste an image into Claude or your dev family says "the new model is multimodal," this is what makes it possible. Knowing the term means you can talk about modern AI capabilities precisely instead of just saying "it does pictures now."',
 ARRAY['ai-llm','ai-model','ai-open-weights']::text[],
 ARRAY['ai-llm']::text[],
 null,
 ARRAY[
   'A model trained on multiple datasets at once',
   'A model that can speak multiple human languages',
   'A model that can be queried via multiple API providers'
 ]::text[],
 'I dropped a screenshot in and the ___ model walked me through what was wrong with the layout.',
 'Use ''multimodal'' in a sentence about an AI model that handles images or audio as well as text.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml: architecture (3) ───────────────────────────────────
('ai-attention', 'attention', null, 'ai-ml', 1,
 'The mechanism inside a model that lets it weigh which parts of the input matter most for each part of the output.',
 'Attention is the core innovation underneath every modern LLM. As the model reads input, attention lets each word "look at" every other word and decide which ones are relevant. That''s how the model knows that "it" in "the dog chased the ball because it was bouncing" refers to the ball, not the dog. The 2017 paper that introduced it was literally called "Attention Is All You Need."',
 'Attention is what lets the model figure out long-range references inside a paragraph.',
 'Every transformer-based model — meaning every modern LLM — runs on attention. Knowing the term means when family talks about "attention heads" or "context length scaling," you know they''re talking about the engine inside the engine.',
 ARRAY['ai-transformer','ai-llm','ai-parameters']::text[],
 ARRAY['ai-llm']::text[],
 'ai-transformer',
 ARRAY[
   'The amount of context the model can hold at once',
   'How fast a model generates each next token',
   'A score for how confident a model is in its answer'
 ]::text[],
 '___ is what lets the model figure out long-range references inside a paragraph.',
 'Use ''attention'' in a sentence about how a model decides which parts of input matter.',
 'curated', 'curator', '2026-05-04'),

('ai-transformer', 'transformer (architecture)', null, 'ai-ml', 1,
 'The neural network design — built on attention — that every modern LLM uses under the hood.',
 'Transformer is the architecture: the specific shape of the math that makes up Claude, GPT, Gemini, Llama, Mistral, and basically every LLM since 2018. Before transformers, sequence models worked one word at a time and struggled with long context. Transformers process the whole input in parallel using attention, which is why they scaled so well. The "T" in GPT stands for transformer.',
 'Every frontier LLM in 2026 is still a transformer architecture under the hood.',
 'When dev family says "transformer-based model" or you read "post-transformer architectures," this is the baseline. Knowing the term means you can follow architecture conversations and know what people are trying to replace.',
 ARRAY['ai-attention','ai-llm','ai-model']::text[],
 ARRAY['ai-attention']::text[],
 'ai-moe',
 ARRAY[
   'A type of GPU optimized for AI workloads',
   'A pre-processing step that converts text into tokens',
   'A library for running models on the edge'
 ]::text[],
 'Every frontier LLM in 2026 is still a ___ architecture under the hood.',
 'Use ''transformer'' in a sentence about the architecture behind modern LLMs.',
 'curated', 'curator', '2026-05-04'),

('ai-moe', 'MoE (mixture of experts)', 'M-o-E', 'ai-ml', 1,
 'A model design that splits the work across many specialized sub-networks and only activates the relevant ones for each token.',
 'MoE stands for Mixture of Experts. Instead of one giant model where every parameter runs on every input, an MoE has many "expert" sub-models and a router that picks a few experts per token. The model can have a huge total parameter count but only run a fraction of them at a time — meaning it''s smart like a big model but fast like a small one. Mixtral, DeepSeek, and Llama 4 are MoE.',
 'The new MoE model has 400B total parameters but only activates 17B per token — that''s why it''s fast.',
 'When dev family says "the new MoE just dropped" or "active parameters versus total parameters," this is what they''re talking about. Knowing the term means you can read modern model release notes without losing the plot.',
 ARRAY['ai-transformer','ai-parameters','ai-model']::text[],
 ARRAY['ai-transformer','ai-parameters']::text[],
 null,
 ARRAY[
   'A way to combine outputs from multiple separate models at runtime',
   'A method for distilling a large model into a smaller one',
   'A technique for running models across multiple GPUs'
 ]::text[],
 'The new ___ model has 400B total parameters but only activates 17B per token — that''s why it''s fast.',
 'Use ''MoE'' in a sentence about a model that uses specialized sub-networks per token.',
 'curated', 'curator', '2026-05-04')

on conflict (id) do nothing;
