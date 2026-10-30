-- Jargon — Agentic Era companion path
--
-- A 30-term operator-level path that pairs with the eight-section
-- agentic-era guided course.
-- The four curriculum beats are:
--   1. how we got here;
--   2. what capable AI can do now;
--   3. the operator advantage;
--   4. agents and the emerging agentic operating-system layer.
--
-- The path is intentionally reusable. It contains no patient information,
-- employee information, store identifiers, or claims about one employer's
-- enabled tools. Examples use invented, generic operations-leadership work.
--
-- Primary grounding:
--   - McCarthy et al., Dartmouth AI proposal (1955)
--   - Vaswani et al., "Attention Is All You Need" (2017)
--   - Anthropic, "Building effective agents" (2024)
--   - OpenAI, "A practical guide to building AI agents"
--   - Microsoft, Work IQ documentation and APIs (2026)

begin;

alter table public.terms drop constraint if exists terms_path_check;
alter table public.terms add constraint terms_path_check check (path in (
  'git-cli','dev-concepts','enterprise','claude-code','ai-engineering','agile','systems',
  'programming','dev-tooling','dev-workflow','web-api','databases','computing','networking',
  'security','architecture','systems-engineering','cloud-devops','qa-reliability','math-logic',
  'tech-stack','enterprise-platforms','data-analytics',
  'ai-foundations','ai-tools','ai-prompting','ai-products','ai-evaluation','ai-policy',
  'ai-agentic-era'
));

alter table public.terms drop constraint if exists terms_domain_path_check;
alter table public.terms add constraint terms_domain_path_check check (
  (domain = 'ai' and path in (
    'ai-foundations','ai-tools','ai-prompting','ai-products','ai-evaluation','ai-policy',
    'ai-agentic-era'
  )) or
  (domain = 'coding' and path in (
    'git-cli','dev-concepts','enterprise','claude-code','ai-engineering','agile','systems',
    'programming','dev-tooling','dev-workflow','web-api','databases','computing','networking',
    'security','architecture','systems-engineering','cloud-devops','qa-reliability','math-logic',
    'tech-stack','enterprise-platforms','data-analytics'
  ))
);

insert into public.terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ── Beat 1: how we got here ──────────────────────────────────────────────

('era-rules-based-system', 'rules-based system', null, 'ai-agentic-era', 'ai', 1,
 'Software that follows explicit if-then instructions written in advance.',
 'A rules-based system does exactly what its designers specified: if this condition appears, take that action. It can be fast, reliable, and easy to audit when the situation is predictable, but it cannot gracefully handle a case nobody wrote a rule for. Much of ordinary business software still works this way, and that is useful rather than obsolete.',
 'The old scheduling checker was a rules-based system: if coverage fell below the threshold, it raised an alert.',
 'This is the starting point of the AI story. It lets an operator distinguish dependable automation from a learning system and ask whether a task needs judgment or only a clear rule.',
 ARRAY['era-expert-system','era-machine-learning','era-workflow-redesign']::text[],
 ARRAY[]::text[],
 'era-expert-system',
 ARRAY[
   'Software that learns new patterns from examples without explicit instructions',
   'A language model that generates a different answer each time',
   'A robot that copies every action demonstrated by a person'
 ]::text[],
 'The checker was a ___: if coverage dropped below the threshold, it raised an alert.',
 'Use ''rules-based system'' in a sentence about software following an explicit if-then instruction.',
 'curated', null, null),

('era-expert-system', 'expert system', null, 'ai-agentic-era', 'ai', 2,
 'An early AI program that encoded specialist knowledge as a large collection of rules.',
 'Expert systems became prominent in the 1970s and 1980s. Specialists and programmers translated domain knowledge into facts and if-then rules so a computer could recommend a diagnosis, configuration, or decision. They could be impressive inside a narrow boundary, but maintaining thousands of brittle rules was difficult and they did not learn automatically from ordinary use.',
 'The expert system could recommend an equipment configuration, but a specialist had to update its rules whenever the product line changed.',
 'Expert systems explain why AI is not a brand-new dream and why earlier waves often stalled. The ambition was real; the systems were narrow, expensive to maintain, and unable to absorb messy experience on their own.',
 ARRAY['era-rules-based-system','era-machine-learning','era-measurable-delta']::text[],
 ARRAY['era-rules-based-system']::text[],
 'era-machine-learning',
 ARRAY[
   'A modern chat assistant trained on broad internet text',
   'A database that stores every decision made by a specialist',
   'A workflow that routes difficult cases directly to a human'
 ]::text[],
 'The ___ captured specialist knowledge in thousands of hand-written rules.',
 'Use ''expert system'' in a sentence about early AI built from specialist rules.',
 'curated', null, null),

('era-machine-learning', 'machine learning', null, 'ai-agentic-era', 'ai', 1,
 'A way to build software by learning patterns from examples instead of writing every rule.',
 'Machine learning changes the construction method. Rather than specifying every if-then instruction, people provide examples and a learning process adjusts a model to make useful predictions on new cases. The result can recognize patterns that would be exhausting to encode by hand, but it inherits limits and bias from its data and objective.',
 'The forecasting tool used machine learning to find demand patterns that were not captured by the old fixed rules.',
 'This is the bridge from classic automation to modern AI. It explains why the system can handle variation, why data quality matters, and why its answer is a prediction rather than a guaranteed fact.',
 ARRAY['era-rules-based-system','era-deep-learning','era-transformer']::text[],
 ARRAY['era-rules-based-system']::text[],
 'era-deep-learning',
 ARRAY[
   'A technique for writing more detailed if-then rules automatically',
   'A database that remembers every previous user action',
   'A robot learning a task only by watching one demonstration'
 ]::text[],
 'The forecasting tool used ___ to learn patterns from examples instead of fixed rules.',
 'Use ''machine learning'' in a sentence that contrasts learned patterns with hand-written rules.',
 'curated', null, null),

('era-deep-learning', 'deep learning', null, 'ai-agentic-era', 'ai', 2,
 'Machine learning built from many-layered neural networks.',
 'Deep learning uses neural networks with many processing layers to learn complicated patterns from large amounts of data. Better algorithms, larger datasets, and powerful graphics processors drove major gains in speech, vision, translation, and eventually language. Deep does not mean conscious or wise; it describes the number and organization of learned layers.',
 'Deep learning let the image system recognize objects without a programmer defining every visual feature.',
 'Deep learning is the technical turn that made the current wave possible. It helps an operator hear the mechanism beneath marketing language without mistaking mathematical depth for human understanding.',
 ARRAY['era-machine-learning','era-transformer','era-generative-ai']::text[],
 ARRAY['era-machine-learning']::text[],
 'era-transformer',
 ARRAY[
   'AI that explains every answer with unusually deep reasoning',
   'A system that searches through many database layers',
   'A training method that uses only a small set of expert-written rules'
 ]::text[],
 'Modern speech and image recognition accelerated when ___ systems scaled up.',
 'Use ''deep learning'' in a sentence about many-layered neural networks.',
 'curated', null, null),

('era-transformer', 'transformer', null, 'ai-agentic-era', 'ai', 2,
 'The attention-based neural-network architecture behind modern language models.',
 'The transformer architecture was introduced in 2017. Its attention mechanism lets a model weigh relationships among many parts of an input and train efficiently in parallel. Transformers scaled unusually well, becoming the foundation for modern language models and many systems that work with images, audio, and video.',
 'The transformer could connect a detail at the end of the report with a qualifying sentence near the beginning.',
 'This is the hinge in the modern timeline. It explains why language became the interface and why the 2017 breakthrough led to a rapid sequence of increasingly capable models rather than one isolated product.',
 ARRAY['era-deep-learning','era-large-language-model','era-generative-ai']::text[],
 ARRAY['era-deep-learning']::text[],
 'era-large-language-model',
 ARRAY[
   'A tool that converts one file format into another',
   'A model trained only to translate between two languages',
   'A workflow that turns an AI draft into a finished document'
 ]::text[],
 'The ___ architecture became the foundation for modern language models.',
 'Use ''transformer'' in a sentence about the architecture behind modern language AI.',
 'curated', null, null),

('era-generative-ai', 'generative AI', null, 'ai-agentic-era', 'ai', 1,
 'AI that creates new text, images, audio, video, or code from instructions.',
 'Generative AI produces an output rather than only assigning a label or predicting a number. It builds that output from patterns learned during training and the context supplied at use time. The result can feel original and conversational, but it remains generated from statistical patterns and must be checked against reality.',
 'She used generative AI to draft three versions of a meeting agenda, then selected and edited the strongest one.',
 'Generation moved AI into the same medium leaders already use: words, slides, spreadsheets, and conversations. That makes the technology broadly accessible, but it also makes plausible mistakes easy to mistake for finished work.',
 ARRAY['era-transformer','era-large-language-model','era-ai-assistant']::text[],
 ARRAY['era-transformer']::text[],
 'era-large-language-model',
 ARRAY[
   'AI that can only classify an existing item into a category',
   'Software that automatically stores every new file in the cloud',
   'A search engine that returns only exact keyword matches'
 ]::text[],
 'She used ___ to draft three versions of the agenda before editing the strongest one.',
 'Use ''generative AI'' in a sentence about creating a new draft from instructions.',
 'curated', null, null),

('era-large-language-model', 'large language model', 'L-L-M', 'ai-agentic-era', 'ai', 1,
 'A large trained model that reads and generates language one token at a time.',
 'A large language model, or LLM, is trained on enormous collections of text and related data to predict the next token in context. That simple training objective produces broad abilities in writing, summarizing, translation, coding, and question answering. It does not make the model a database of guaranteed facts or a human mind.',
 'The large language model turned a rough operational brief into a structured first draft.',
 'LLM names the engine beneath chat products and many agents. Knowing the difference between the model and the surrounding product helps an operator ask whether an improvement came from a better model, better context, better tools, or better workflow design.',
 ARRAY['era-transformer','era-generative-ai','era-ai-assistant']::text[],
 ARRAY['era-transformer','era-generative-ai']::text[],
 'era-ai-assistant',
 ARRAY[
   'A database containing every sentence used during training',
   'A chat product with a permanent memory of every user',
   'A rule engine that selects from prewritten answers'
 ]::text[],
 'The ___ turned a rough brief into a structured first draft.',
 'Use ''large language model'' in a sentence about the engine beneath an AI chat product.',
 'curated', null, null),

-- ── Beat 2: what capable AI can do now ───────────────────────────────────

('era-ai-assistant', 'AI assistant', null, 'ai-agentic-era', 'ai', 1,
 'A product that gives a person a conversational interface to one or more AI models.',
 'An AI assistant wraps a model in a usable product. It may add chat history, file handling, web search, organizational grounding, tools, voice, safety checks, and permissions. Two assistants powered by similar models can behave very differently because the product around the model controls what context and actions are available.',
 'The AI assistant summarized the supplied meeting notes, but it could not see documents that had not been shared with it.',
 'Assistant is the right word for the surface a leader uses today. It redirects the question from which model is smartest to what this approved assistant can safely see, do, cite, and remember.',
 ARRAY['era-large-language-model','era-enterprise-ai','era-agent']::text[],
 ARRAY['era-large-language-model']::text[],
 'era-enterprise-ai',
 ARRAY[
   'A human contractor responding through a chat interface',
   'A single model file with no surrounding product features',
   'A fixed automation that runs without accepting instructions'
 ]::text[],
 'The ___ summarized the notes it had been given but could not see unshared files.',
 'Use ''AI assistant'' in a sentence that separates the user-facing product from its underlying model.',
 'curated', null, null),

('era-enterprise-ai', 'enterprise AI', null, 'ai-agentic-era', 'ai', 1,
 'AI provided inside an organization with managed identity, permissions, data boundaries, and policy controls.',
 'Enterprise AI is not simply a consumer chatbot with a company logo. It is connected to organizational identity and governance so access follows the user, protected data stays inside approved boundaries, and administrators can control features and retention. Exact protections vary, so the official policy and product documentation remain the source of truth.',
 'She used the approved enterprise AI for work documents and kept all work data out of consumer tools.',
 'For an operator, the boundary determines what can safely enter a prompt. The useful habit is simple: verify the approved surface first, use the least sensitive context needed, and never treat convenience as permission.',
 ARRAY['era-ai-assistant','era-grounding','era-guardrail']::text[],
 ARRAY['era-ai-assistant']::text[],
 'era-grounding',
 ARRAY[
   'Any AI subscription paid for with a corporate credit card',
   'A model trained exclusively on business and finance books',
   'A public chatbot used by more than one department'
 ]::text[],
 'Work documents stayed inside the approved ___ environment.',
 'Use ''enterprise AI'' in a sentence about managed identity, permissions, and data boundaries.',
 'curated', null, null),

('era-context-window', 'context window', null, 'ai-agentic-era', 'ai', 2,
 'The maximum amount of information a model can actively consider in one interaction.',
 'The context window contains the instructions, conversation, retrieved sources, tool results, and output tokens available to the model for a turn. When relevant material is absent, buried, or pushed out, the answer can degrade. A larger window helps, but clear selection and organization still matter.',
 'The first report fell outside the context window, so the assistant compared only the more recent files.',
 'This explains why an assistant can appear to forget and why dumping every document into one prompt is not a strategy. Operators improve results by choosing the right evidence, labeling it, and keeping the brief focused.',
 ARRAY['era-large-language-model','era-grounding','era-enterprise-ai']::text[],
 ARRAY['era-large-language-model']::text[],
 'era-grounding',
 ARRAY[
   'The amount of time an assistant waits before answering',
   'The visible size of the chat window on screen',
   'The number of people allowed to share one AI account'
 ]::text[],
 'The oldest report fell outside the ___, so it was not part of the comparison.',
 'Use ''context window'' in a sentence about the information a model can consider at once.',
 'curated', null, null),

('era-grounding', 'grounding', null, 'ai-agentic-era', 'ai', 2,
 'Giving an AI authoritative source material to use for a specific answer.',
 'Grounding connects a model to evidence available at use time: a policy, report, spreadsheet, approved knowledge base, or current web source. The model still generates the response, but it does so with relevant material in context. Good grounding includes citations or a traceable link back to the source.',
 'The recap was grounded in the approved agenda and meeting notes rather than the model guessing what happened.',
 'Grounding turns a vague request into evidence-backed work. It reduces unsupported invention, makes review faster, and gives the human verifier somewhere concrete to check.',
 ARRAY['era-context-window','era-enterprise-ai','era-verification-workflow']::text[],
 ARRAY['era-context-window']::text[],
 'era-verification-workflow',
 ARRAY[
   'Training a model from scratch on an entire company archive',
   'Preventing an AI tool from connecting to the internet',
   'Saving a finished response as a reusable prompt template'
 ]::text[],
 'The recap was ___ in the approved agenda and meeting notes.',
 'Use ''grounding'' in a sentence about supplying authoritative source material.',
 'curated', null, null),

('era-hallucination', 'hallucination', null, 'ai-agentic-era', 'ai', 1,
 'A plausible-sounding AI output that is unsupported, inaccurate, or invented.',
 'A language model is optimized to continue patterns, not to feel uncertainty the way a person does. When context is missing, ambiguous, or conflicting, it may produce a fluent answer that includes invented facts, quotations, links, or calculations. Grounding and tools reduce the risk; human verification remains necessary when consequences matter.',
 'The polished citation was a hallucination: the linked policy did not contain that sentence.',
 'Fluency is not proof. A pharmacist already knows the professional move: verify the source, the number, and the decision before the draft reaches a patient, colleague, or leader.',
 ARRAY['era-grounding','era-verification-workflow','era-guardrail']::text[],
 ARRAY['era-large-language-model']::text[],
 'era-verification-workflow',
 ARRAY[
   'A model refusing to answer because a safety rule was triggered',
   'A user remembering an AI answer incorrectly',
   'A delay while an assistant retrieves a large document'
 ]::text[],
 'The polished citation was a ___ because the source never said it.',
 'Use ''hallucination'' in a sentence about a plausible but unsupported AI claim.',
 'curated', null, null),

('era-tool-use', 'tool use', null, 'ai-agentic-era', 'ai', 2,
 'An AI capability that lets the system retrieve information or take an action through another service.',
 'With tool use, a model can ask a runtime to search, calculate, read a permitted file, query a system, or perform an approved action. The tool returns a real result that becomes new context for the model. This is the mechanism that moves AI from drafting words toward doing work.',
 'The assistant used a calendar tool to find open times instead of inventing availability.',
 'Tool use is the dividing line between a convincing answer and contact with the real environment. It also raises the stakes: permissions, confirmation, logging, and reversible actions matter as soon as the system can change something.',
 ARRAY['era-ai-assistant','era-agent','era-approval-gate']::text[],
 ARRAY['era-ai-assistant']::text[],
 'era-agent',
 ARRAY[
   'A person manually copying an AI answer into another application',
   'A model storing new facts permanently in its trained weights',
   'A prompt containing several examples of desired output'
 ]::text[],
 'The assistant relied on ___ to check the real calendar instead of guessing.',
 'Use ''tool use'' in a sentence about an AI retrieving data or taking an approved action.',
 'curated', null, null),

('era-guardrail', 'guardrail', null, 'ai-agentic-era', 'ai', 2,
 'A rule, check, or boundary that limits what an AI system may accept, produce, or do.',
 'Guardrails can block sensitive inputs, restrict available tools, require a human confirmation, validate output, cap spending, or stop a loop after too many attempts. No guardrail makes a model infallible. Effective safety uses several layers and assumes a determined error can slip past any one check.',
 'The workflow had a guardrail that allowed a draft to be created but prevented it from being sent without approval.',
 'Guardrails translate policy into the working system. They let leaders ask a concrete question: what happens before a risky action, after a failed check, and when the system is unsure?',
 ARRAY['era-enterprise-ai','era-approval-gate','era-autonomy-boundary']::text[],
 ARRAY['era-enterprise-ai']::text[],
 'era-approval-gate',
 ARRAY[
   'A style guide describing how an AI answer should sound',
   'A benchmark used to compare two language models',
   'A database containing examples of correct decisions'
 ]::text[],
 'A ___ allowed the draft but prevented an unapproved send.',
 'Use ''guardrail'' in a sentence about limiting an AI action or output.',
 'curated', null, null),

-- ── Beat 3: the operator advantage ───────────────────────────────────────

('era-delegation-brief', 'delegation brief', null, 'ai-agentic-era', 'ai', 1,
 'A compact instruction that gives an AI a role, context, task, and required output.',
 'A delegation brief is the operator version of a good prompt. It names who the assistant should act as, supplies only the relevant background, states the job to complete, and defines the output shape and quality bar. It does not need magic wording; it needs the clarity a capable new team member would need.',
 'Her delegation brief asked for an operations-coach perspective, supplied the scenario, requested three options, and required a short risk table.',
 'This is why experienced operators have an advantage. Briefing, inspecting, correcting, and deciding are already leadership muscles; AI makes those muscles visible and repeatable.',
 ARRAY['era-ai-assistant','era-iteration','era-workflow-redesign']::text[],
 ARRAY['era-ai-assistant']::text[],
 'era-iteration',
 ARRAY[
   'A summary the AI writes after it completes a task',
   'A list of every tool an agent is allowed to use',
   'A legal notice describing who owns an AI output'
 ]::text[],
 'The ___ supplied a role, context, task, and exact output format.',
 'Use ''delegation brief'' in a sentence about giving an AI enough direction to do useful work.',
 'curated', null, null),

('era-iteration', 'iteration', null, 'ai-agentic-era', 'ai', 1,
 'A deliberate second pass that improves an AI result using specific feedback.',
 'Iteration means treating the first output as material, not a verdict. The user identifies what is missing or weak, gives targeted feedback, requests a revision, and repeats until the work clears the quality bar. A strong second prompt often matters more than an elaborate first prompt.',
 'The first draft was generic, so the next iteration asked for concrete tradeoffs, a tighter tone, and a decision-ready table.',
 'Most casual users prompt once and quit. Operators gain leverage by reviewing the draft the same way they coach a person: name the gap, set the standard, and ask for the improved pass.',
 ARRAY['era-delegation-brief','era-verification-workflow','era-measurable-delta']::text[],
 ARRAY['era-delegation-brief']::text[],
 'era-verification-workflow',
 ARRAY[
   'Running the same prompt repeatedly without changing anything',
   'Training a new model whenever the answer is weak',
   'Saving a completed answer as permanent model memory'
 ]::text[],
 'The second ___ added concrete tradeoffs and a decision-ready table.',
 'Use ''iteration'' in a sentence about improving an AI draft with specific feedback.',
 'curated', null, null),

('era-verification-workflow', 'verification workflow', null, 'ai-agentic-era', 'ai', 1,
 'A repeatable check of sources, numbers, logic, policy, and consequences before AI-assisted work ships.',
 'A verification workflow makes review explicit. The human checks every material claim against its source, recalculates important numbers, tests whether the recommendation follows from the evidence, confirms policy compliance, and owns the final decision. The rigor should rise with the stakes.',
 'Before sending the recap, she ran the verification workflow: source links, dates, totals, tone, recipients, and requested actions.',
 'This converts hallucination from a reason to avoid AI into a manageable professional risk. AI drafts; humans verify and decide, just as high-consequence work already requires.',
 ARRAY['era-grounding','era-hallucination','era-human-in-the-loop']::text[],
 ARRAY['era-grounding','era-hallucination','era-iteration']::text[],
 'era-human-in-the-loop',
 ARRAY[
   'A model explaining its answer in a longer chain of reasoning',
   'A user asking the same question in two different chats',
   'A system checking only whether the response has the correct format'
 ]::text[],
 'She checked sources, dates, totals, tone, and recipients in a ___ before sending.',
 'Use ''verification workflow'' in a sentence about checking AI-assisted work before it ships.',
 'curated', null, null),

('era-human-in-the-loop', 'human in the loop', null, 'ai-agentic-era', 'ai', 2,
 'A workflow where a person reviews, approves, corrects, or takes over at defined points.',
 'Human in the loop is a system design, not a vague promise that someone is nearby. It specifies which decisions require approval, what evidence the reviewer sees, how the person can edit or reject the result, and what happens when no one responds. The human needs real authority and enough time to judge.',
 'The system drafted the follow-up, but a human in the loop reviewed the facts and chose whether to send it.',
 'Human judgment is most valuable at consequence-bearing boundaries: people decisions, sensitive communications, exceptions, and irreversible actions. A checkbox approval with no useful context is not meaningful oversight.',
 ARRAY['era-verification-workflow','era-approval-gate','era-autonomy-boundary']::text[],
 ARRAY['era-verification-workflow']::text[],
 'era-approval-gate',
 ARRAY[
   'A person writing every step while the AI watches',
   'A user receiving a report after an automated action is complete',
   'A model asking itself to review its own answer'
 ]::text[],
 'A ___ reviewed the facts and chose whether the message should be sent.',
 'Use ''human in the loop'' in a sentence about a defined review or approval point.',
 'curated', null, null),

('era-workflow-redesign', 'workflow redesign', null, 'ai-agentic-era', 'ai', 2,
 'Changing the steps, handoffs, checks, and ownership of work to use AI well.',
 'Workflow redesign goes beyond asking AI to perform one old step faster. It examines the whole job: what should be retrieved automatically, what can be drafted, where human judgment adds value, which approvals are essential, and what evidence should be preserved. The best result may remove steps rather than automate all of them.',
 'Instead of only drafting the weekly recap faster, the workflow redesign gathered approved inputs, created a draft, flagged missing evidence, and routed the final review to the leader.',
 'This is where operator knowledge beats novelty. The person who understands the real work can place AI where it removes friction without erasing accountability.',
 ARRAY['era-rules-based-system','era-delegation-brief','era-agentic-workflow']::text[],
 ARRAY['era-delegation-brief','era-verification-workflow']::text[],
 'era-agentic-workflow',
 ARRAY[
   'Replacing the current AI model with a newer release',
   'Rewriting a prompt to make the answer sound friendlier',
   'Moving an existing process into a different application'
 ]::text[],
 'The ___ changed the inputs, checks, handoffs, and final approval instead of merely drafting faster.',
 'Use ''workflow redesign'' in a sentence about changing the whole process around AI.',
 'curated', null, null),

('era-measurable-delta', 'measurable delta', null, 'ai-agentic-era', 'ai', 2,
 'A concrete before-and-after difference that shows whether an AI-assisted workflow helped.',
 'A measurable delta is the evidence between the old workflow and the new one. Useful measures can include minutes saved, rework avoided, completeness, error rate, response time, or reviewer confidence. The comparison should include the time spent prompting and verifying, not only the impressive generation step.',
 'The measurable delta was not just a faster draft; preparation fell from forty minutes to twenty while the same review checklist still passed.',
 'Visible, honest deltas turn AI skill into an operating result. They help a leader identify which workflows deserve expansion and which experiments were merely interesting.',
 ARRAY['era-enterprise-ai','era-iteration','era-workflow-redesign']::text[],
 ARRAY['era-iteration','era-verification-workflow']::text[],
 'era-workflow-redesign',
 ARRAY[
   'The numerical difference between two model version names',
   'A hidden setting that increases the creativity of an AI response',
   'The delay between a prompt and the first generated token'
 ]::text[],
 'The ___ showed preparation time fell while the same quality checks still passed.',
 'Use ''measurable delta'' in a sentence about proving an AI workflow created value.',
 'curated', null, null),

('era-agentic-workflow', 'agentic workflow', null, 'ai-agentic-era', 'ai', 2,
 'A multi-step workflow where an AI chooses or performs some steps using tools and feedback.',
 'An agentic workflow combines model decisions with tools, data, checks, and stopping rules. Some steps may be fixed by code while others are chosen dynamically by the model. It is more adaptable than a simple automation and more bounded than an open-ended autonomous agent.',
 'The agentic workflow gathered the approved reports, drafted the summary, checked for missing sections, and paused for a leader to approve the final version.',
 'The phrase is often used loosely. Naming the actual steps, tools, checks, and human gates lets an operator tell a useful workflow from a chatbot wrapped in ambitious marketing.',
 ARRAY['era-workflow-redesign','era-agent','era-agent-loop']::text[],
 ARRAY['era-tool-use','era-workflow-redesign']::text[],
 'era-agent',
 ARRAY[
   'Any workflow in which a person uses an AI chat once',
   'A fixed sequence that never reads results or changes course',
   'A model trained on examples from one business process'
 ]::text[],
 'The ___ gathered inputs, drafted, checked its work, and paused for approval.',
 'Use ''agentic workflow'' in a sentence about multi-step AI work with tools and checks.',
 'curated', null, null),

-- ── Beat 4: agents and the operating-system horizon ──────────────────────

('era-agent', 'agent', null, 'ai-agentic-era', 'ai', 2,
 'An AI system that pursues a goal by choosing steps, using tools, and reacting to results.',
 'An agent receives a goal and enough authority to work toward it across multiple turns. It plans a next step, uses a tool or produces an intermediate result, observes what happened, and adjusts. Agents are useful when the exact path cannot be fully specified in advance, but their flexibility also increases cost and the chance of compounding error.',
 'The agent reviewed the available files, noticed one was missing, asked for it, and then completed the brief.',
 'Agent is a capability description, not a quality guarantee. The useful questions are what goal it owns, which tools and data it can access, where it must ask, and how it proves completion.',
 ARRAY['era-tool-use','era-agent-loop','era-autonomy-boundary']::text[],
 ARRAY['era-tool-use','era-agentic-workflow']::text[],
 'era-agent-loop',
 ARRAY[
   'A chat assistant that always gives one answer and stops',
   'A fixed script that follows the same steps for every input',
   'A person employed to supervise an AI product'
 ]::text[],
 'The ___ noticed a missing file, asked for it, and continued toward the goal.',
 'Use ''agent'' in a sentence about an AI choosing steps and reacting to results.',
 'curated', null, null),

('era-agent-loop', 'agent loop', null, 'ai-agentic-era', 'ai', 2,
 'The repeated cycle of plan, act, observe, and decide that keeps an agent working.',
 'Inside an agent loop, the model chooses an action, the runtime performs it, the environment returns a result, and the model decides what comes next. The loop ends when the goal is met, a stopping condition fires, or the agent asks a human for help. Good loops make progress visible rather than hiding activity behind a spinner.',
 'The agent loop searched the files, compared two reports, found a mismatch, and asked which source was authoritative.',
 'Once the loop is visible, an operator can judge whether the system is progressing, repeating itself, spending too much, or drifting from the assignment.',
 ARRAY['era-agent','era-orchestration','era-stopping-condition']::text[],
 ARRAY['era-agent']::text[],
 'era-stopping-condition',
 ARRAY[
   'A bug that forces an assistant to repeat the same sentence forever',
   'A saved series of prompts that a user runs manually',
   'A training cycle that updates the model after every response'
 ]::text[],
 'The ___ searched, compared, noticed a mismatch, and chose the next action.',
 'Use ''agent loop'' in a sentence about plan, action, observation, and next decision.',
 'curated', null, null),

('era-persistent-memory', 'persistent memory', null, 'ai-agentic-era', 'ai', 3,
 'Stored context that an AI system can retrieve across separate sessions or tasks.',
 'Persistent memory lives outside the model and survives after one context window closes. It can hold approved preferences, decisions, prior work, or learned summaries for later retrieval. Memory must be scoped, correctable, permission-aware, and deletable because stale or over-broad memory can quietly distort future actions.',
 'The assistant used persistent memory to recall the approved reporting format without storing the confidential report itself.',
 'Memory makes an assistant feel continuous and enables longer-running work. It also creates governance questions: what was saved, who can see it, how long it lasts, and how a person corrects or removes it.',
 ARRAY['era-enterprise-ai','era-agent','era-agentic-operating-system']::text[],
 ARRAY['era-enterprise-ai','era-agent']::text[],
 'era-agentic-operating-system',
 ARRAY[
   'Everything permanently encoded in a model during its original training',
   'The text still visible earlier in the current chat window',
   'A browser cache used only to load the interface faster'
 ]::text[],
 'The approved format survived between sessions because it was stored in ___.',
 'Use ''persistent memory'' in a sentence about authorized context available across sessions.',
 'curated', null, null),

('era-orchestration', 'orchestration', null, 'ai-agentic-era', 'ai', 3,
 'Coordinating models, agents, tools, and checks so each handles the right part of a larger job.',
 'Orchestration decides who does what and in which order. A manager agent might delegate research, analysis, and review to specialized workers, then combine their outputs. Effective orchestration defines interfaces, evidence, budgets, failure handling, and one accountable path back to the human.',
 'The orchestration sent research to one agent, numerical review to another, and the combined draft through a final verification gate.',
 'Multiple agents are not automatically better. Orchestration is valuable only when the split improves speed, expertise, or confidence enough to justify more coordination and more places for errors to hide.',
 ARRAY['era-agent','era-agent-loop','era-mixed-human-agent-team']::text[],
 ARRAY['era-agent-loop']::text[],
 'era-mixed-human-agent-team',
 ARRAY[
   'A model generating a longer internal reasoning trace',
   'A person opening several AI chats at the same time',
   'A database sorting tasks by their due dates'
 ]::text[],
 'The ___ assigned research and review to different agents, then combined the results.',
 'Use ''orchestration'' in a sentence about coordinating specialized agents and checks.',
 'curated', null, null),

('era-approval-gate', 'approval gate', null, 'ai-agentic-era', 'ai', 2,
 'A checkpoint that blocks an action until an authorized person explicitly approves it.',
 'An approval gate sits before a consequence-bearing action such as sending, publishing, purchasing, deleting, or changing a record. A useful gate shows the proposed action, the supporting evidence, the scope, and what cannot be undone. It fails closed when the approver is unavailable or the request is ambiguous.',
 'The agent prepared the message and recipients, but the approval gate blocked the send until the leader confirmed both.',
 'Approval gates preserve accountability without requiring a human to perform every low-risk step. They are strongest when reserved for real decisions rather than added as meaningless clicks everywhere.',
 ARRAY['era-guardrail','era-human-in-the-loop','era-autonomy-boundary']::text[],
 ARRAY['era-human-in-the-loop','era-agent']::text[],
 'era-autonomy-boundary',
 ARRAY[
   'A notification sent after an automated action already happened',
   'A password prompt used to sign into an AI product',
   'A score threshold used to choose between two models'
 ]::text[],
 'The ___ blocked the send until an authorized leader confirmed the message and recipients.',
 'Use ''approval gate'' in a sentence about explicit permission before an AI takes an important action.',
 'curated', null, null),

('era-stopping-condition', 'stopping condition', null, 'ai-agentic-era', 'ai', 3,
 'A rule that tells an agent when to finish, pause, escalate, or stop trying.',
 'A stopping condition can be success, a time or cost limit, too many failed attempts, missing authority, low confidence, or a request for human judgment. Without explicit stopping conditions, an agent may loop, spend, repeat actions, or continue after the useful work is done.',
 'The stopping condition paused the agent after two conflicting sources and asked the operator to choose the authority.',
 'Good delegation includes knowing when to come back. Stopping conditions are the machine-readable version of that leadership expectation and a key defense against runaway autonomy.',
 ARRAY['era-agent-loop','era-approval-gate','era-autonomy-boundary']::text[],
 ARRAY['era-agent-loop']::text[],
 'era-autonomy-boundary',
 ARRAY[
   'The final sentence an AI writes at the end of a report',
   'A rule that prevents a model from seeing sensitive input',
   'A benchmark score required before a model is released'
 ]::text[],
 'The ___ paused the agent when its sources conflicted.',
 'Use ''stopping condition'' in a sentence about when an agent should finish or ask for help.',
 'curated', null, null),

('era-autonomy-boundary', 'autonomy boundary', null, 'ai-agentic-era', 'ai', 3,
 'The explicit line between what an agent may do alone and what requires human authority.',
 'An autonomy boundary defines allowed data, tools, actions, spending, time, and escalation rules. It should reflect consequence and reversibility: drafting is different from sending, recommending is different from deciding, and creating a reversible plan is different from deleting a record. The boundary must be enforced by the system rather than left as friendly prose.',
 'The autonomy boundary let the agent prepare schedule scenarios but prohibited it from changing assignments or contacting anyone.',
 'As agents become more capable, authority design matters more than clever prompts. Leaders need to delegate enough for useful work while keeping people decisions, sensitive data, and irreversible actions under accountable human control.',
 ARRAY['era-guardrail','era-approval-gate','era-agentic-operating-system']::text[],
 ARRAY['era-approval-gate','era-stopping-condition']::text[],
 'era-agentic-operating-system',
 ARRAY[
   'The maximum number of tokens an agent can read at once',
   'The physical network separating two company offices',
   'The point where one model hands a draft to another model'
 ]::text[],
 'The ___ allowed scenario planning but prohibited changing assignments.',
 'Use ''autonomy boundary'' in a sentence about what an agent may and may not do without approval.',
 'curated', null, null),

('era-mixed-human-agent-team', 'mixed human-agent team', null, 'ai-agentic-era', 'ai', 3,
 'A working team where people and AI agents have distinct roles, handoffs, and accountability.',
 'In a mixed human-agent team, agents may gather, draft, monitor, or analyze while people set goals, resolve ambiguity, make sensitive decisions, and own outcomes. The design needs clear assignments, visible provenance, escalation paths, and a single accountable human leader. Treating agents as invisible magic creates confusion rather than capacity.',
 'The mixed human-agent team used agents for research and first drafts while leaders handled coaching, exceptions, and final decisions.',
 'Leading this kind of team is an extension of delegation, not the end of management. Clear briefs, inspection, feedback, workload design, and judgment become more important as the number of nonhuman workers grows.',
 ARRAY['era-orchestration','era-human-in-the-loop','era-agentic-operating-system']::text[],
 ARRAY['era-orchestration','era-autonomy-boundary']::text[],
 'era-agentic-operating-system',
 ARRAY[
   'A team that uses several different chat products during meetings',
   'A department made up of technical and nontechnical employees',
   'A vendor support team supervised by an AI chatbot'
 ]::text[],
 'The ___ gave agents the research work and kept judgment-heavy decisions with leaders.',
 'Use ''mixed human-agent team'' in a sentence about distinct human and agent responsibilities.',
 'curated', null, null),

('era-agentic-operating-system', 'agentic operating system', null, 'ai-agentic-era', 'ai', 3,
 'An emerging computing layer where goals, context, agents, and permissions become the main interface to many tools.',
 'Agentic operating system is a forward-looking label, not one settled product category. It describes a shift from opening each application and performing every step manually toward briefing a persistent system that can coordinate agents across approved tools, data, and workflows. The direction is visible in assistants with memory, organizational context, tool use, and action layers; the mature form and timeline remain uncertain.',
 'In an agentic operating system, the leader might brief the desired outcome once, inspect the proposed plan, approve consequential steps, and monitor the evidence trail.',
 'This is the destination that ties the history together: rules became learned models, language became the interface, tools turned answers into actions, and orchestration begins to make the assistant a layer across the machine. The durable skill is not memorizing one product; it is learning to brief, bound, verify, and lead the system.',
 ARRAY['era-persistent-memory','era-orchestration','era-mixed-human-agent-team','era-autonomy-boundary']::text[],
 ARRAY['era-persistent-memory','era-orchestration','era-autonomy-boundary']::text[],
 null,
 ARRAY[
   'A conventional operating system rewritten entirely by an AI model',
   'A single autonomous robot that replaces every office application',
   'A subscription that gives one user access to several AI chatbots'
 ]::text[],
 'An ___ makes goals, context, agents, permissions, and tools feel like one coordinated layer.',
 'Use ''agentic operating system'' in a sentence about briefing a coordinated computing layer instead of operating each app step by step.',
 'curated', null, null)

on conflict (id) do update set
  term = excluded.term,
  pronunciation = excluded.pronunciation,
  path = excluded.path,
  domain = excluded.domain,
  difficulty = excluded.difficulty,
  one_line_definition = excluded.one_line_definition,
  long_definition = excluded.long_definition,
  example_in_sentence = excluded.example_in_sentence,
  why_it_matters = excluded.why_it_matters,
  related_terms = excluded.related_terms,
  prerequisites = excluded.prerequisites,
  stretch_term = excluded.stretch_term,
  multiple_choice_distractors = excluded.multiple_choice_distractors,
  fill_in_blank_sentence = excluded.fill_in_blank_sentence,
  use_in_sentence_prompt = excluded.use_in_sentence_prompt,
  source = excluded.source,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at;

do $verify$
declare
  path_count integer;
  d1_count integer;
  d2_count integer;
  d3_count integer;
begin
  select
    count(*),
    count(*) filter (where difficulty = 1),
    count(*) filter (where difficulty = 2),
    count(*) filter (where difficulty = 3)
  into path_count, d1_count, d2_count, d3_count
  from public.terms
  where path = 'ai-agentic-era';

  if path_count <> 30 or d1_count <> 10 or d2_count <> 14 or d3_count <> 6 then
    raise exception
      'ai-agentic-era expected 30 terms (10 d1, 14 d2, 6 d3); found % (%, %, %)',
      path_count, d1_count, d2_count, d3_count;
  end if;
end
$verify$;

commit;
