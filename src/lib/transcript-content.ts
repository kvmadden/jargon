// transcript-content.ts — POC content pool for the "transcript" quiz card.
//
// The transcript card tests REAL-WORLD RECOGNITION: show the user a 2-4 line
// snippet of an actual-feeling AI/dev conversation (slack DM, terminal log,
// PR review, error dump), blank one term, MC for which term fills the blank.
// This ties into jargon's "spotted in the wild" loop — the muscle of seeing
// jargon used naturally and clocking what it means.
//
// Operating principle (Kevin's words): "above all else, do not lie. do not
// hallucinate. teach accurate knowledge." Every claim in every snippet here
// must be defensibly true. A reader who works in the field should NOT spot
// an invented Anthropic feature, an invented OpenAI behavior, a fake stat,
// or a "could-be-multiple" blank.
//
// Stage A: hand-written, baked into source. Stage B (post-spec) moves these
// into a `transcripts` table on the term row (or a sidecar table) and lets
// the ingestion pipeline generate + verify them like the rest of the term
// content. The shape here is the wire shape — when the table lands, the
// payload structure stays the same so the card component doesn't change.

export interface Transcript {
  termId: string;
  /**
   * Short context label, e.g. "slack #ai-channel" or "claude code, tuesday
   * morning". Lowercase. Renders above the snippet in mono micro-text so the
   * reader knows what they're looking at before reading the lines.
   */
  contextLabel: string;
  /**
   * The transcript text itself. Multi-line via \n. Use exactly `___` (three
   * underscores) where the term is blanked — the card splits on this token
   * to render the highlighted blank-span. Lowercase, casual chat / terminal
   * voice. Don't use the term anywhere else in the snippet (that gives away
   * the answer).
   */
  snippet: string;
  /**
   * Four MC options. Index 0 always renders first in source order; the card
   * shuffles deterministically per-mount so the right answer doesn't always
   * land in the same slot. correctIndex points at the source-order option.
   */
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

// ─── content pool ────────────────────────────────────────────────────────────
//
// Five hand-written transcripts covering high-frequency-in-the-wild AI terms.
// Each picked to be (a) plausible voice, (b) factually accurate, and
// (c) unambiguously fillable by exactly one of the four options.
//
// Distractor selection rule: the three wrong options are TERMS THE USER
// COULD PLAUSIBLY KNOW (not invented words and not from a totally different
// domain). The discrimination has to come from understanding the term's
// MEANING in context, not from "which of these is real."

const TRANSCRIPTS: Transcript[] = [
  // ─── aid-context-window ───────────────────────────────────────────────────
  // Real claim: Gemini 2.x's context window is in the 1M-2M token range,
  // significantly larger than Claude's 200K and GPT-4's 128K. Practitioners
  // routinely switch tools for very long documents. The blank cannot be
  // "temperature" (sampling parameter, not a length constraint), "system
  // prompt" (per-request instructions, not what cuts a long doc off), or
  // "token cap" (not a real product term — informal at best, and the
  // standard term is "context window").
  {
    termId: 'aid-context-window',
    contextLabel: 'slack #eng — late afternoon',
    snippet:
      'maya: tried to get claude to summarize the whole 200-page filing\n' +
      'maya: it cut off halfway. think we hit the ___ limit\n' +
      'rohan: yeah, gemini handles the longer ones. switch tools for that one',
    options: ['context window', 'temperature', 'token cap', 'system prompt'],
    correctIndex: 0,
  },

  // ─── aid-rag ──────────────────────────────────────────────────────────────
  // Real claim: RAG (retrieval-augmented generation) is the standard pattern
  // for grounding a model's answers in your own documents — embed the docs,
  // retrieve the most relevant chunks at query time, stuff them into the
  // prompt. "Just paste the whole handbook every time" hits context-window
  // limits + costs scale linearly with prompt size, which is exactly why
  // teams reach for RAG. Distractors: "fine-tuning" is the OTHER common
  // approach (and a real debate — RAG vs fine-tune), but fine-tuning bakes
  // knowledge into model weights via training, which doesn't match "pulling
  // the right doc into context." "Prompt chaining" is multi-step LLM calls.
  // "Vector search" is a COMPONENT of RAG, but RAG is the named pattern;
  // "vector search" alone wouldn't include the generation step.
  {
    termId: 'aid-rag',
    contextLabel: 'product slack — planning the support bot',
    snippet:
      'dev: do we just paste the whole handbook into every prompt?\n' +
      'lead: that hits the context limit and costs a fortune. we want ___\n' +
      'lead: index the handbook, pull the relevant section per question, then answer',
    options: ['rag', 'fine-tuning', 'prompt chaining', 'vector search'],
    correctIndex: 0,
  },

  // ─── aid-fine-tuning ──────────────────────────────────────────────────────
  // Real claim: fine-tuning is the training-based approach to specializing
  // a model. You pay to train on a curated dataset of input/output examples
  // and the model adjusts its weights. OpenAI offers it on several models;
  // it's generally the right call when you need consistent style/format the
  // base model won't reliably produce from prompting alone. Distractors:
  // "few-shot prompting" is the prompt-only alternative (cheaper, no
  // training), "RAG" is for grounding in retrieved facts (not style), and
  // "distillation" is teacher-student model compression (different goal).
  // The dollar amount + "training set" + "thousand examples" is the giveaway
  // for fine-tuning specifically.
  {
    termId: 'aid-fine-tuning',
    contextLabel: 'slack #ml — tuesday morning',
    snippet:
      'priya: we keep telling the model to write in our brand voice but it drifts\n' +
      'priya: thinking we ___ on a thousand of our edited replies\n' +
      'sam: openai supports it. budget will be a few hundred bucks for the training run',
    options: ['fine-tune', 'few-shot prompt', 'rag-ify', 'distill'],
    correctIndex: 0,
  },

  // ─── aid-llm ──────────────────────────────────────────────────────────────
  // Real claim: "LLM" is the generic category — GPT, Claude, Gemini, Llama,
  // Mistral all are LLMs. When someone says "swap the LLM behind the agent"
  // they mean the underlying model the agent calls. Distractors are
  // adjacent but wrong: "API" is the interface, not the thing behind the
  // agent. "Vector store" is RAG infrastructure, not the reasoning engine.
  // "Tokenizer" is the text→tokens pre-processor, not what generates the
  // response. The "swap to claude / gpt / gemini" line forces the right
  // pick — only LLM names get swapped that way.
  {
    termId: 'aid-llm',
    contextLabel: 'standup notes — thursday',
    snippet:
      'eli: the agent is solid but the reasoning feels weak on edge cases\n' +
      'eli: easiest experiment is to swap the ___ behind it — try claude, gpt, gemini\n' +
      'mira: keep the prompts the same so we can compare apples-to-apples',
    options: ['llm', 'api', 'vector store', 'tokenizer'],
    correctIndex: 0,
  },

  // ─── aid-system-prompt ────────────────────────────────────────────────────
  // Real claim: the system prompt is the persistent up-front instruction
  // that shapes a model's behavior across a conversation — voice, format,
  // refusal rules, role definition. In claude code it's the CLAUDE.md file;
  // in the api it's the `system` field. Editing it is the standard knob
  // when an assistant is "drifting back to" a default behavior — that's
  // what system prompts are FOR. Distractors: "user prompt" is the per-
  // turn message, "context window" is the size limit (wrong frame), and
  // "few-shot example" is in-context examples within a turn (closer, but
  // not "the up-front instructions" — those examples live INSIDE the
  // system or user prompt, not as a separate type).
  {
    termId: 'aid-system-prompt',
    contextLabel: 'pr review — assistant changes',
    snippet:
      "reviewer: the assistant keeps reverting to bullet points even when we ask for prose\n" +
      "author: i'll tighten the ___ — add a line about preferring full paragraphs by default\n" +
      "reviewer: makes sense. that's the right place for a default like that",
    options: ['system prompt', 'user prompt', 'context window', 'few-shot example'],
    correctIndex: 0,
  },

  // ─── aid-token ────────────────────────────────────────────────────────────
  // Real claim: anthropic + openai bill per-token (input and output rates
  // listed separately on every pricing page). A token is roughly 0.75 of
  // an english word; the unit pricing is the literal line item on the
  // invoice. Distractors: "request" is wrong because a 100k-input call and
  // a 1k-input call get charged radically differently — billing is NOT
  // flat per-call. "Character" is wrong (the unit is tokens, not chars).
  // "Word" is wrong same reason — "0.75 of a word" is the rough conversion
  // BECAUSE the unit isn't words. The "input/output rate" detail forces
  // the right pick — only tokens have that asymmetric pricing structure.
  {
    termId: 'aid-token',
    contextLabel: 'slack #finance — month-end',
    snippet:
      'maya: anthropic bill jumped 3x this month\n' +
      'sam: we 10x-ed the prompt size when we added rag context\n' +
      'sam: each ___ is billed, input and output have different rates — so longer prompts hit hard',
    options: ['token', 'request', 'character', 'word'],
    correctIndex: 0,
  },

  // ─── aid-prompt ───────────────────────────────────────────────────────────
  // Real claim: prompt iteration / prompt engineering is the standard
  // workflow when output quality is off — change the wording, add
  // examples, restructure the instruction, retest. The "rewrote it three
  // times this morning" + "what we ask the model" pattern is unmistakable.
  // Distractors: "model" is wrong because swapping the model is a
  // different lever (heavier, slower iteration loop). "Dataset" is for
  // training/fine-tuning. "Function" is for tool-use schemas. The phrase
  // "what we ask" + iterative rewriting in a morning maps to prompt only.
  {
    termId: 'aid-prompt',
    contextLabel: 'slack #ai-team — wednesday',
    snippet:
      "rohan: the summaries are still missing the action items\n" +
      "priya: rewrote the ___ three times this morning. adding an explicit 'list every action item' line helped\n" +
      "rohan: nice. iterating on what we ask the model is faster than swapping the model itself",
    options: ['prompt', 'model', 'dataset', 'function'],
    correctIndex: 0,
  },

  // ─── aid-agent ────────────────────────────────────────────────────────────
  // Real claim: an agent is an llm-driven loop that picks tools, calls
  // them, reads the results, and decides the next step toward a goal —
  // the defining property is autonomous tool-use in a loop, not just a
  // single llm call. Searching docs, drafting, then posting to a ticket
  // is exactly that pattern. Distractors: "chatbot" is single-turn
  // conversational, no tool loop. "pipeline" is a fixed deterministic
  // sequence (the model doesn't decide steps). "function" is a single
  // unit of execution. The "decides what to call next" framing forces
  // agent specifically.
  {
    termId: 'aid-agent',
    contextLabel: 'standup notes — monday',
    snippet:
      "eli: the support ___ now searches docs, drafts a reply, then posts to the ticket\n" +
      "eli: it picks which tool to call next based on what it found, not a fixed sequence\n" +
      "mira: nice. that's the whole point of the loop",
    options: ['agent', 'chatbot', 'pipeline', 'function'],
    correctIndex: 0,
  },

  // ─── aid-temperature ──────────────────────────────────────────────────────
  // Real claim: temperature controls sampling randomness — lower (0-0.3)
  // is more deterministic / consistent, higher (0.7-1.0+) is more varied
  // / creative. For brainstorming you nudge it up; for structured
  // extraction you set it to 0 or near-0. This is anthropic + openai api
  // standard parameter. Distractors: "top_p" is also a sampling parameter
  // BUT it's nucleus sampling (probability mass cutoff), not the
  // creativity dial people reach for first — and the snippet says "knob"
  // singular and "more varied" which is the textbook temperature framing.
  // "max_tokens" is length, not creativity. "system prompt" is
  // instructions, not a numeric knob. Only temperature is THE creativity
  // dial in casual usage.
  {
    termId: 'aid-temperature',
    contextLabel: 'slack #ai-channel',
    snippet:
      "dev: outputs feel super samey when we ask for brainstorm ideas\n" +
      "lead: bump the ___ up to 0.9 for that endpoint, keep it at 0 for the structured extraction one\n" +
      "dev: makes sense. one knob, two different jobs",
    options: ['temperature', 'top_p', 'max_tokens', 'system prompt'],
    correctIndex: 0,
  },

  // ─── aid-vector-database ──────────────────────────────────────────────────
  // Real claim: rag infrastructure stores document embeddings in a vector
  // database (pinecone, weaviate, qdrant, pgvector, etc.). At query time
  // you embed the query and do a similarity search — that IS what a
  // vector database is for. Pinecone is the prototypical hosted one; the
  // "self-host pgvector vs pinecone" tradeoff is a real ongoing eng debate
  // in 2025-2026. Distractors: "graph database" is for relationship
  // traversal (neo4j etc.), not embedding similarity. "key-value store"
  // (redis) doesn't do similarity search natively. "data warehouse"
  // (snowflake/bigquery) is olap analytics, not low-latency embedding
  // lookup. The "embeddings" + "similarity search" detail forces vector
  // database specifically.
  {
    termId: 'aid-vector-database',
    contextLabel: 'slack #infra — friday',
    snippet:
      "sam: we need somewhere to store the doc embeddings for rag\n" +
      "maya: pinecone or self-host pgvector. either way it's a ___\n" +
      "sam: right — we just need fast similarity search at query time",
    options: ['vector database', 'graph database', 'key-value store', 'data warehouse'],
    correctIndex: 0,
  },

  // ─── aid-hallucination ────────────────────────────────────────────────────
  // Real claim: a hallucination is when an llm generates plausible-
  // sounding output that's factually wrong — invented citations, invented
  // case law, invented apis, invented paper titles. The legal-research
  // bug-report frame is real: lawyers have been sanctioned for filing
  // briefs with fake citations from chatgpt. "Looks real, doesn't exist"
  // is the textbook definition. Distractors: "regression" is a model
  // performance dropping across a release (a bug TYPE, but not this one).
  // "false positive" is classifier terminology, not generative output.
  // "drift" is data/distribution shift over time. The "made up the case
  // entirely" detail is a hallucination, full stop.
  {
    termId: 'aid-hallucination',
    contextLabel: 'qa ticket — legal research bot',
    snippet:
      "tester: the bot cited 'smith v jones 2019' as precedent. that case doesn't exist\n" +
      "tester: it made up the citation, judge, and quote — classic ___\n" +
      "eng: yeah. we need to add a citation-verifier pass before it returns anything",
    options: ['hallucination', 'regression', 'false positive', 'drift'],
    correctIndex: 0,
  },

  // ─── aid-streaming ────────────────────────────────────────────────────────
  // Real claim: streaming sends tokens to the client as they're generated
  // (server-sent events / sse in anthropic + openai apis), instead of
  // waiting for the full response. Perceived latency is dramatically
  // better — users see the first token in <1s even when the full response
  // takes 20s. This is exactly the chatgpt typewriter effect. Distractors:
  // "caching" is reusing prior responses (different problem). "batching"
  // is grouping requests (server-side, slower not faster for one user).
  // "pagination" is for chunked LIST results, not generative output.
  // The "watch the response come in word by word" pattern only fits
  // streaming.
  {
    termId: 'aid-streaming',
    contextLabel: 'design review — chat ui',
    snippet:
      "designer: users bounce when the response takes 15s. the loading spinner kills it\n" +
      "dev: turn on ___ — they'll watch the response come in word by word, feels instant\n" +
      "designer: yes. perceived latency is what matters",
    options: ['streaming', 'caching', 'batching', 'pagination'],
    correctIndex: 0,
  },

  // ─── aid-multimodal ───────────────────────────────────────────────────────
  // Real claim: multimodal models accept inputs beyond text — images,
  // audio, video, pdfs — in the same prompt. Claude (3+ and 4+) and gpt-4o
  // both support image input alongside text. "Drag a screenshot in" is
  // the canonical multimodal use case. Distractors: "fine-tuned" is the
  // training-customization concept (orthogonal to input modalities).
  // "Open-source" is licensing/availability (orthogonal). "Quantized" is
  // weights compression for inference (orthogonal). Only multimodal
  // describes "accepts images alongside text."
  {
    termId: 'aid-multimodal',
    contextLabel: 'slack #design-eng',
    snippet:
      "designer: can users upload a screenshot of their dashboard and have the model explain what's wrong?\n" +
      "pm: only if we use a ___ model — claude and gpt-4o both take images alongside text\n" +
      "designer: perfect. images are the unlock here",
    options: ['multimodal', 'fine-tuned', 'open-source', 'quantized'],
    correctIndex: 0,
  },

  // ─── aid-deep-research ────────────────────────────────────────────────────
  // Real claim: "deep research" is the named product mode in chatgpt
  // (released 2025) and the workflow pattern in claude where the model
  // spends meaningfully longer (5-30+ min), runs many tool calls / web
  // searches, and produces a long synthesized report. It's the right
  // call for "comprehensive market scan with citations" — that's
  // literally the use case it's marketed for. Distractors: "quick chat"
  // is single-turn casual. "code interpreter" is sandboxed python
  // execution (different mode). "image generation" is dalle/etc. The
  // "20+ minutes" + "scan dozens of sources" detail uniquely matches
  // deep research.
  {
    termId: 'aid-deep-research',
    contextLabel: 'slack #strategy — tuesday',
    snippet:
      "lead: i need a full landscape scan on competitor pricing across 30 vendors with citations\n" +
      "researcher: that's a ___ job — it'll spend 20+ minutes, hit dozens of sources, return a real report\n" +
      "lead: perfect. kick it off, i'll grab coffee",
    options: ['deep research', 'quick chat', 'code interpreter', 'image generation'],
    correctIndex: 0,
  },

  // ─── aid-evals ────────────────────────────────────────────────────────────
  // Real claim: evals (evaluations) are test suites for llm output —
  // graded automatically (or with judge models / humans) on a fixed
  // dataset of inputs + expected outputs. You run them on every prompt
  // change, every model swap, every release. This is THE standard ml/llm
  // pre-deploy gate. Distractors: "benchmarks" is closer (and overlapping
  // in casual usage) but typically means published academic suites
  // (mmlu, humaneval) — not "our internal test suite of 200 cases." The
  // snippet's "our 200 case suite" + "before we ship" forces evals
  // specifically. "Unit tests" is code-level testing (not output
  // grading). "Linter" is static analysis. Evals is the named pattern
  // for "did our prompt change make outputs better or worse."
  {
    termId: 'aid-evals',
    contextLabel: 'slack #ml — pre-release',
    snippet:
      "priya: prompt change looked good in spot-checking\n" +
      "rohan: ran the ___ — accuracy on our 200-case suite went from 82 to 87\n" +
      "priya: ship it. spot-check is no substitute for the full suite",
    options: ['evals', 'benchmarks', 'unit tests', 'linter'],
    correctIndex: 0,
  },

  // ─── aid-mcp ──────────────────────────────────────────────────────────────
  // Real claim: mcp (model context protocol) is the open standard
  // anthropic introduced in late 2024 for connecting llms to tools / data
  // sources. An mcp server exposes tools/resources and the host (claude
  // desktop, claude code, cursor, etc.) calls them. "Standing up an mcp
  // server" so claude can hit your internal api is the textbook adoption
  // pattern. Distractors: "rest api" is what your internal tool already
  // exposes — the question is what wraps/exposes it TO claude. A direct
  // rest call from claude code is also possible but the named pattern
  // for tool-integration is mcp. "Webhook" is async event push (wrong
  // direction). "Cron job" is scheduled execution (wrong concept). The
  // "expose a tool to claude" framing forces mcp.
  {
    termId: 'aid-mcp',
    contextLabel: 'slack #platform — integration planning',
    snippet:
      "dev: how do we let claude query our internal incident api?\n" +
      "lead: stand up an ___ server in front of it. claude code + claude desktop both speak it\n" +
      "dev: nice. one wrapper, every host gets the tool",
    options: ['mcp', 'rest api', 'webhook', 'cron job'],
    correctIndex: 0,
  },

  // ─── aid-chain-of-thought ─────────────────────────────────────────────────
  // Real claim: chain-of-thought (cot) is the pattern of having the model
  // produce intermediate reasoning steps before its final answer. It
  // measurably improves performance on multi-step problems (math, logic,
  // multi-hop questions). When debugging "the model's getting it wrong"
  // on a multi-step task, asking it to "show its work" / "think step by
  // step" before answering is the standard fix. Anthropic's extended-
  // thinking / reasoning models do this internally. Distractors: "few-
  // shot" gives examples (different lever, also useful, but doesn't
  // produce intermediate reasoning at runtime). "Self-consistency" is
  // the related pattern of sampling multiple cot traces and voting —
  // closely related but a separate technique. "Top-k" is sampling
  // parameter. The "show its work step by step" framing is cot exactly.
  {
    termId: 'aid-chain-of-thought',
    contextLabel: 'pr review — math tutor agent',
    snippet:
      "reviewer: it gets the final answer wrong on word problems half the time\n" +
      "author: added ___ prompting — asks it to show its work step by step before the final answer\n" +
      "reviewer: that should fix the multi-step ones. accuracy was the obvious win",
    options: ['chain-of-thought', 'few-shot', 'self-consistency', 'top-k'],
    correctIndex: 0,
  },

  // ─── coding domain ─────────────────────────────────────────────────────────
  //
  // Ten transcripts spanning the seven coding paths (git-cli, dev-concepts,
  // claude-code, agile, systems, enterprise). Same accuracy + ambiguity bar
  // as the ai-domain set above: every claim in every snippet is defensibly
  // true, and the blank has exactly one fillable answer given the context.
  // Distractors are adjacent real terms a learner could plausibly know —
  // never invented words, never from a wildly different domain.

  // ─── git-merge ────────────────────────────────────────────────────────────
  // Real claim: when two branches changed the same lines differently, git
  // can't auto-reconcile and you get a merge conflict — the conflicted file
  // gets `<<<<<<<` / `=======` / `>>>>>>>` markers and you fix it by hand,
  // then commit. The terminal output here is the literal git CLI message
  // ("Automatic merge failed; fix conflicts and then commit the result.").
  // Distractors: "rebase" is a separate operation (replays commits onto a
  // new base) — and importantly, the snippet shows the operation that just
  // failed, which was a merge attempt; rebase would have produced "could
  // not apply" wording. "Cherry-pick" copies one specific commit onto the
  // current branch — different command, different verb. "Stash" temporarily
  // shelves uncommitted changes — has nothing to do with two-branch
  // reconciliation. The "automatic ___ failed" phrasing forces merge.
  {
    termId: 'git-merge',
    contextLabel: 'terminal — wednesday afternoon',
    snippet:
      'maya: $ git merge feature/auth\n' +
      'maya: > auto-merging src/login.tsx\n' +
      'maya: > conflict (content): ___ conflict in src/login.tsx\n' +
      "maya: ugh. fixing it by hand now",
    options: ['merge', 'rebase', 'cherry-pick', 'stash'],
    correctIndex: 0,
  },

  // ─── git-pr ───────────────────────────────────────────────────────────────
  // Real claim: a pull request (PR) is the github/gitlab proposal-to-merge
  // unit — bundles up commits on a branch, opens a review thread, lets
  // teammates leave inline comments, and gates the merge on approval. The
  // snippet's "left two comments" + "request changes vs approve" is the
  // exact PR review UX. Distractors: "issue" is a github issue (bug/feature
  // tracking — no code attached, no merge gate). "commit" is the unit of
  // saved change but doesn't host review (you review commits INSIDE a PR).
  // "fork" is a personal copy of a repo (the prerequisite for an
  // outside-contributor PR but not the review object itself). The "please
  // take a look" + inline comments + "merge it" sequence forces PR.
  {
    termId: 'git-pr',
    contextLabel: 'slack #eng — thursday morning',
    snippet:
      "rohan: opened a ___ for the rate-limit fix — please take a look\n" +
      "priya: left two comments on the retry logic. otherwise lgtm\n" +
      "rohan: addressed both. green checks, going to merge it",
    options: ['pr', 'issue', 'commit', 'fork'],
    correctIndex: 0,
  },

  // ─── dev-api ──────────────────────────────────────────────────────────────
  // Real claim: an API is the contract between two pieces of software —
  // "send this kind of request, get this kind of response." Rate limits,
  // request/response shape, and auth are core API concerns. Stripe's API
  // really does enforce rate limits (100 read/sec in live mode by default
  // per their public docs); that's a textbook example of a third-party API
  // boundary. Distractors: "sdk" is a client library that WRAPS an API —
  // not the contract itself (you can hit an API without an sdk). "webhook"
  // is the reverse direction (server pushes events to YOU) — wrong
  // direction for "we hit X". "cli" is a command-line tool — not what an
  // app talks to over HTTP. The "rate-limited" + "we hit" + "their" framing
  // forces API.
  {
    termId: 'dev-api',
    contextLabel: 'slack #payments — friday',
    snippet:
      "sam: invoices are timing out at the end of the month\n" +
      "eli: we're hitting stripe's ___ too hard during batch runs\n" +
      "eli: their rate limit is 100 reads a second — we need to throttle our retries",
    options: ['api', 'sdk', 'webhook', 'cli'],
    correctIndex: 0,
  },

  // ─── cc-claude-md ─────────────────────────────────────────────────────────
  // Real claim: CLAUDE.md is the markdown file at the root of a project (or
  // ~/.claude/CLAUDE.md for global rules) that Claude Code reads at session
  // start and injects into the system prompt. It's the canonical place for
  // project conventions, voice rules, "never do X." When Claude keeps
  // making the same mistake every session, the fix is to write the rule
  // INTO the file so it ships with every future session. Distractors:
  // "settings.json" is the harness config — permissions, hooks, env — not
  // the place for prose conventions. "README.md" is for human readers
  // (project intro, install steps); claude code does not auto-read it as
  // system-prompt context. "package.json" is npm metadata. The "writes it
  // into the system prompt every session" detail forces CLAUDE.md.
  {
    termId: 'cc-claude-md',
    contextLabel: 'claude code, friday',
    snippet:
      "kev: claude keeps using inter instead of plex sans across sessions\n" +
      "dev: add the rule to the project's ___ — claude code reads it at every session start\n" +
      "kev: right, that writes it into the system prompt every time. fixing it forever",
    options: ['CLAUDE.md', 'settings.json', 'README.md', 'package.json'],
    correctIndex: 0,
  },

  // ─── cc-mcp ───────────────────────────────────────────────────────────────
  // Real claim: MCP (Model Context Protocol) is anthropic's open standard
  // (released nov 2024) for connecting AI assistants to external tools and
  // data sources. An MCP server exposes tools/resources; the host (claude
  // code, claude desktop, cursor, zed) calls them over the protocol. Once
  // you stand up an MCP server, EVERY MCP-speaking host can use it — the
  // "one wrapper, every host" framing is the explicit selling point.
  // Distractors: "rest api" is the underlying HTTP contract style — but
  // "claude code + cursor + claude desktop all speak it" is specifically
  // about the MCP standard, not about REST in general. "graphql" is a
  // query-language for APIs (also a transport, also unrelated to AI
  // tool-calling). "soap" is a legacy XML protocol. The "open standard…
  // every AI host speaks it" framing is MCP exactly.
  {
    termId: 'cc-mcp',
    contextLabel: 'slack #platform — integration sync',
    snippet:
      "lead: we want every ai assistant on the team to query our internal incident tracker\n" +
      "dev: stand up an ___ server in front of it once. claude code, cursor, claude desktop all speak it\n" +
      "lead: nice. open standard, every host gets the tool for free",
    options: ['mcp', 'rest', 'graphql', 'soap'],
    correctIndex: 0,
  },

  // ─── agile-standup ────────────────────────────────────────────────────────
  // Real claim: a standup (daily scrum) is a 10-15 min daily sync where
  // each person says yesterday/today/blockers. Held same time every
  // weekday. The "i'll bring it up at ___ tomorrow" + "10am" cadence is
  // textbook standup. Distractors: "retro" is the end-of-sprint reflection
  // meeting (every 1-4 weeks, not daily). "demo" is the sprint review /
  // showcase (also end of sprint). "1:1" is a manager-direct private
  // meeting (different shape, different participants). The "morning
  // every day at 10" detail forces standup.
  {
    termId: 'agile-standup',
    contextLabel: 'slack dm — tuesday evening',
    snippet:
      "mira: hit a snag on the search index, will probably slip past friday\n" +
      "lead: bring it up at ___ tomorrow morning at 10 — see if anyone has bandwidth to pair\n" +
      "mira: yeah, it's the right place to surface it before it becomes a real problem",
    options: ['standup', 'retro', 'demo', '1:1'],
    correctIndex: 0,
  },

  // ─── agile-blocker ────────────────────────────────────────────────────────
  // Real claim: a blocker is anything stopping a ticket from moving — a
  // pending decision, a broken dependency, an unanswered question. The
  // standup format explicitly asks for blockers; the SM/EM is supposed to
  // chase them down. "Can't finish until X lands" is the classic
  // dependency-blocker shape. Distractors: "bug" is a defect IN code
  // (different category — a bug is what you're tracking, not what's
  // stopping you). "sprint" is the time window (wrong category — a sprint
  // doesn't stop work, things WITHIN it do). "ticket" is the unit of work
  // itself (the thing being blocked, not the block). The "waiting on
  // design" + "can't finish until" framing forces blocker.
  {
    termId: 'agile-blocker',
    contextLabel: 'standup notes — tuesday',
    snippet:
      "rohan: yesterday — finished the auth refactor pr\n" +
      "rohan: today — would start the checkout flow but i'm a ___, waiting on design for the empty state\n" +
      "sm: i'll chase mira on it after this so you're unstuck by noon",
    options: ['blocker', 'bug', 'sprint', 'ticket'],
    correctIndex: 0,
  },

  // ─── sys-load-balancer ────────────────────────────────────────────────────
  // Real claim: a load balancer sits in front of a pool of servers,
  // distributes incoming requests across them, and uses health checks to
  // skip dead nodes. When health checks misfire and the LB sends ALL
  // traffic to one node, that node gets crushed — a real and common
  // incident shape. Distractors: "cdn" is a globally-distributed cache for
  // static assets, not a request distributor across an origin pool.
  // "proxy" is broader (any intermediary that forwards requests) — but
  // the snippet is specifically about distributing across a pool with
  // health checks, which is the LB's job. "dns" resolves names to IPs
  // (different layer entirely — runs once at request start, not on every
  // request). The "all traffic to one node" + "health checks" detail
  // forces load balancer.
  {
    termId: 'sys-load-balancer',
    contextLabel: 'incident-chat — 3am',
    snippet:
      "ops: node-3 is at 100% cpu, the other two are idle\n" +
      "sre: ___ is sending everything to node-3. health checks are failing on the other two for some reason\n" +
      "ops: so the pool is technically up but we're acting like a single server. fix the checks first",
    options: ['load balancer', 'cdn', 'proxy', 'dns'],
    correctIndex: 0,
  },

  // ─── sys-cache ────────────────────────────────────────────────────────────
  // Real claim: a cache stores results of expensive work so future requests
  // can grab the answer instantly. The classic "deployed but the change
  // isn't showing up" + "stale data" symptom is almost always a cache
  // serving an old entry past when the underlying data changed
  // (cache-invalidation problem — famously hard). Bypassing the cache or
  // explicitly purging it is the textbook fix. Distractors: "session" is
  // per-user state, not a shared result store. "cookie" is browser-side
  // tiny state, not server-side computed-result storage. "log" is
  // append-only event history — has nothing to do with serving stale
  // data. The "stale" + "invalidate" + "ttl" detail forces cache.
  {
    termId: 'sys-cache',
    contextLabel: 'pr review — perf work',
    snippet:
      "reviewer: dashboard numbers are stale for a couple minutes after a write\n" +
      "author: the ___ has a 5-min ttl on the leaderboard query — that's the lag you're seeing\n" +
      "reviewer: makes sense. invalidate on write or shorten the ttl, depending on how fresh we need it",
    options: ['cache', 'session', 'cookie', 'log'],
    correctIndex: 0,
  },

  // ─── ent-jira ─────────────────────────────────────────────────────────────
  // Real claim: JIRA is atlassian's enterprise ticket-tracking tool. Every
  // piece of work at most large companies gets a JIRA number — a stable
  // ID like ABC-1234 that points to one ticket with assignee, status,
  // and history. "What's the JIRA number?" is the literal question every
  // enterprise pm/em asks before a piece of work is real. Distractors:
  // "confluence" is also atlassian — but it's the WIKI for long-form docs,
  // not the ticket tracker (no ABC-1234 ID per page). "slack" is messaging
  // (no ticket IDs). "github" tracks code+issues but enterprises typically
  // use it for PRs and keep the work-tracking source-of-truth in JIRA.
  // The "ticket number" + "assigned to" framing forces JIRA.
  {
    termId: 'ent-jira',
    contextLabel: 'slack #pm — monday',
    snippet:
      "pm: can you take a look at the dashboard sort order bug?\n" +
      "dev: sure — what's the ___ number?\n" +
      "pm: ABC-4521. assigned it to you, in the current sprint",
    options: ['JIRA', 'Confluence', 'Slack', 'GitHub'],
    correctIndex: 0,
  },

  // ─── git-worktree ────────────────────────────────────────────────────────
  {
    termId: 'git-worktree',
    contextLabel: 'agent handoff — branch juggling',
    snippet:
      "agent: current PR has uncommitted layout edits\n" +
      "agent: i'll create a ___ for the stack branch so i can run both versions side by side\n" +
      "kev: good. don't lose the current diff",
    options: ['worktree', 'stash', 'fork', 'tag'],
    correctIndex: 0,
  },

  // ─── dev-typecheck ───────────────────────────────────────────────────────
  {
    termId: 'dev-typecheck',
    contextLabel: 'terminal — before build',
    snippet:
      "agent: running tsc before vite build\n" +
      "agent: the ___ caught a prop shape mismatch in version-pill.tsx\n" +
      "kev: nice, fix the type first and then look at the screen",
    options: ['typecheck', 'smoke test', 'webhook', 'deployment alias'],
    correctIndex: 0,
  },

  // ─── dev-monorepo ────────────────────────────────────────────────────────
  {
    termId: 'dev-monorepo',
    contextLabel: 'repo tour — product ecosystem',
    snippet:
      "agent: this folder has apps, shared packages, and registry scripts all near each other\n" +
      "agent: that's a ___ shape, so changes in one package can affect several apps\n" +
      "kev: right, scout read-only before copying anything",
    options: ['monorepo', 'fork', 'cdn', 'queue'],
    correctIndex: 0,
  },

  // ─── ent-stack-preview ───────────────────────────────────────────────────
  {
    termId: 'ent-stack-preview',
    contextLabel: 'pr review — combined branch',
    snippet:
      "kev: keep the PRs separate, but i want one link for how they feel together\n" +
      "agent: i'll make a ___ that merges the review branches into one deployed surface\n" +
      "kev: exactly. that is the thing i need to click",
    options: ['stack preview', 'draft PR', 'release tag', 'smoke test'],
    correctIndex: 0,
  },

  // ─── ent-preview-deployment ──────────────────────────────────────────────
  {
    termId: 'ent-preview-deployment',
    contextLabel: 'github pr — checks finished',
    snippet:
      "agent: tests passed locally, but this needs eyes in a real browser\n" +
      "agent: the ___ is live now, open it on mobile before merge\n" +
      "kev: good. code green is not visual green",
    options: ['preview deployment', 'typecheck', 'migration', 'context window'],
    correctIndex: 0,
  },

  // ─── ent-deployment-alias ────────────────────────────────────────────────
  {
    termId: 'ent-deployment-alias',
    contextLabel: 'vercel review — link drift',
    snippet:
      "agent: the raw deployment URL changed after the latest push\n" +
      "agent: updating the ___ so the PR link points at the current build\n" +
      "kev: yes. i don't want to review yesterday's version by accident",
    options: ['deployment alias', 'worktree', 'acceptance criteria', 'RLS policy'],
    correctIndex: 0,
  },

  // ─── cc-handoff ──────────────────────────────────────────────────────────
  {
    termId: 'cc-handoff',
    contextLabel: 'session end — clean pause',
    snippet:
      "agent: branch is pushed, pre-deploy passed, actions are failing from billing only\n" +
      "agent: writing a ___ with files changed, validation, and next steps\n" +
      "kev: perfect. next agent should not have to dig for all that",
    options: ['handoff', 'cherry-pick', 'benchmark', 'cache'],
    correctIndex: 0,
  },

  // ─── cc-compaction ───────────────────────────────────────────────────────
  {
    termId: 'cc-compaction',
    contextLabel: 'codex resume — long thread',
    snippet:
      "agent: i resumed from a summary instead of the whole chat\n" +
      "agent: after ___, i'll verify git state before trusting any remembered detail\n" +
      "kev: yes. newest instruction wins",
    options: ['compaction', 'squash', 'codegen', 'standup'],
    correctIndex: 0,
  },

  // ─── agile-visual-qa ─────────────────────────────────────────────────────
  {
    termId: 'agile-visual-qa',
    contextLabel: 'mobile screenshot review',
    snippet:
      "kev: the build can pass and still be painful to look at\n" +
      "agent: agreed. i'm doing ___ on mobile: spacing, wrapping, alignment, and empty space\n" +
      "kev: start there. treat it like an app",
    options: ['visual QA', 'RLS', 'model routing', 'codegen'],
    correctIndex: 0,
  },

  // ─── agile-regression-test ───────────────────────────────────────────────
  {
    termId: 'agile-regression-test',
    contextLabel: 'pr comment — old bug returned',
    snippet:
      "reviewer: we fixed the footer padding last week, and now it collapsed again\n" +
      "author: i'll add a ___ around the spacing so this bug has a gate next time\n" +
      "reviewer: good. make the memory executable",
    options: ['regression test', 'draft PR', 'deployment alias', 'agent loop'],
    correctIndex: 0,
  },

  // ─── sys-rls ─────────────────────────────────────────────────────────────
  {
    termId: 'sys-rls',
    contextLabel: 'supabase debug — empty rows',
    snippet:
      "agent: auth session exists and the row is in the table\n" +
      "agent: checking ___ next; the policy may be hiding it from this user\n" +
      "kev: that sounds like the right layer",
    options: ['RLS', 'CDN', 'cron', 'squash'],
    correctIndex: 0,
  },

  // ─── sys-idempotent ──────────────────────────────────────────────────────
  {
    termId: 'sys-idempotent',
    contextLabel: 'migration review — safe rerun',
    snippet:
      "reviewer: what happens if the SQL gets pasted twice in the dashboard?\n" +
      "author: it is ___; on conflict does nothing, so the second run leaves the same state\n" +
      "reviewer: good. retries happen",
    options: ['idempotent', 'multimodal', 'monorepo', 'preview-only'],
    correctIndex: 0,
  },

  // ─── sys-edge-function ───────────────────────────────────────────────────
  {
    termId: 'sys-edge-function',
    contextLabel: 'architecture note — personalization',
    snippet:
      "agent: the browser should not call the model with secrets directly\n" +
      "agent: send the request to an ___, validate it there, then write the result\n" +
      "kev: right. frontend asks, backend does the trusted part",
    options: ['Edge Function', 'iframe', 'deployment alias', 'worktree'],
    correctIndex: 0,
  },
];

// ─── lookup helpers ──────────────────────────────────────────────────────────
//
// Index built once at module load. Mirrors the `xworld.ts` / `spotted-matcher`
// pattern — pure module-level state, no React, callable from anywhere.

const TRANSCRIPTS_BY_TERM_ID: Record<string, Transcript> = TRANSCRIPTS.reduce(
  (acc, t) => {
    acc[t.termId] = t;
    return acc;
  },
  {} as Record<string, Transcript>,
);

/**
 * Does this term have a hand-written transcript available?
 *
 * Used by `pickQuizType` in lesson-engine: only rotates 'transcript' into
 * the lineup when the answer is yes. For terms without one, the picker
 * falls back to the next non-transcript card type so the user never sees
 * a blank/error card.
 */
export function hasTranscript(termId: string): boolean {
  return termId in TRANSCRIPTS_BY_TERM_ID;
}

/**
 * Fetch the transcript for a term. Returns null when none exists — callers
 * that already gated on `hasTranscript` can `!` the result, but the null
 * return keeps the type honest for any future caller that didn't gate.
 */
export function getTranscript(termId: string): Transcript | null {
  return TRANSCRIPTS_BY_TERM_ID[termId] ?? null;
}

/**
 * Set of term ids that have a transcript authored. Used by lesson-engine's
 * `pickQuizType` to decide whether to rotate transcript into the mix for
 * a given term — terms without one fall back to the existing 5/6-type
 * rotation so the user never sees a blank transcript card.
 *
 * Mirrors the `eligibleScenarioTermIds` pattern in `scenario-content.ts`
 * so the picker has a single shape to consume across the two
 * eligibility-gated card types.
 */
export const eligibleTranscriptTermIds: ReadonlySet<string> = new Set(
  TRANSCRIPTS.map((t) => t.termId),
);

/**
 * Test-only export — lets `transcript-content.test.ts` (when added) iterate
 * the full pool and assert structural invariants (each snippet contains
 * exactly one `___`, no option matches another option, etc.) without
 * re-importing the array shape.
 */
export const ALL_TRANSCRIPTS: readonly Transcript[] = TRANSCRIPTS;
