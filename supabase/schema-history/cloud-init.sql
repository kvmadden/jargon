-- Jargon Stage A — initial schema
-- Tables: terms, user_progress, streak_log, settings
-- Deferred to Stage B: ingestion_log, reports

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- terms: the live dictionary (Stage A: 21 curated anchors)
-- ────────────────────────────────────────────────────────────
create table terms (
  id text primary key,
  term text not null,
  pronunciation text,
  path text not null check (path in ('git-cli','dev-concepts','enterprise','claude-code','ai-ml','agile','systems')),
  difficulty smallint not null check (difficulty between 1 and 3),
  one_line_definition text not null,
  long_definition text not null,
  example_in_sentence text not null,
  why_it_matters text not null,
  related_terms text[] not null default '{}',
  prerequisites text[] not null default '{}',
  stretch_term text,
  multiple_choice_distractors text[] not null check (array_length(multiple_choice_distractors,1) = 3),
  fill_in_blank_sentence text,
  use_in_sentence_prompt text not null,
  source text not null check (source in ('curated','ai-generated')),
  reviewed_at timestamptz,
  reviewed_by text check (reviewed_by in ('curator') or reviewed_by is null),
  created_at timestamptz not null default now()
);
create index idx_terms_path on terms(path);
create index idx_terms_path_difficulty on terms(path, difficulty);

-- ────────────────────────────────────────────────────────────
-- user_progress: per-user, per-term mastery + SRS state
-- ────────────────────────────────────────────────────────────
create table user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id text not null references terms(id) on delete cascade,
  correct_count int4 not null default 0,
  incorrect_count int4 not null default 0,
  last_seen_at timestamptz,
  last_correct_at timestamptz,
  mastery_score numeric(4,3) not null default 0.000,
  next_review_at timestamptz,
  srs_interval_days int4 not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, term_id)
);
create index idx_progress_user on user_progress(user_id);
create index idx_progress_review_due on user_progress(user_id, next_review_at) where next_review_at is not null;

-- ────────────────────────────────────────────────────────────
-- streak_log: per-user, per-day
-- ────────────────────────────────────────────────────────────
create table streak_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  lessons_completed int4 not null default 0,
  xp_earned int4 not null default 0,
  streak_freeze_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, local_date)
);
create index idx_streak_user_date on streak_log(user_id, local_date desc);

-- ────────────────────────────────────────────────────────────
-- settings: per-user singleton
-- ────────────────────────────────────────────────────────────
create table settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_freezes_available smallint not null default 2 check (streak_freezes_available between 0 and 3),
  goal_follow_claude boolean not null default true,
  goal_talk_to_family boolean not null default true,
  diagnostic_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
alter table terms enable row level security;
alter table user_progress enable row level security;
alter table streak_log enable row level security;
alter table settings enable row level security;

create policy "anyone can read terms" on terms for select using (true);
create policy "service role manages terms" on terms for all to service_role using (true);

create policy "users see own progress" on user_progress for all using (auth.uid() = user_id);
create policy "users see own streaks" on streak_log for all using (auth.uid() = user_id);
create policy "users see own settings" on settings for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- Trigger: keep updated_at honest on user_progress + settings
-- ────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_progress_updated_at
  before update on user_progress
  for each row execute function set_updated_at();

create trigger settings_updated_at
  before update on settings
  for each row execute function set_updated_at();
-- Jargon Stage A — 21 anchor terms (3 per path, all difficulty 1, all curated)
-- Voice: matches the git-commit template in the brief — depth, conversational, grounded.

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── git-cli (3) ────────────────────────────────────────────
('git-commit', 'commit', null, 'git-cli', 1,
 'A snapshot of code changes saved with a description of what changed.',
 'When you commit, you bundle a set of file changes with a message describing what you did. Commits are the building blocks of a project''s history — each one is a labeled checkpoint you can return to later.',
 'Let me commit this fix before I switch branches.',
 'Every time Claude Code finishes a chunk of work it commits. Knowing what a commit is means you understand "saving progress" in code — and the difference between commit (local) and push (shared with everyone).',
 ARRAY['git-push','git-pr']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A request to merge code into the main branch',
   'A copy of a repository on your local machine',
   'A folder containing project files'
 ]::text[],
 'Let me ___ this fix before I switch branches.',
 'Use ''commit'' in a sentence about saving your work in progress.',
 'curated', 'curator', '2026-05-04'),

('git-push', 'push', null, 'git-cli', 1,
 'Sending your local commits up to a shared remote repository.',
 'A push takes the commits you''ve made on your machine and uploads them to a remote (like GitHub) so other people — or other machines you own — can pull them down. Until you push, your work only exists locally.',
 'I committed the fix an hour ago but forgot to push, so nobody else has it yet.',
 'Claude Code commits constantly but only pushes when you ask. If you ever wonder "why doesn''t my other laptop see this?" the answer is almost always: nobody pushed.',
 ARRAY['git-commit','git-pr']::text[],
 ARRAY['git-commit']::text[],
 null,
 ARRAY[
   'Downloading the latest code from a remote',
   'Combining two branches into one',
   'Reverting changes to a previous commit'
 ]::text[],
 'I committed the fix an hour ago but forgot to ___, so nobody else has it yet.',
 'Use ''push'' in a sentence about sharing your local work with a teammate.',
 'curated', 'curator', '2026-05-04'),

('git-pr', 'PR (pull request)', 'P-R or pull request', 'git-cli', 1,
 'A formal proposal to merge one branch into another, with room for review and discussion.',
 'A pull request bundles up the commits on a branch and says "please pull these into the main code." Teammates can review it, comment, request changes, and approve before the merge happens — it''s where most code review lives.',
 'I opened a PR for the new login flow — can you take a look before I merge?',
 'Every change at a real software company goes through a PR. When your dev family says "left a comment on your PR," they mean a reviewable proposal-to-merge sitting on GitHub waiting for sign-off.',
 ARRAY['git-commit','git-push']::text[],
 ARRAY['git-commit','git-push']::text[],
 null,
 ARRAY[
   'A confirmation email after a successful deploy',
   'A request to download a file from a server',
   'A scheduled meeting to discuss bugs'
 ]::text[],
 'I opened a ___ for the new login flow — can you take a look before I merge?',
 'Use ''PR'' or ''pull request'' in a sentence about asking a teammate to review your code.',
 'curated', 'curator', '2026-05-04'),

-- ─── dev-concepts (3) ───────────────────────────────────────
('dev-readme', 'README', 'read-me', 'dev-concepts', 1,
 'The first file someone reads to understand a project — usually a markdown doc at the repo root.',
 'A README explains what a project does, how to install it, how to run it, and any gotchas. It''s named in all caps so it sorts to the top of a directory listing — the convention is decades old. If a project has good docs, the README is the front door.',
 'I cloned the repo but the README doesn''t mention which Node version to use.',
 'When Claude Code creates a new project it writes a README. When you ask "how do I run this thing?" the answer is almost always "read the README" — knowing this term makes you fluent in how devs share setup instructions.',
 ARRAY['dev-api','dev-deploy']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A log file that records errors at runtime',
   'A configuration file for build tools',
   'A binary executable that launches the app'
 ]::text[],
 'I cloned the repo but the ___ doesn''t mention which Node version to use.',
 'Use ''README'' in a sentence about figuring out how to run a project you just downloaded.',
 'curated', 'curator', '2026-05-04'),

('dev-api', 'API', 'A-P-I', 'dev-concepts', 1,
 'A defined way for one piece of software to ask another for data or actions.',
 'API stands for Application Programming Interface. It''s a contract: "send me this kind of request, I''ll send back this kind of response." When your app talks to Stripe, OpenAI, or your own backend, it''s talking through an API.',
 'The weather API is rate-limited to 60 requests a minute, so we should cache responses.',
 'You hit APIs every day — the Anthropic API powers your sentence-quiz grader. Understanding API means understanding how apps talk to each other and to AI models.',
 ARRAY['dev-deploy','sys-rest']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A user interface library for building screens',
   'A secret credential used to log into a server',
   'A type of database optimized for fast reads'
 ]::text[],
 'The weather ___ is rate-limited to 60 requests a minute, so we should cache responses.',
 'Use ''API'' in a sentence about an app fetching data from another service.',
 'curated', 'curator', '2026-05-04'),

('dev-deploy', 'deploy', null, 'dev-concepts', 1,
 'Pushing a built app to a server so real users can hit it.',
 'To deploy is to take the code you''ve written, package it, and put it somewhere the public can reach it — Vercel, AWS, an App Store, anywhere. "Deploying to production" means going live.',
 'I''ll deploy to staging first and check it on my phone before pushing to production.',
 'Shipping = deploying. When you get an app onto the App Store, that''s a deploy. Knowing this term unlocks every "is it live yet?" conversation.',
 ARRAY['dev-api','sys-server']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'Writing automated tests for your code',
   'Splitting your code into smaller files',
   'Reverting to the previous version of an app'
 ]::text[],
 'I''ll ___ to staging first and check it on my phone before pushing to production.',
 'Use ''deploy'' in a sentence about getting your app in front of real users.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise (3) ─────────────────────────────────────────
('ent-jira', 'JIRA', 'JEER-uh', 'enterprise', 1,
 'Atlassian''s ticket-tracking tool — where most enterprise work gets assigned, tracked, and closed.',
 'JIRA is a project-management system built around tickets (called "issues"). Every piece of work — bug, feature, task — gets a JIRA number, an assignee, a status, and a workflow. Sprints, boards, and reports all hang off it.',
 'I picked up a JIRA this morning to fix the dashboard sort order.',
 'When a large company says "what''s your JIRA number?" they mean the ticket ID. Familiarity with JIRA makes you fluent in how big orgs schedule their software work.',
 ARRAY['agile-ticket','agile-sprint','ent-slack']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A version-control system for tracking code',
   'A cloud database for storing user data',
   'A monitoring tool for server uptime'
 ]::text[],
 'I picked up a ___ this morning to fix the dashboard sort order.',
 'Use ''JIRA'' in a sentence about getting assigned a piece of work at a big company.',
 'curated', 'curator', '2026-05-04'),

('ent-slack', 'Slack', null, 'enterprise', 1,
 'A workplace chat tool organized into channels, threads, and DMs.',
 'Slack replaced email for a lot of teams. Conversations live in channels (one per topic, project, or team), threads keep replies tidy, and DMs handle the side-channel stuff. It also hooks into bots, GitHub notifications, and on-call alerts.',
 'I dropped the screenshot in the #design channel and tagged you in a thread.',
 'Slack is the lingua franca of remote tech work. Knowing channel/thread/DM mechanics means you can drop into any tech company''s comms culture without fumbling.',
 ARRAY['ent-jira']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A cloud storage service for sharing files',
   'A code editor used by most developers',
   'A video conferencing platform'
 ]::text[],
 'I dropped the screenshot in the #design channel and tagged you in a ___.',
 'Use ''Slack'' in a sentence about messaging a teammate at work.',
 'curated', 'curator', '2026-05-04'),

('ent-salesforce', 'Salesforce', null, 'enterprise', 1,
 'A massive cloud CRM platform — where companies track customers, deals, and accounts.',
 'Salesforce is customer-relationship-management software at enterprise scale. Sales teams log calls, opportunities, and pipelines in it. Most Fortune 500s run some flavor of Salesforce — it''s as common as Excel.',
 'I logged the visit in Salesforce so the rep has the notes for follow-up.',
 'CRM-speak is everywhere in PM/DL work. When someone says "is it in Salesforce?" they mean "did you log the customer interaction in the system of record?" — knowing this term makes enterprise conversations land.',
 ARRAY['ent-jira']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A logistics tool for tracking package shipments',
   'An HR system for managing payroll',
   'A monitoring dashboard for server health'
 ]::text[],
 'I logged the visit in ___ so the rep has the notes for follow-up.',
 'Use ''Salesforce'' in a sentence about tracking customer information at work.',
 'curated', 'curator', '2026-05-04'),

-- ─── claude-code (3) ────────────────────────────────────────
('cc-claude-code', 'Claude Code', null, 'claude-code', 1,
 'Anthropic''s coding agent that lives in your terminal and edits real files on your computer.',
 'Claude Code is a CLI tool — you start it in a project folder, tell it what to build, and it reads, writes, and runs code on your machine. Unlike chat in a browser, it has direct access to your filesystem and shell.',
 'I''ve got Claude Code open in three terminals — one per Catalyst app I''m building.',
 'This is the tool you use every day. Saying its full name correctly (capital C, capital C, two words) keeps your conversations with dev family precise.',
 ARRAY['cc-agent','cc-slash-command']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A web-based code editor by Anthropic',
   'A no-code app builder that runs in the cloud',
   'A library of code snippets for AI projects'
 ]::text[],
 'I''ve got ___ open in three terminals — one per Catalyst app I''m building.',
 'Use ''Claude Code'' in a sentence about your daily build workflow.',
 'curated', 'curator', '2026-05-04'),

('cc-agent', 'agent', null, 'claude-code', 1,
 'A specialized AI helper that gets invoked for a specific kind of task.',
 'In Claude Code, an agent is a sub-Claude with its own personality, tools, and instructions — a UI designer, a code reviewer, a QA tester. The main Claude calls them when needed, and each runs in its own context with focused tools.',
 'I asked the ui-designer agent to audit my new screen before the builder picked it up.',
 'You already use Agent Suite: a set of specialized coding agents such as spec-writer, ui-designer, react-builder, code-reviewer, qa-tester, visual-qa, build-order-agent, invoke-subagent-agent, skill-creator-agent, hallucination-tripwire-agent, monitor-instead-of-poll-agent, and anonymous-feedback-honest-agent. Knowing what "agent" means here makes the orchestration model click.',
 ARRAY['cc-claude-code','cc-slash-command']::text[],
 ARRAY['cc-claude-code']::text[],
 null,
 ARRAY[
   'A background process that monitors system health',
   'A user account with admin privileges',
   'A piece of malware that runs without permission'
 ]::text[],
 'I asked the ui-designer ___ to audit my new screen before the builder picked it up.',
 'Use ''agent'' in a sentence about delegating a coding task to a specialized helper.',
 'curated', 'curator', '2026-05-04'),

('cc-slash-command', 'slash command', null, 'claude-code', 1,
 'A shortcut you type starting with "/" to trigger a Claude Code action.',
 'Slash commands are pre-built shortcuts inside Claude Code — typing "/" pops a menu of things like /clear (reset context), /agents (list your agent team), /model (switch models). They save you from explaining the same thing to Claude every session.',
 'Type /clear to wipe the context before you start a totally new task.',
 'Slash commands are how power users move fast in Claude Code. Knowing the term means you can follow tutorials and YouTube walkthroughs without losing the thread.',
 ARRAY['cc-claude-code','cc-agent']::text[],
 ARRAY['cc-claude-code']::text[],
 null,
 ARRAY[
   'A keyboard shortcut for copy-paste',
   'A line of code that imports a library',
   'A regex pattern for searching files'
 ]::text[],
 'Type ___ /clear to wipe the context before you start a totally new task.',
 'Use ''slash command'' in a sentence about quickly invoking a Claude Code feature.',
 'curated', 'curator', '2026-05-04'),

-- ─── ai-ml (3) ──────────────────────────────────────────────
('ai-llm', 'LLM', 'L-L-M', 'ai-ml', 1,
 'Large Language Model — the kind of AI that writes, reasons, and chats like a person.',
 'An LLM is a neural network trained on huge amounts of text to predict the next word. Claude, GPT, Gemini, Llama — all LLMs. They can read, write, summarize, code, and converse, and they''re the engine behind every modern AI chat product.',
 'Jargon uses an LLM (Claude Opus 4.7) to grade your free-form sentence answers.',
 'Every "AI" product you use or builds is powered by an LLM. Understanding the term is the foundation for everything else in AI/ML — context windows, tokens, RAG, agents all hang off it.',
 ARRAY['ai-rag','ai-embedding']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A type of database optimized for machine learning',
   'A protocol for streaming video over the internet',
   'A markup language for describing UI layouts'
 ]::text[],
 'Jargon uses an ___ (Claude Opus 4.7) to grade your free-form sentence answers.',
 'Use ''LLM'' in a sentence about an AI product you use.',
 'curated', 'curator', '2026-05-04'),

('ai-rag', 'RAG', 'rag (rhymes with bag)', 'ai-ml', 1,
 'Retrieval-Augmented Generation — fetching relevant docs first, then asking an LLM to use them.',
 'RAG is a pattern: instead of relying only on what an LLM was trained on, you search a knowledge base first, pull the most relevant chunks, and stuff them into the prompt. The LLM then answers grounded in those chunks. It''s how chatbots cite sources.',
 'We built a RAG system over the company wiki so Slack questions get answered from real docs.',
 'When devs say "we use RAG to ground the model" they mean exactly this. It''s the most common way to make an LLM smarter about your specific data without retraining anything.',
 ARRAY['ai-llm','ai-embedding']::text[],
 ARRAY['ai-llm','ai-embedding']::text[],
 null,
 ARRAY[
   'A method for compressing image files',
   'A type of authentication using two factors',
   'A scheduling algorithm for cloud servers'
 ]::text[],
 'We built a ___ system over the company wiki so Slack questions get answered from real docs.',
 'Use ''RAG'' in a sentence about making an LLM answer from your own documents.',
 'curated', 'curator', '2026-05-04'),

('ai-embedding', 'embedding', null, 'ai-ml', 1,
 'A list of numbers that represents the meaning of a piece of text.',
 'An embedding turns text into a long array of numbers (a vector) such that similar meanings produce similar numbers. "dog" and "puppy" land near each other; "dog" and "spreadsheet" land far apart. It''s how computers compare meaning instead of just matching words.',
 'We compute an embedding for each note so search returns matches by meaning, not exact wording.',
 'Embeddings power semantic search, RAG, recommendations, and the consensus check Jargon''s ingestion subsystem will use to verify new terms. Once embedding clicks, half of modern AI infrastructure makes sense.',
 ARRAY['ai-llm','ai-rag']::text[],
 ARRAY['ai-llm']::text[],
 null,
 ARRAY[
   'A snippet of code copied into another file',
   'A user profile photo stored in a database',
   'A configuration setting passed to a function'
 ]::text[],
 'We compute an ___ for each note so search returns matches by meaning, not exact wording.',
 'Use ''embedding'' in a sentence about searching by meaning instead of exact words.',
 'curated', 'curator', '2026-05-04'),

-- ─── agile (3) ──────────────────────────────────────────────
('agile-sprint', 'sprint', null, 'agile', 1,
 'A short, fixed window (usually 2 weeks) that a team commits to a chunk of work for.',
 'A sprint is a planning unit. The team picks a slate of tickets they think they can finish, works on them for the sprint length, and reviews what got done at the end. The cycle repeats forever — sprint after sprint.',
 'We''re mid-sprint, so let''s park that idea and pick it up next sprint.',
 'Every standup, every retro, every "we''ll get to it" conversation is shaped around the sprint cadence. Knowing what a sprint is unlocks how teams pace and commit.',
 ARRAY['agile-standup','agile-ticket']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A live demo at the end of a project',
   'A type of automated test for code',
   'A code review session between two developers'
 ]::text[],
 'We''re mid-___, so let''s park that idea and pick it up next sprint.',
 'Use ''sprint'' in a sentence about scheduling work in two-week chunks.',
 'curated', 'curator', '2026-05-04'),

('agile-standup', 'standup', null, 'agile', 1,
 'A short daily meeting where the team shares yesterday, today, and any blockers.',
 'A standup (also called a daily scrum) is a 10–15 minute sync where each person says what they did yesterday, what they''ll do today, and anything blocking them. It''s called standup because traditionally everyone literally stood up to keep it short.',
 'I''ll bring it up at standup tomorrow and see if anyone has bandwidth.',
 'Most tech teams have one every weekday morning. When dev family says "I''ve got standup at 10," this is what they mean. Fluency here means you can join one and contribute on day one.',
 ARRAY['agile-sprint','agile-ticket']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A weekly all-hands company meeting',
   'A planning session for a new product',
   'A demo of finished features to stakeholders'
 ]::text[],
 'I''ll bring it up at ___ tomorrow and see if anyone has bandwidth.',
 'Use ''standup'' in a sentence about a daily team check-in.',
 'curated', 'curator', '2026-05-04'),

('agile-ticket', 'ticket', null, 'agile', 1,
 'One discrete piece of work, tracked in a system like JIRA or Linear.',
 'A ticket (also called an issue or a card) is one bounded task — a bug, a small feature, a chore. It has a title, description, assignee, status, and usually an estimate. Whole projects are made of dozens or hundreds of tickets.',
 'Can you write up a ticket for the date-picker bug so I don''t lose it?',
 'When you hear "open a ticket," "I picked up your ticket," "what''s the ticket number?" — this is the unit being referred to. Tickets are how engineering work gets quantified.',
 ARRAY['agile-sprint','agile-standup','ent-jira']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A digital receipt for a software purchase',
   'A reservation in an event-booking app',
   'An entry in a system''s audit log'
 ]::text[],
 'Can you write up a ___ for the date-picker bug so I don''t lose it?',
 'Use ''ticket'' in a sentence about tracking one piece of engineering work.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems (3) ────────────────────────────────────────────
('sys-server', 'server', null, 'systems', 1,
 'A computer (or program) that waits for requests from other computers and sends back responses.',
 'A server runs all the time, listening on a network address. When your phone hits a website, your phone is the client and a server somewhere is doing the work to send back the page. Servers can be physical machines, cloud VMs, or just programs.',
 'The server went down at 3am and it took 20 minutes to bring it back up.',
 'Every app you use has a server (or many) behind it. Jargon will eventually have a Supabase server. Knowing the term is the foundation for everything cloud, hosting, and uptime.',
 ARRAY['sys-database','sys-rest','dev-deploy']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A high-performance gaming computer',
   'A piece of code that runs in a browser',
   'A library that helps you build websites'
 ]::text[],
 'The ___ went down at 3am and it took 20 minutes to bring it back up.',
 'Use ''server'' in a sentence about the computer behind a website or app.',
 'curated', 'curator', '2026-05-04'),

('sys-database', 'database', null, 'systems', 1,
 'A program that stores, organizes, and retrieves data — usually in tables.',
 'A database keeps your data structured and queryable. The most common kind (SQL) stores data in tables with rows and columns and answers questions like "give me all users who logged in today." Postgres, MySQL, SQLite are all SQL databases. Supabase wraps Postgres.',
 'I added a new column to the users database for tracking signup source.',
 'Every app of any size has a database. Jargon is built on one (Supabase Postgres). Knowing this term means you can follow any conversation about data, schemas, or queries.',
 ARRAY['sys-server','sys-rest']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A spreadsheet shared between team members',
   'A backup copy of the operating system',
   'A folder on a server holding image files'
 ]::text[],
 'I added a new column to the users ___ for tracking signup source.',
 'Use ''database'' in a sentence about where an app stores its data.',
 'curated', 'curator', '2026-05-04'),

('sys-rest', 'REST', 'rest (like the noun)', 'systems', 1,
 'A common style for designing web APIs around resources and standard verbs.',
 'REST (Representational State Transfer) is a convention: each thing your API exposes is a "resource" with a URL, and you act on it with HTTP verbs — GET to read, POST to create, PUT to update, DELETE to remove. Most APIs you''ll meet are RESTful, including Supabase''s.',
 'The REST API exposes /users, /lessons, and /streaks — same verbs work on each.',
 'When you hear "hit the REST endpoint" or "this is a RESTful API," this is what''s meant. It''s the default mental model for how web APIs are organized.',
 ARRAY['dev-api','sys-server']::text[],
 ARRAY['dev-api']::text[],
 null,
 ARRAY[
   'A type of database query language',
   'A pause inserted between two tasks running on a server',
   'A protocol for sending email between servers'
 ]::text[],
 'The ___ API exposes /users, /lessons, and /streaks — same verbs work on each.',
 'Use ''REST'' in a sentence about the style of an API you''re calling.',
 'curated', 'curator', '2026-05-04');
