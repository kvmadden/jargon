-- Jargon Stage B3 — 27 more curated anchor terms for the claude-code path
-- All difficulty 1, all curated, reviewed by the curator on 2026-05-04.
-- Voice matches the existing 3 claude-code anchors (cc-claude-code /
-- cc-agent / cc-slash-command template) — name what Claude Code does with
-- the thing, ground "why_it_matters" in literally watching Claude Code do
-- it in the terminal RIGHT NOW or talking to dev family.
--
-- Idempotent: `on conflict (id) do nothing` so re-runs don't fail and don't
-- overwrite anything an upstream cloud migration already inserted.
--
-- Dictionary count after this migration:
--   claude-code: 3 → 30  (3 existing + 27 new)
--   total:       102 → 129
--
-- Distractor strategy: each row's three distractors describe OTHER Claude
-- Code concepts (or adjacent dev tooling) so a half-knowledgeable learner
-- can be tricked. For example, cc-mcp's distractors describe a slash
-- command, an agent, and a hook — all real Claude Code things, none of
-- which are MCP.
--
-- Cross-references: every related_terms / prerequisites / stretch_term id
-- resolves to one of the existing 102 anchors or one of these 27. Rich
-- internal cross-linking inside the path:
--   • cc-mcp ↔ cc-mcp-server ↔ cc-mcp-client (the MCP family)
--   • cc-bash-tool ↔ cc-file-tools ↔ cc-search-tools ↔ cc-web-tools (built-in tools)
--   • cc-task-tool → cc-subagent → cc-agent (Task spawns subagents)
--   • cc-claude-md → cc-memory → cc-system-prompt (persistence + context)
--   • cc-permission-mode → cc-permissions → cc-plan-mode (safety + control)
--   • cc-plugin → cc-skill / cc-mcp-server / cc-hook (plugins bundle these)
--   • cc-token → cc-context-window → cc-caching (cost + performance)
--   • cc-todowrite ↔ cc-askuserquestion (interactive tools)

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── claude-code: subagents & delegation (3) ──────────────────
('cc-subagent', 'subagent', null, 'claude-code', 1,
 'A specialized Claude that the main Claude spawns mid-task to handle a focused job in its own context.',
 'When Claude Code needs to do something focused — review code, run tests, take screenshots — it can spawn a subagent: a fresh Claude instance with its own system prompt and tool set, running in its own isolated context window. The main Claude waits for the subagent to finish, then reads its summary back. Saves context and gets sharper results than asking the main Claude to do everything.',
 'Spawning a subagent for code review — back in a sec.',
 'Every time Claude Code says "spawning subagent for X" or "the code-reviewer agent reports back," that''s a subagent. Knowing the term means you understand why your context doesn''t fill up with all the intermediate work.',
 ARRAY['cc-agent','cc-task-tool','cc-context-window']::text[],
 ARRAY['cc-agent']::text[],
 'cc-task-tool',
 ARRAY[
   'A slash command that resets the conversation',
   'A pre-built shortcut for a common shell command',
   'A background process that watches files for changes'
 ]::text[],
 'Spawning a ___ for code review — back in a sec.',
 'Use ''subagent'' in a sentence about Claude Code spawning a focused helper.',
 'curated', 'curator', '2026-05-04'),

('cc-tool-use', 'tool use / tool call', null, 'claude-code', 1,
 'When the model decides to call one of its available tools (Read, Bash, Edit, etc.) instead of just replying with text.',
 'Tool use is the moment the LLM stops generating text and instead invokes a function — read a file, run a command, search the web. Claude Code is built around this loop: Claude thinks, calls a tool, reads the result, thinks again. Every "Reading file..." or "Running command..." line in your terminal is a tool call.',
 'You''ll see a lot of tool use in the next few steps — I need to read three files before editing.',
 'Almost everything Claude Code does on your machine happens through tool use. Recognizing each line of terminal output as "Claude is calling a tool" makes the whole loop legible instead of magical.',
 ARRAY['cc-bash-tool','cc-file-tools','cc-task-tool']::text[],
 ARRAY['cc-claude-code']::text[],
 null,
 ARRAY[
   'A user typing a command directly into the terminal',
   'A unit test exercising a function in isolation',
   'A keyboard shortcut that triggers an editor action'
 ]::text[],
 'You''ll see a lot of ___ in the next few steps — I need to read three files before editing.',
 'Use ''tool use'' or ''tool call'' in a sentence about Claude invoking one of its tools.',
 'curated', 'curator', '2026-05-04'),

('cc-task-tool', 'Task tool', null, 'claude-code', 1,
 'The built-in tool Claude Code uses to spawn a subagent and hand it a focused job.',
 'The Task tool is how the main Claude actually launches a subagent. It takes a description, an agent type (like ''code-reviewer''), and a prompt — then runs that subagent in an isolated context and returns the summary. If you ever see Claude Code say "Task(code-reviewer)" in the terminal, that''s a literal Task tool call.',
 'I''m firing the Task tool to send the changed files over to code-reviewer.',
 'Whenever your Madden Team agents (ui-designer, qa-tester, visual-qa) get invoked, the main Claude is using the Task tool to spawn them. Knowing the term connects "the agent ran" to a specific mechanism.',
 ARRAY['cc-subagent','cc-agent','cc-tool-use']::text[],
 ARRAY['cc-tool-use','cc-agent']::text[],
 null,
 ARRAY[
   'A todo list for tracking in-progress work',
   'A scheduling system that runs jobs at fixed times',
   'A shortcut for invoking a custom slash command'
 ]::text[],
 'I''m firing the ___ to send the changed files over to code-reviewer.',
 'Use ''Task tool'' in a sentence about Claude Code spawning a subagent for a job.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: MCP family (3) ──────────────────────────────
('cc-mcp', 'MCP (Model Context Protocol)', 'M-C-P', 'claude-code', 1,
 'Anthropic''s open standard for letting AI assistants plug into external tools and data sources.',
 'MCP is a protocol — a shared language — that lets any AI client (Claude Code, Claude Desktop, etc.) talk to any tool server (Notion, GitHub, your filesystem, a database). Instead of every AI app reinventing every integration, MCP defines the handshake. If you''ve ever installed a "Notion connector" or "Linear connector" for Claude, that''s an MCP server.',
 'I added the Notion MCP so Claude can search my workspace without me copy-pasting.',
 'When Claude Code says "MCP tools available" or you see a long list of unfamiliar tool names in the system prompt, that''s MCP. Knowing the term means you understand how Claude reaches outside your project folder.',
 ARRAY['cc-mcp-server','cc-mcp-client','cc-tool-use']::text[],
 ARRAY['cc-tool-use']::text[],
 'cc-plugin',
 ARRAY[
   'A slash command that opens a Claude Code plugin menu',
   'A built-in tool that runs shell commands',
   'A configuration file that stores Claude''s memory between sessions'
 ]::text[],
 'I added the Notion ___ so Claude can search my workspace without me copy-pasting.',
 'Use ''MCP'' in a sentence about plugging Claude into an outside tool or data source.',
 'curated', 'curator', '2026-05-04'),

('cc-mcp-server', 'MCP server', null, 'claude-code', 1,
 'A program that exposes a set of tools and data over MCP for an AI client to use.',
 'An MCP server is the side that PROVIDES capabilities — file access, a Notion search, a database query, a Linear ticket lookup. It announces what tools and data it offers, and any MCP-aware client (like Claude Code) can connect and use them. The Notion MCP, GitHub MCP, and computer-use MCP are all servers.',
 'The Linear MCP server is running locally — Claude Code should pick up its tools on the next restart.',
 'When Claude Code lists your available MCP tools at session start, each section is a separate MCP server. Knowing the term means you can actually configure them yourself instead of treating them as a black box.',
 ARRAY['cc-mcp','cc-mcp-client','cc-plugin']::text[],
 ARRAY['cc-mcp']::text[],
 null,
 ARRAY[
   'A web app deployed on a cloud provider',
   'A database that stores Claude''s past conversations',
   'A continuous-integration runner that executes test suites'
 ]::text[],
 'The Linear ___ is running locally — Claude Code should pick up its tools on the next restart.',
 'Use ''MCP server'' in a sentence about something providing tools to Claude over MCP.',
 'curated', 'curator', '2026-05-04'),

('cc-mcp-client', 'MCP client', null, 'claude-code', 1,
 'The side that USES tools exposed over MCP — Claude Code itself is one.',
 'An MCP client is the AI app that connects to MCP servers and calls their tools. Claude Code is an MCP client; so is Claude Desktop, and any other AI tool that speaks the protocol. The client doesn''t care WHO is providing the tools, just that they speak MCP — that''s the whole point of having a standard.',
 'Claude Code acts as the MCP client, connecting to whichever servers you''ve configured.',
 'Knowing client vs. server means you can read MCP docs without confusion. When someone says "your MCP client needs to support resources" they''re talking about Claude Code itself, not the integration on the other end.',
 ARRAY['cc-mcp','cc-mcp-server','cc-tool-use']::text[],
 ARRAY['cc-mcp']::text[],
 null,
 ARRAY[
   'A program that exposes tools to Claude over MCP',
   'A user account in a SaaS product',
   'A web browser that renders an HTML page'
 ]::text[],
 'Claude Code acts as the ___, connecting to whichever servers you''ve configured.',
 'Use ''MCP client'' in a sentence about the side of MCP that uses the tools.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: extensibility (3) ───────────────────────────
('cc-skill', 'skill', null, 'claude-code', 1,
 'A reusable bundle of instructions and helper files that teaches Claude Code how to do a specific kind of task.',
 'A skill is a pre-packaged "how to do X" — a folder with a SKILL.md describing when to use it, plus any scripts or assets it needs. When Claude Code hits a task that matches the skill''s trigger, it loads the instructions and follows them. Think of it as a recipe Claude can pick up and run without you re-explaining.',
 'I dropped a "build-a-changelog" skill into the project so Claude knows our format.',
 'Skills are how you avoid repeating yourself across sessions. When Claude Code says "loading skill: X," that''s a packaged playbook running — knowing the term lets you build your own instead of pasting the same instructions every week.',
 ARRAY['cc-plugin','cc-claude-md','cc-system-prompt']::text[],
 ARRAY['cc-claude-code']::text[],
 'cc-plugin',
 ARRAY[
   'A keyboard shortcut for triggering a Claude action',
   'A subagent that handles a focused review job',
   'A configuration file that grants tool permissions'
 ]::text[],
 'I dropped a "build-a-changelog" ___ into the project so Claude knows our format.',
 'Use ''skill'' in a sentence about a reusable how-to that Claude Code can pick up.',
 'curated', 'curator', '2026-05-04'),

('cc-hook', 'hook', null, 'claude-code', 1,
 'A script that runs automatically at a specific moment in Claude Code''s lifecycle — before a tool call, after a file edit, on session start.',
 'Hooks let you wire your own scripts into Claude Code''s flow. A pre-tool-use hook can block a dangerous bash command; a post-edit hook can auto-format the file Claude just wrote. They''re defined in settings.json and run silently in the background — you only notice them when they fire.',
 'I set up a post-edit hook that runs prettier so every file Claude touches comes back formatted.',
 'When you want Claude Code to ALWAYS do something (lint after every edit, log every bash call), a hook beats reminding it every session. Knowing the term means you can automate the boring guardrails.',
 ARRAY['cc-settings-json','cc-permissions','cc-tool-use']::text[],
 ARRAY['cc-tool-use']::text[],
 'cc-plugin',
 ARRAY[
   'A skill that teaches Claude how to format markdown',
   'A subagent that runs in its own context window',
   'An MCP server that provides external tools'
 ]::text[],
 'I set up a post-edit ___ that runs prettier so every file Claude touches comes back formatted.',
 'Use ''hook'' in a sentence about a script that runs automatically at a Claude Code lifecycle event.',
 'curated', 'curator', '2026-05-04'),

('cc-plugin', 'plugin', null, 'claude-code', 1,
 'A bundle that adds new capabilities to Claude Code — typically wrapping skills, MCP servers, hooks, and slash commands together.',
 'A plugin is the distribution unit for extending Claude Code. One plugin can bring along a set of skills (how-to recipes), an MCP server (external tools), some hooks (lifecycle scripts), and custom slash commands — all installed at once. The bio-research plugin you have installed bundles a bunch of biomedical MCP servers under one name.',
 'I installed the bio-research plugin and got the bioRxiv and ChEMBL MCP servers in one shot.',
 'Plugins are how the Claude Code ecosystem grows beyond the built-in tools. Knowing the term lets you browse the marketplace and understand what each one is actually adding.',
 ARRAY['cc-skill','cc-mcp-server','cc-hook']::text[],
 ARRAY['cc-claude-code']::text[],
 null,
 ARRAY[
   'A single shell script that runs once on install',
   'A user-level memory file Claude reads at session start',
   'A subagent specialized for a particular review task'
 ]::text[],
 'I installed the bio-research ___ and got the bioRxiv and ChEMBL MCP servers in one shot.',
 'Use ''plugin'' in a sentence about installing a bundle of new capabilities into Claude Code.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: control & safety (3) ────────────────────────
('cc-permission-mode', 'permission mode', null, 'claude-code', 1,
 'The setting that controls how Claude Code asks (or doesn''t ask) before running tools.',
 'Permission mode is the dial between "ask me before every bash command" and "just go." Common modes: default (asks before sensitive actions), accept-edits (auto-allows file edits), bypass-permissions (don''t ask, used carefully). You can change it mid-session — switching to a stricter mode when working on a touchy codebase.',
 'I''m switching to bypass-permissions for this batch — the changes are all in a sandbox folder.',
 'Every "would you like me to run this command?" prompt comes from the current permission mode. Knowing the term means you can tune Claude Code''s safety vs. speed tradeoff instead of feeling stuck with the defaults.',
 ARRAY['cc-permissions','cc-plan-mode','cc-settings-json']::text[],
 ARRAY['cc-claude-code']::text[],
 null,
 ARRAY[
   'A list of slash commands available in the current session',
   'The model size Claude Code is using for the current task',
   'A plan listing the steps Claude intends to take next'
 ]::text[],
 'I''m switching to bypass-___ for this batch — the changes are all in a sandbox folder.',
 'Use ''permission mode'' in a sentence about how Claude Code handles tool-use confirmations.',
 'curated', 'curator', '2026-05-04'),

('cc-plan-mode', 'plan mode', null, 'claude-code', 1,
 'A read-only Claude Code mode where Claude can investigate but cannot edit or run anything until you approve a plan.',
 'In plan mode, Claude can read files, search the codebase, and think — but it cannot write, edit, or run commands. It uses that thinking to produce a step-by-step plan, which you then approve (or send back for revisions) before any work happens. Great for tricky changes you want to vet before Claude touches the codebase.',
 'Let me drop into plan mode first — I want to see what you''re going to change before any files move.',
 'Plan mode is your safety net for big changes. When Claude Code shows you a numbered plan and waits, that''s plan mode in action — knowing the term means you can ask for it explicitly when stakes are high.',
 ARRAY['cc-permission-mode','cc-permissions','cc-todowrite']::text[],
 ARRAY['cc-permission-mode']::text[],
 null,
 ARRAY[
   'A subagent that drafts the project roadmap',
   'A slash command that switches Claude to a smaller model',
   'A built-in tool for writing pseudocode'
 ]::text[],
 'Let me drop into ___ first — I want to see what you''re going to change before any files move.',
 'Use ''plan mode'' in a sentence about asking Claude to plan before editing anything.',
 'curated', 'curator', '2026-05-04'),

('cc-permissions', 'permissions (allowlist)', null, 'claude-code', 1,
 'The fine-grained list of which tools and commands Claude Code is allowed to run without asking.',
 'Permissions are the rules sitting under the broader permission mode. You can pre-approve specific bash commands ("npm run build is always fine"), specific file paths Claude can edit, or specific MCP tools — so Claude doesn''t interrupt you to ask for the same green light every time. Lives in settings.json.',
 'I added npm test to my permissions allowlist so Claude can run it without prompting.',
 'When Claude Code stops asking you about a command you''ve approved a hundred times, you''ve added it to permissions. Knowing the term lets you tune the friction in your workflow.',
 ARRAY['cc-permission-mode','cc-settings-json','cc-hook']::text[],
 ARRAY['cc-permission-mode']::text[],
 null,
 ARRAY[
   'The mode controlling when Claude asks before running tools',
   'A list of MCP servers currently connected',
   'A skill that teaches Claude how to handle credentials'
 ]::text[],
 'I added npm test to my ___ allowlist so Claude can run it without prompting.',
 'Use ''permissions'' in a sentence about pre-approving specific commands for Claude Code.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: persistence & memory (3) ────────────────────
('cc-claude-md', 'CLAUDE.md', 'CLAUDE-dot-M-D', 'claude-code', 1,
 'A markdown file Claude Code reads at session start to learn the project''s conventions, stack, and rules.',
 'CLAUDE.md lives at the root of a project (or in your home dir for global rules). Whatever you put there gets injected into every session''s system prompt — coding style, voice rules, "never do X," tech stack defaults. It''s the most important file in any Claude-Code-driven project. You have one for every Catalyst and side reaction app.',
 'I updated the CLAUDE.md to remind Claude that we use IBM Plex Sans, not Inter.',
 'Every Claude Code session you run reads your CLAUDE.md FIRST. Knowing the term means you understand why Claude already knows your stack — and where to teach it new rules permanently.',
 ARRAY['cc-memory','cc-system-prompt','cc-skill']::text[],
 ARRAY['cc-claude-code']::text[],
 'cc-system-prompt',
 ARRAY[
   'A README file describing the project for new contributors',
   'A configuration file for the Claude Code CLI itself',
   'A changelog tracking each version of Claude'
 ]::text[],
 'I updated the ___ to remind Claude that we use IBM Plex Sans, not Inter.',
 'Use ''CLAUDE.md'' in a sentence about teaching Claude Code your project conventions.',
 'curated', 'curator', '2026-05-04'),

('cc-memory', 'memory', null, 'claude-code', 1,
 'Persistent notes Claude Code remembers between sessions — usually stored in CLAUDE.md or a dedicated memory file.',
 'Claude Code has no built-in long-term memory the way a human does — every session starts fresh. "Memory" in Claude Code means anything Claude reads at startup that carries forward your past decisions: CLAUDE.md, settings, agent definitions. When you tell Claude "remember this for next time," it means writing it down in one of those files.',
 'Add that decision to memory so we don''t re-litigate it next session.',
 'Knowing the term means when Claude Code asks "should I add this to memory?" you understand it''s about to write a file you''ll inherit forever — not some magical neural recall.',
 ARRAY['cc-claude-md','cc-system-prompt','cc-context-window']::text[],
 ARRAY['cc-claude-md']::text[],
 null,
 ARRAY[
   'The active context window of the current conversation',
   'A cache of recent tool-call responses',
   'A backup of every file Claude has edited'
 ]::text[],
 'Add that decision to ___ so we don''t re-litigate it next session.',
 'Use ''memory'' in a sentence about something Claude Code should remember between sessions.',
 'curated', 'curator', '2026-05-04'),

('cc-system-prompt', 'system prompt', null, 'claude-code', 1,
 'The hidden instructions that tell the model who it is and how to behave — Claude Code has a long, carefully-written one.',
 'The system prompt is the first message any LLM sees, before the user even speaks. Claude Code''s system prompt sets the agent''s identity, lists every tool available, includes your CLAUDE.md, and lays out the behavioral rules. You don''t see it in the UI, but it''s shaping every response.',
 'The system prompt is huge — that''s where all your CLAUDE.md and tool definitions get injected.',
 'Knowing what a system prompt is means you understand why Claude Code "already knows" your project — it''s not psychic, it''s reading a long brief at session start.',
 ARRAY['cc-claude-md','cc-context-window','cc-token']::text[],
 ARRAY['ai-llm']::text[],
 'cc-context-window',
 ARRAY[
   'A user message that kicks off the conversation',
   'A response template the model picks from at random',
   'A configuration file storing API keys'
 ]::text[],
 'The ___ is huge — that''s where all your CLAUDE.md and tool definitions get injected.',
 'Use ''system prompt'' in a sentence about the hidden instructions that shape an LLM''s behavior.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: built-in tools (4) ──────────────────────────
('cc-bash-tool', 'Bash tool', null, 'claude-code', 1,
 'Claude Code''s built-in tool for running shell commands on your machine.',
 'The Bash tool is how Claude Code executes anything that would normally happen in a terminal: npm install, git status, running a script, listing files. When you see "Running command: npm test" in the output, that''s a Bash tool call. It''s the most-used tool after the file tools, and the one most often gated by permissions.',
 'I''ll use the Bash tool to run the test suite and then read the results.',
 'Every shell command Claude Code runs comes through the Bash tool. Knowing the term means each "running command" line in your terminal connects to a specific mechanism instead of feeling like Claude has unlimited powers.',
 ARRAY['cc-tool-use','cc-file-tools','cli-bash']::text[],
 ARRAY['cli-bash','cc-tool-use']::text[],
 null,
 ARRAY[
   'A built-in tool for editing files in place',
   'A tool that searches the codebase for a pattern',
   'A tool for fetching pages from the web'
 ]::text[],
 'I''ll use the ___ to run the test suite and then read the results.',
 'Use ''Bash tool'' in a sentence about Claude Code running a shell command.',
 'curated', 'curator', '2026-05-04'),

('cc-file-tools', 'Edit / Write / Read tools', null, 'claude-code', 1,
 'The three built-in tools Claude Code uses to look at and change files on disk.',
 'Read opens a file and returns its contents. Edit makes a precise string-replacement change to an existing file. Write creates a new file (or replaces one entirely). Together they''re how Claude Code touches your codebase — every time you see "Reading file..." or "Editing file..." in the terminal, it''s one of these three.',
 'The Edit / Write / Read tools are doing all the heavy lifting on this refactor.',
 'When Claude Code "wrote a file" or "made an edit," it called one of these three tools. Knowing them by name lets you read terminal output instead of treating it as a stream of mystery actions.',
 ARRAY['cc-bash-tool','cc-search-tools','cc-tool-use']::text[],
 ARRAY['cc-tool-use']::text[],
 null,
 ARRAY[
   'A pair of tools for searching files by name and content',
   'A tool that fetches pages from the web',
   'A tool for spawning subagents to handle focused tasks'
 ]::text[],
 'The ___ tools are doing all the heavy lifting on this refactor.',
 'Use ''Read'' or ''Edit'' or ''Write'' in a sentence about Claude Code working with a file.',
 'curated', 'curator', '2026-05-04'),

('cc-search-tools', 'Grep / Glob tools', null, 'claude-code', 1,
 'Claude Code''s built-in tools for finding files by name (Glob) or by content (Grep).',
 'Glob takes a pattern like ''**/*.tsx'' and returns matching file paths — the right tool when Claude needs to find every component file. Grep searches inside files for a regex or string — the right tool when Claude needs to find every place a function is called. Together they''re how Claude navigates a codebase it doesn''t already have memorized.',
 'I''ll Grep for "useEffect" first to see every place we''re using it before I refactor.',
 'When Claude Code says "Searching..." or "Found 12 matches," it''s using Grep or Glob. Knowing the names means you can ask it to use the right one ("just Glob the components folder") instead of vague "look around for me."',
 ARRAY['cc-file-tools','cc-bash-tool','cli-grep']::text[],
 ARRAY['cc-tool-use']::text[],
 null,
 ARRAY[
   'A tool for running shell commands like npm install',
   'A tool that fetches a URL and returns the HTML',
   'A tool for asking the user a clarifying question'
 ]::text[],
 'I''ll ___ for "useEffect" first to see every place we''re using it before I refactor.',
 'Use ''Grep'' or ''Glob'' in a sentence about Claude Code searching a codebase.',
 'curated', 'curator', '2026-05-04'),

('cc-web-tools', 'WebFetch / WebSearch', null, 'claude-code', 1,
 'Claude Code''s built-in tools for pulling information off the live internet.',
 'WebFetch grabs a specific URL and returns the page content — useful when Claude needs to read a doc, a GitHub README, or an API reference. WebSearch runs a search query and returns results, for when Claude doesn''t have a URL yet. Together they''re how Claude Code escapes its training cutoff and gets current info.',
 'Let me WebFetch the Tailwind v4 docs — this changed since my training cutoff.',
 'When Claude Code says "I''ll need to look this up online," it''s reaching for WebFetch or WebSearch. Knowing the names means you can ask it explicitly to check the live web instead of guessing from memory.',
 ARRAY['cc-search-tools','cc-tool-use','cc-bash-tool']::text[],
 ARRAY['cc-tool-use']::text[],
 null,
 ARRAY[
   'Tools for searching local files by name and content',
   'A tool for running shell commands on your machine',
   'A tool for editing a file with precise string replacement'
 ]::text[],
 'Let me ___ the Tailwind v4 docs — this changed since my training cutoff.',
 'Use ''WebFetch'' or ''WebSearch'' in a sentence about Claude Code pulling info from the live internet.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: interactive tools (2) ───────────────────────
('cc-todowrite', 'TodoWrite', null, 'claude-code', 1,
 'The built-in tool Claude Code uses to track its own in-progress task list, visible to you in the terminal.',
 'TodoWrite lets Claude Code keep a live, structured todo list that updates as it works — items move from "pending" to "in_progress" to "completed" in real time. You see the list in your terminal as Claude ticks things off. Used most on multi-step tasks where you''d otherwise lose track of what''s done.',
 'Let me update the todo — that step''s done now, moving to the next one.',
 'Every time you see Claude Code show a checkbox-style task list and update it as work progresses, that''s TodoWrite. Knowing the term means you trust the list as Claude''s actual plan, not theater.',
 ARRAY['cc-askuserquestion','cc-tool-use','cc-plan-mode']::text[],
 ARRAY['cc-tool-use']::text[],
 null,
 ARRAY[
   'A tool for asking the user a clarifying question',
   'A tool for spawning a subagent on a focused job',
   'A slash command that opens the project roadmap'
 ]::text[],
 'Let me update the ___ — that step''s done now, moving to the next one.',
 'Use ''TodoWrite'' in a sentence about Claude tracking its own progress on a multi-step task.',
 'curated', 'curator', '2026-05-04'),

('cc-askuserquestion', 'AskUserQuestion', null, 'claude-code', 1,
 'The built-in tool Claude Code uses to ask you a structured clarifying question — usually rendered as tappable cards.',
 'AskUserQuestion is how Claude Code interrupts itself to ask you something it can''t figure out alone — design choices, tradeoffs, missing context. Instead of a wall of text, it shows clean question cards with options to pick. Many people love this tool: it''s how they get asked things instead of getting buried in prose-style "1) ... 2) ... 3) ..." questions.',
 'Hold on — let me hit AskUserQuestion to confirm whether you want pixel art or vector for the avatars.',
 'When Claude Code shows you a card-style question instead of guessing, that''s AskUserQuestion. Knowing the term means you can ask Claude explicitly to use it ("ask me with cards") and not get walls of bullet questions.',
 ARRAY['cc-todowrite','cc-tool-use','cc-plan-mode']::text[],
 ARRAY['cc-tool-use']::text[],
 null,
 ARRAY[
   'A tool that updates Claude''s own task checklist',
   'A slash command that switches the active model',
   'A subagent specialized for design questions'
 ]::text[],
 'Hold on — let me hit ___ to confirm whether you want pixel art or vector for the avatars.',
 'Use ''AskUserQuestion'' in a sentence about Claude Code asking you a structured clarifying question.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: plumbing & config (2) ───────────────────────
('cc-settings-json', 'settings.json', 'settings-dot-J-S-O-N', 'claude-code', 1,
 'The config file that controls Claude Code''s behavior — permissions, hooks, model choice, MCP servers, and more.',
 'settings.json lives in ~/.claude/ for global settings and inside a project for project-specific overrides. Edit it to add hooks, define your permission allowlist, point at MCP servers, or pin a default model. It''s plain JSON — no fancy editor needed, just a text file Claude reads at startup.',
 'I bumped the default model in settings.json so every session starts on Opus.',
 'When Claude Code asks "want me to add this to settings?" or behaves a certain way "by default," settings.json is where that lives. Knowing the file means you can configure once instead of repeating yourself.',
 ARRAY['cc-permissions','cc-hook','cc-claude-md']::text[],
 ARRAY['cc-claude-code']::text[],
 null,
 ARRAY[
   'The user-level memory file Claude reads at session start',
   'A markdown file describing the project conventions',
   'A log of every command Claude has run this session'
 ]::text[],
 'I bumped the default model in ___ so every session starts on Opus.',
 'Use ''settings.json'' in a sentence about configuring Claude Code''s behavior.',
 'curated', 'curator', '2026-05-04'),

('cc-background-task', 'background task', null, 'claude-code', 1,
 'A long-running command Claude Code starts and lets keep running while it moves on to other work — usually a dev server or test watcher.',
 'When Claude Code runs a command that doesn''t finish quickly (like `npm run dev`), it can launch it as a background task and immediately get back to you. The task keeps running, and Claude can read its output later or kill it when done. Without this, Claude would just sit there waiting for the process to exit.',
 'I''ll start the dev server as a background task so I can keep editing while it runs.',
 'Every time Claude Code says "Running in background" or you see it spin up a long-running process and not get stuck, that''s a background task. Knowing the term means you understand why Claude doesn''t freeze on a `npm run dev`.',
 ARRAY['cc-bash-tool','cc-tool-use','dev-server']::text[],
 ARRAY['cc-bash-tool']::text[],
 null,
 ARRAY[
   'A scheduled cron job that runs at a fixed time',
   'A slash command that runs in plan mode',
   'A subagent that handles a focused review job'
 ]::text[],
 'I''ll start the dev server as a ___ so I can keep editing while it runs.',
 'Use ''background task'' in a sentence about Claude Code running a long-lived process.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code: SDK & tokens / cost (4) ─────────────────────
('cc-sdk', 'SDK (Claude Agent SDK)', 'S-D-K', 'claude-code', 1,
 'The library Anthropic ships so developers can build their own agents that work like Claude Code — same tool loop, same permissions model.',
 'SDK stands for Software Development Kit. The Claude Agent SDK is what Claude Code itself runs on top of, exposed for everyone else. Use it to build a coding agent for your own product, a custom CLI, or a web-based agent that uses the same tool-call patterns. Available in Python and TypeScript.',
 'I''m prototyping a Catalyst-internal agent on the Claude Agent SDK so it feels like Claude Code.',
 'When tech podcasts say "built on the Claude Agent SDK," they mean the same engine that powers your daily Claude Code. Knowing the term means you understand the line between the product (Claude Code) and the toolkit (the SDK) anyone can build on.',
 ARRAY['cc-claude-code','cc-tool-use','dev-library']::text[],
 ARRAY['cc-claude-code']::text[],
 null,
 ARRAY[
   'A drop-in code editor extension for Claude',
   'A slash command for switching the active model',
   'A web-based version of Claude Code that runs in the browser'
 ]::text[],
 'I''m prototyping a Catalyst-internal agent on the Claude Agent ___ so it feels like Claude Code.',
 'Use ''SDK'' or ''Claude Agent SDK'' in a sentence about building an agent on Anthropic''s toolkit.',
 'curated', 'curator', '2026-05-04'),

('cc-token', 'token', null, 'claude-code', 1,
 'The unit of text an LLM actually sees and counts — roughly three-quarters of a word in English.',
 'LLMs don''t process text character by character or word by word. They chop it into "tokens" — small pieces, often a few characters each. Pricing, context-window limits, and rate limits are all measured in tokens, not words or characters. A typical English page is around 500 tokens; "Catalyst" might be one token, "RxCadence" might be three.',
 'That long file ate 8,000 tokens just to read — we''re going to want to summarize before continuing.',
 'When Claude Code talks about how much "context is left" or what something "costs," it means tokens. Knowing the unit means you can budget your conversation and understand why huge files are expensive to keep in context.',
 ARRAY['cc-context-window','cc-caching','ai-llm']::text[],
 ARRAY['ai-llm']::text[],
 'cc-context-window',
 ARRAY[
   'A login credential used to authenticate with an API',
   'A file representing a single commit in git',
   'A unit of compute time on a cloud provider'
 ]::text[],
 'That long file ate 8,000 ___ just to read — we''re going to want to summarize before continuing.',
 'Use ''token'' in a sentence about how much text an LLM is processing.',
 'curated', 'curator', '2026-05-04'),

('cc-context-window', 'context window', null, 'claude-code', 1,
 'The total amount of text — measured in tokens — an LLM can hold in mind for a single conversation.',
 'Every model has a fixed context window: 200K tokens, 1M tokens, etc. Everything Claude Code is currently aware of (system prompt, your messages, file reads, tool results) gets stuffed into that window. When it fills up, older content gets dropped or summarized. Bigger windows = longer sessions before things start falling out.',
 'We''re halfway through the context window already — let me /clear and start a fresh thread for the next task.',
 'Every time Claude Code feels like it "forgot" something or asks you to /clear, you''ve hit the context window edge. Knowing the term means you understand why long sessions get expensive and forgetful.',
 ARRAY['cc-token','cc-caching','cc-system-prompt']::text[],
 ARRAY['cc-token']::text[],
 null,
 ARRAY[
   'A pop-up panel showing the current Claude Code session',
   'The model''s training cutoff date',
   'A slash command for clearing the screen'
 ]::text[],
 'We''re halfway through the ___ already — let me /clear and start a fresh thread for the next task.',
 'Use ''context window'' in a sentence about how much an LLM can hold in mind at once.',
 'curated', 'curator', '2026-05-04'),

('cc-caching', 'prompt caching', null, 'claude-code', 1,
 'A pricing optimization where Anthropic remembers the start of your prompt between requests, so repeat content costs ~10× less.',
 'Prompt caching is how Claude Code keeps long sessions affordable. The huge stable prefix — system prompt, CLAUDE.md, file contents Claude already read — gets cached on Anthropic''s side. Subsequent requests only pay full price for the new bits. Without caching, every turn would re-bill the entire conversation.',
 'Prompt caching is the only reason these long sessions don''t cost a fortune.',
 'Knowing the term means when someone asks "isn''t Claude Code expensive?" you can explain why a 50-turn session doesn''t cost 50× a one-turn session — the cache is doing huge work.',
 ARRAY['cc-token','cc-context-window','cc-system-prompt']::text[],
 ARRAY['cc-token','cc-context-window']::text[],
 null,
 ARRAY[
   'A local cache of file contents on your machine',
   'A backup of past conversations you can restore',
   'A subagent specialized for cost analysis'
 ]::text[],
 '___ is the only reason these long sessions don''t cost a fortune.',
 'Use ''prompt caching'' in a sentence about why long Claude Code sessions stay affordable.',
 'curated', 'curator', '2026-05-04')

on conflict (id) do nothing;
