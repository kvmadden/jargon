-- jargon Stage B+1.20 - the owner development vocabulary expansion
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 26 coding-domain terms that match the phrases the owner is actually
-- seeing in agent-assisted development sessions: worktrees, stack previews,
-- preview deployments, visual QA, RLS, idempotency, handoffs, and compaction.
--
-- Scope:
--   - terms rows only
--   - coding domain only
--   - no profile/rendering cache rewrites
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- git-cli
('git-worktree', 'worktree', null, 'git-cli', 'coding', 2,
 'A second working checkout of the same repo, tied to its own branch, so you can edit two branches side by side.',
 'A Git worktree lets one repository have multiple working folders at the same time. Each folder can be on a different branch, but they share the same underlying git history. It is how an agent can keep a PR branch open in one folder while inspecting a stack branch in another without constantly switching branches or stashing work.',
 'I made a worktree for the stack branch so I can inspect it without leaving this PR.',
 'you often has several agent branches alive at once. Worktrees are the clean way to see two versions of the same app at the same time without turning branch switching into soup.',
 ARRAY['git-branch','git-checkout','git-stash']::text[],
 ARRAY['git-branch','git-checkout']::text[],
 'git-rebase',
 ARRAY[
   'A remote copy of a repository on GitHub',
   'A temporary stash of uncommitted changes',
   'A visual diff between two commits'
 ]::text[],
 'I made a ___ for the stack branch so I can inspect it without leaving this PR.',
 'Use ''worktree'' in a sentence about keeping two branches open in separate folders.',
 'curated', 'curator', '2026-05-25'),

('git-cherry-pick', 'cherry-pick', null, 'git-cli', 'coding', 2,
 'Copying one specific commit onto your current branch without merging the whole source branch.',
 'Cherry-pick is the surgical Git move. Instead of merging an entire branch, you choose one commit and replay just that commit onto the branch you are on now. It is useful when one bug fix needs to move forward but the rest of that branch is not ready.',
 'Cherry-pick the OAuth fix onto main, but leave the visual polish branch alone for now.',
 'When a branch has one good commit mixed with unfinished work, cherry-pick is the word that lets you rescue the good part without dragging the whole branch with it.',
 ARRAY['git-commit','git-merge','git-rebase']::text[],
 ARRAY['git-commit','git-branch']::text[],
 'git-rebase',
 ARRAY[
   'Combining every commit from one branch into another',
   'Temporarily hiding uncommitted changes',
   'Deleting old commits from the local history'
 ]::text[],
 '___ the OAuth fix onto main, but leave the visual polish branch alone for now.',
 'Use ''cherry-pick'' in a sentence about moving one commit without merging a whole branch.',
 'curated', 'curator', '2026-05-25'),

('git-squash', 'squash', null, 'git-cli', 'coding', 2,
 'Combining several commits into one cleaner commit before a branch is merged.',
 'Squashing takes a messy series of commits and compresses them into one commit with one clear message. The code result is the same, but the history reads better. Teams often squash before merging a PR so main does not fill up with "fix typo", "try again", and "actually fix it" commits.',
 'Squash the three checkpoint commits into one clean auth commit before merging.',
 'Agent branches can produce lots of small checkpoint commits. Squash is how those checkpoints become a readable story before they land in main.',
 ARRAY['git-commit','git-rebase','git-pr']::text[],
 ARRAY['git-commit']::text[],
 'git-rebase',
 ARRAY[
   'Moving one commit from another branch onto this branch',
   'Downloading commits from the remote without merging them',
   'Saving uncommitted work so you can switch branches'
 ]::text[],
 '___ the three checkpoint commits into one clean auth commit before merging.',
 'Use ''squash'' in a sentence about cleaning up commit history before a merge.',
 'curated', 'curator', '2026-05-25'),

-- dev-concepts
('dev-monorepo', 'monorepo', null, 'dev-concepts', 'coding', 2,
 'One repository that holds multiple related apps, packages, or services together.',
 'A monorepo is a single repo that contains more than one project: maybe the web app, shared UI package, backend functions, docs, and scripts all live together. The tradeoff is coordination. Shared code is easier to change in one place, but builds, tests, and ownership need more structure.',
 'The operator ecosystem is basically a monorepo of related apps and shared packages.',
 'you works inside repo families where shared packages and app folders live near each other. Monorepo is the word that makes that shape legible.',
 ARRAY['dev-repo','dev-package-manager','dev-dependency']::text[],
 ARRAY['dev-repo']::text[],
 'dev-codegen',
 ARRAY[
   'A repository with exactly one commit',
   'A branch that has never been pushed to GitHub',
   'A production server running multiple containers'
 ]::text[],
 'The operator ecosystem is basically a ___ of related apps and shared packages.',
 'Use ''monorepo'' in a sentence about several related projects living in one repository.',
 'curated', 'curator', '2026-05-25'),

('dev-typecheck', 'typecheck', null, 'dev-concepts', 'coding', 1,
 'Checking whether the code obeys its declared TypeScript types before it runs.',
 'A typecheck asks TypeScript to inspect the code without launching the app. It catches mismatches like passing a number where a string is expected, reading a property that might not exist, or returning the wrong shape from a function. It is one of the fastest ways to catch broken assumptions before a browser ever opens.',
 'Run the typecheck before the build so we catch the bad prop shape early.',
 'When an agent says "typecheck failed," it usually means the code is structurally inconsistent, not that the page looked wrong. Knowing the distinction makes test output much less cryptic.',
 ARRAY['dev-build','dev-bug','dev-framework']::text[],
 ARRAY['dev-build']::text[],
 'dev-codegen',
 ARRAY[
   'Testing whether a user can type into a field',
   'Checking the spelling of comments in the code',
   'Counting how many lines changed in a PR'
 ]::text[],
 'Run the ___ before the build so we catch the bad prop shape early.',
 'Use ''typecheck'' in a sentence about TypeScript catching a shape mismatch.',
 'curated', 'curator', '2026-05-25'),

('dev-codegen', 'codegen', null, 'dev-concepts', 'coding', 2,
 'Generating code from another source of truth, like a schema, API spec, or design token registry.',
 'Codegen is short for code generation. Instead of hand-writing repetitive files, a script reads a source of truth and writes the code for you: TypeScript types from a database schema, API clients from an OpenAPI spec, CSS variables from design tokens. The generated files should be treated as outputs, not places to do careful hand edits.',
 'Run codegen after the schema changes so the TypeScript types know about the new column.',
 'This app already lives near generated agent files and shared token packages. Codegen is the reason some files should be regenerated instead of patched by hand.',
 ARRAY['dev-schema','dev-build','dev-dependency']::text[],
 ARRAY['dev-build']::text[],
 'dev-monorepo',
 ARRAY[
   'A code review generated from a pull request',
   'A random string used as a database primary key',
   'A feature flag that turns generated UI on or off'
 ]::text[],
 'Run ___ after the schema changes so the TypeScript types know about the new column.',
 'Use ''codegen'' in a sentence about creating code from a schema or spec.',
 'curated', 'curator', '2026-05-25'),

-- enterprise / release review
('ent-stacked-pr', 'stacked PR', null, 'enterprise', 'coding', 2,
 'A pull request that depends on another pull request landing before it.',
 'A stacked PR is part of a chain. PR #2 is built on top of PR #1, PR #3 is built on top of PR #2, and so on. Stacking lets a developer break one big change into reviewable pieces while still building toward the larger feature. The catch is bookkeeping: if a lower PR changes, everything above it may need a rebase.',
 'This visual pass is stacked on the OAuth PR, so review them in order.',
 'you often asks for several small PRs plus one combined view. Stacked PR is the phrase for that review shape when one branch is literally built on top of another.',
 ARRAY['git-pr','git-rebase','ent-draft-pr']::text[],
 ARRAY['git-pr','git-branch']::text[],
 'ent-stack-preview',
 ARRAY[
   'A PR with many unrelated files changed',
   'A GitHub issue that tracks several bugs',
   'A release note listing every merged feature'
 ]::text[],
 'This visual pass is ___ on the OAuth PR, so review them in order.',
 'Use ''stacked PR'' in a sentence about a pull request that depends on an earlier one.',
 'curated', 'curator', '2026-05-25'),

('ent-stack-preview', 'stack preview', null, 'enterprise', 'coding', 2,
 'A combined preview branch or deployment that shows what several PR branches look like together.',
 'A stack preview is not a standard Git object. It is a review workflow: take several PR branches that are still separate for review, combine them into one branch, and deploy that combined branch so you can see the app as if all of them had merged. It answers a different question than any single PR: "do these changes feel right together?"',
 'The stack preview shows OAuth, the version pill, and mobile polish all in one place.',
 'This is the term behind the little "stack #2" style review surface. Knowing it keeps the combined preview from feeling like a mystery production build.',
 ARRAY['ent-stacked-pr','ent-preview-deployment','git-merge']::text[],
 ARRAY['git-pr','ent-preview-deployment']::text[],
 'ent-deployment-alias',
 ARRAY[
   'A screenshot of one page after a CSS change',
   'A Git tag marking a production release',
   'A todo list for follow-up fixes'
 ]::text[],
 'The ___ shows OAuth, the version pill, and mobile polish all in one place.',
 'Use ''stack preview'' in a sentence about seeing several pending PRs together.',
 'curated', 'curator', '2026-05-25'),

('ent-draft-pr', 'draft PR', null, 'enterprise', 'coding', 1,
 'A pull request opened for visibility before it is ready for final review or merge.',
 'A draft PR says "look if you want, but do not treat this as final yet." Developers use it to show direction early, get CI running, collect comments, or share a preview while the branch is still in progress. On GitHub, a draft PR cannot be merged until it is marked ready.',
 'I opened a draft PR so you can see the direction while I keep filling the gaps.',
 'Draft PR is the honest label for work that should be visible but not blessed yet. It lets you inspect the app early without confusing "viewable" with "done."',
 ARRAY['git-pr','ent-preview-deployment','agile-acceptance-criteria']::text[],
 ARRAY['git-pr']::text[],
 'ent-stacked-pr',
 ARRAY[
   'A PR that has already been merged',
   'A release branch created from main',
   'A private note attached to an issue'
 ]::text[],
 'I opened a ___ so you can see the direction while I keep filling the gaps.',
 'Use ''draft PR'' in a sentence about showing in-progress work before final review.',
 'curated', 'curator', '2026-05-25'),

('ent-preview-deployment', 'preview deployment', null, 'enterprise', 'coding', 1,
 'A temporary live build of a branch so reviewers can click around before it merges.',
 'A preview deployment is a real hosted copy of the app created from a non-main branch. Vercel, Netlify, and similar hosts make one automatically for each PR or branch. It is not production, but it is close enough to catch layout, auth, routing, and copy issues that a diff will not show you.',
 'The preview deployment is live, so open it on mobile before we merge.',
 'you review with your eyes. Preview deployments are why a branch can be judged as an actual app instead of a pile of code changes.',
 ARRAY['git-pr','ent-stack-preview','ent-deployment-alias']::text[],
 ARRAY['git-pr','dev-deploy']::text[],
 'ent-deployment-alias',
 ARRAY[
   'A static screenshot attached to a PR',
   'A local dev server running on one laptop',
   'A changelog entry for a finished release'
 ]::text[],
 'The ___ is live, so open it on mobile before we merge.',
 'Use ''preview deployment'' in a sentence about clicking a branch before it merges.',
 'curated', 'curator', '2026-05-25'),

('ent-deployment-alias', 'deployment alias', null, 'enterprise', 'coding', 2,
 'A stable URL that points at a particular deployment, even when the raw deployment URL changes.',
 'A deployment alias is a friendly or stable URL assigned to a deployed build. The underlying deployment may have a long generated URL, but the alias can point reviewers to the right one. Aliases are useful when you want "open the stack preview" to mean one current link instead of hunting through many deployment URLs.',
 'Point the review alias at the latest stack preview so the link in the PR stays useful.',
 'Aliases are where preview confusion often hides. If the alias points at the wrong build, everyone can be reviewing yesterday while the branch already changed.',
 ARRAY['ent-preview-deployment','ent-stack-preview','dev-deploy']::text[],
 ARRAY['ent-preview-deployment']::text[],
 null,
 ARRAY[
   'A Git branch name shown in the terminal prompt',
   'A label attached to a Jira ticket',
   'A local hostname for a database container'
 ]::text[],
 'Point the review ___ at the latest stack preview so the link in the PR stays useful.',
 'Use ''deployment alias'' in a sentence about a stable preview URL.',
 'curated', 'curator', '2026-05-25'),

-- claude-code
('cc-handoff', 'handoff', null, 'claude-code', 'coding', 2,
 'A concise state transfer that tells the next agent or session what changed, what passed, and what remains.',
 'A handoff is the note you leave when work moves from one session, agent, or person to another. A good handoff names the branch, changed files, validation commands, open risks, and the next safe move. It prevents the next agent from re-discovering the whole repo like it just woke up in a storage closet.',
 'Write a handoff before compaction so the next session knows the branch and test state.',
 'Long Codex and Claude Code sessions live or die by handoffs. Knowing the word gives you a way to ask for continuity instead of a vague "where were we?"',
 ARRAY['cc-transcript','cc-compaction','git-branch']::text[],
 ARRAY['cc-transcript']::text[],
 'cc-compaction',
 ARRAY[
   'A command that deletes the current branch',
   'A screenshot attached to a PR comment',
   'A Git commit message written in present tense'
 ]::text[],
 'Write a ___ before compaction so the next session knows the branch and test state.',
 'Use ''handoff'' in a sentence about passing work to the next agent or session.',
 'curated', 'curator', '2026-05-25'),

('cc-transcript', 'transcript', null, 'claude-code', 'coding', 1,
 'The written record of a session: prompts, replies, tool results, errors, and decisions.',
 'A transcript is the session log. In agent work it is more than chat history; it includes commands, file reads, browser checks, screenshots, failures, and recovery steps. Reading the transcript is how you reconstruct why a branch looks the way it does.',
 'Paste the transcript into spotted so jargon can pick out the terms you keep seeing.',
 'This app is built for transcript learning: copy the messy development conversation, spot the words you almost know, then turn them into practice.',
 ARRAY['cc-handoff','cc-tool-use','agile-visual-qa']::text[],
 ARRAY['cc-claude-code']::text[],
 'cc-handoff',
 ARRAY[
   'A compiled build artifact',
   'A list of merged pull requests',
   'A design file exported from Figma'
 ]::text[],
 'Paste the ___ into spotted so jargon can pick out the terms you keep seeing.',
 'Use ''transcript'' in a sentence about learning from an agent session log.',
 'curated', 'curator', '2026-05-25'),

('cc-guardrails', 'guardrails', null, 'claude-code', 'coding', 2,
 'Rules and checks that keep an agent inside the safe lane while it works.',
 'Guardrails are the constraints around an agent session: do not read secrets, do not deploy live, use small PRs, run pre-deploy before pushing, preserve user changes. Some guardrails are instructions, some are automated checks, and some are review habits. They do not remove judgment; they make the risky edges visible.',
 'Use the same guardrails as the other repos: small branch, no live deploy, real validation.',
 'Teams use guardrails so fast agent work stays reversible. Knowing the term makes those rules feel like part of the workflow, not a mood.',
 ARRAY['cc-permissions','cc-plan-mode','agile-acceptance-criteria']::text[],
 ARRAY['cc-claude-code']::text[],
 'cc-handoff',
 ARRAY[
   'A set of UI cards shown after onboarding',
   'A branch naming pattern in GitHub',
   'A cache that stores old model responses'
 ]::text[],
 'Use the same ___ as the other repos: small branch, no live deploy, real validation.',
 'Use ''guardrails'' in a sentence about rules that keep agent work safe.',
 'curated', 'curator', '2026-05-25'),

('cc-compaction', 'compaction', null, 'claude-code', 'coding', 2,
 'The moment a long session gets summarized so the agent can keep going with less context.',
 'Compaction happens when a conversation gets too large to carry in full. The system writes a summary of what matters, drops bulky older detail, and continues from that compressed state. A good compaction preserves branch names, file paths, commands, failures, and the user''s latest direction. A bad one loses the plot.',
 'After compaction, reread the handoff and verify the branch before editing.',
 'If an agent suddenly seems to know the summary but not the whole path, compaction is probably why. The word helps you separate normal context management from actual confusion.',
 ARRAY['cc-context-window','cc-handoff','cc-transcript']::text[],
 ARRAY['cc-context-window']::text[],
 'cc-handoff',
 ARRAY[
   'Minifying JavaScript for a production bundle',
   'Combining several Git commits into one',
   'Compressing images before upload'
 ]::text[],
 'After ___, reread the handoff and verify the branch before editing.',
 'Use ''compaction'' in a sentence about a long agent session being summarized.',
 'curated', 'curator', '2026-05-25'),

-- ai-engineering
('ai-agent-loop', 'agent loop', null, 'ai-engineering', 'coding', 2,
 'The repeated cycle where an AI plans, acts, reads the result, and decides the next move.',
 'An agent loop is what turns a model from "answerer" into "doer." The model chooses an action, the runtime performs it, the result comes back, and the model decides what to do next. Coding agents live in this loop: inspect files, edit, test, read failure, edit again.',
 'The agent loop got stuck rerunning the same failing test until we changed the plan.',
 'When Claude Code feels like it is working through a task instead of just replying, you are watching an agent loop. Knowing the phrase makes the moving parts less mystical.',
 ARRAY['ai-agent','ai-function-calling','cc-tool-use']::text[],
 ARRAY['ai-agent','ai-function-calling']::text[],
 'cc-subagent',
 ARRAY[
   'A reusable prompt pasted at the start of every chat',
   'A benchmark score for a model release',
   'A model that only returns JSON'
 ]::text[],
 'The ___ got stuck rerunning the same failing test until we changed the plan.',
 'Use ''agent loop'' in a sentence about an AI repeatedly acting and checking results.',
 'curated', 'curator', '2026-05-25'),

('ai-structured-output', 'structured output', null, 'ai-engineering', 'coding', 2,
 'AI output constrained to a predictable shape, like JSON with required fields, instead of loose prose.',
 'Structured output means the model has to answer in a format software can reliably parse: a JSON object, a typed schema, a list with exact keys. It is useful when the answer feeds another system. Free prose is nicer to read; structured output is safer to automate.',
 'Ask for structured output so the ingestion job can parse term, definition, and difficulty without guessing.',
 'A lot of AI app work is making model responses boring enough for code to trust. Structured output is the name for that boring-on-purpose shape.',
 ARRAY['ai-prompt','ai-function-calling','ai-eval']::text[],
 ARRAY['ai-prompt']::text[],
 'ai-function-calling',
 ARRAY[
   'A model response written in a friendlier voice',
   'A longer prompt with more examples',
   'A dashboard showing model latency'
 ]::text[],
 'Ask for ___ so the ingestion job can parse term, definition, and difficulty without guessing.',
 'Use ''structured output'' in a sentence about making an AI response parseable by code.',
 'curated', 'curator', '2026-05-25'),

('ai-model-routing', 'model routing', null, 'ai-engineering', 'coding', 2,
 'Choosing which model should handle a request based on cost, speed, risk, or task type.',
 'Model routing is the traffic-cop layer for AI calls. Easy requests can go to a cheaper or faster model; hard reasoning, coding, or high-risk requests can go to a stronger one. Routing can be rule-based, learned from evals, or controlled by the user. The goal is not "always use the biggest model"; it is "send each job to the model that fits."',
 'Route quick glossary lookups to the small model and hard personalization to the stronger one.',
 'you runs different agents and models for different jobs. Model routing is the AI-engineering version of that instinct.',
 ARRAY['ai-model','ai-eval','ai-inference']::text[],
 ARRAY['ai-model','ai-eval']::text[],
 'ai-agent-loop',
 ARRAY[
   'Changing a website URL from one page to another',
   'Training one model on another model''s answers',
   'Saving model responses in a cache'
 ]::text[],
 'Route quick glossary lookups to the small model and hard personalization to the stronger one.',
 'Use ''model routing'' in a sentence about choosing a model for each request.',
 'curated', 'curator', '2026-05-25'),

-- agile / QA
('agile-smoke-test', 'smoke test', null, 'agile', 'coding', 1,
 'A quick check that the most important thing still works before deeper testing begins.',
 'A smoke test is the first sniff test after a build or deploy. Open the app, make sure it loads, click the main button, confirm the core flow is not obviously broken. It does not prove everything works; it proves the build is not on fire before you spend time on finer QA.',
 'Run a smoke test on the preview: load the app, sign in, start one lesson.',
 'Smoke test is the phrase for "make sure the obvious stuff is alive." It keeps validation concrete without pretending it is exhaustive.',
 ARRAY['agile-regression-test','agile-visual-qa','dev-build']::text[],
 ARRAY['dev-build']::text[],
 'agile-regression-test',
 ARRAY[
   'A full audit of every possible user path',
   'A test that only checks CSS colors',
   'A meeting where QA reviews the backlog'
 ]::text[],
 'Run a ___ on the preview: load the app, sign in, start one lesson.',
 'Use ''smoke test'' in a sentence about a quick first-pass app check.',
 'curated', 'curator', '2026-05-25'),

('agile-regression-test', 'regression test', null, 'agile', 'coding', 2,
 'A test that checks whether something that used to work has broken after a change.',
 'A regression test protects old behavior. When a bug is fixed, you add a test that would fail if the bug ever comes back. When a feature is polished, you run tests that prove the polish did not break login, lesson flow, mobile layout, or other already-working pieces.',
 'Add a regression test for the mobile sign-in spacing so it does not collapse again.',
 'Regression test is the answer to "we fixed this already, why is it back?" It turns a painful memory into a gate.',
 ARRAY['agile-smoke-test','dev-test','agile-visual-qa']::text[],
 ARRAY['dev-test']::text[],
 'agile-acceptance-criteria',
 ARRAY[
   'A test run only before the first release of a project',
   'A test that measures how fast a page loads',
   'A checklist written after the feature ships'
 ]::text[],
 'Add a ___ for the mobile sign-in spacing so it does not collapse again.',
 'Use ''regression test'' in a sentence about preventing an old bug from returning.',
 'curated', 'curator', '2026-05-25'),

('agile-visual-qa', 'visual QA', null, 'agile', 'coding', 1,
 'Looking at the real rendered app across viewports to catch spacing, alignment, wrapping, and polish problems.',
 'Visual QA means judging the rendered interface, not just the code. You open the app, capture screenshots, resize to mobile and desktop, check spacing, overlap, text wrapping, empty space, color contrast, and whether the screen feels usable. Automated tests can pass while visual QA still says "this hurts to look at."',
 'Do visual QA on mobile first; the spacing between the sign-in card and room card is too tight.',
 'This is one of the user''s sharpest review instincts. Visual QA gives that instinct a name and a repeatable checklist.',
 ARRAY['agile-smoke-test','agile-regression-test','ent-preview-deployment']::text[],
 ARRAY['ent-preview-deployment']::text[],
 'agile-acceptance-criteria',
 ARRAY[
   'A unit test that checks a pure function',
   'A database policy that hides rows',
   'A branch naming convention for releases'
 ]::text[],
 'Do ___ on mobile first; the spacing between the sign-in card and room card is too tight.',
 'Use ''visual QA'' in a sentence about checking the rendered app by sight.',
 'curated', 'curator', '2026-05-25'),

('agile-acceptance-criteria', 'acceptance criteria', null, 'agile', 'coding', 2,
 'The specific conditions that must be true before a piece of work counts as done.',
 'Acceptance criteria turn "make it better" into checkable facts. They might say the sign-in screen has 24px between sections, OAuth and magic link both work, the version pill opens, and mobile has no clipped buttons. Good criteria remove guesswork from review without killing judgment.',
 'The acceptance criteria say the mobile sign-in view needs screenshot proof before merge.',
 'you often reviews by feel first, then asks what "done" means. Acceptance criteria are how that feel becomes a shared finish line.',
 ARRAY['agile-ticket','agile-regression-test','agile-visual-qa']::text[],
 ARRAY['agile-ticket']::text[],
 'agile-regression-test',
 ARRAY[
   'A list of commits in a pull request',
   'A meeting at the end of a sprint',
   'A Git command that downloads remote commits'
 ]::text[],
 'The ___ say the mobile sign-in view needs screenshot proof before merge.',
 'Use ''acceptance criteria'' in a sentence about what must be true for work to count as done.',
 'curated', 'curator', '2026-05-25'),

-- systems
('sys-edge-function', 'Edge Function', null, 'systems', 'coding', 2,
 'A small server-side function deployed close to users, often used for API endpoints, webhooks, or secure backend work.',
 'An Edge Function is code that runs on the server at the network edge instead of inside the browser. Supabase and Vercel both use the phrase. It is a common place to handle secrets, call AI APIs, validate requests, send emails, or receive webhooks because the browser should not do those jobs directly.',
 'The personalize-term Edge Function calls the model and writes the rendered explanation.',
 'This app uses Edge Functions for the parts that need backend trust. Knowing the term helps you separate "frontend button" from "server-side work happened."',
 ARRAY['sys-webhook','dev-api','sys-authz']::text[],
 ARRAY['dev-api','sys-server']::text[],
 'sys-rls',
 ARRAY[
   'A React component rendered on the client',
   'A static image served from a CDN',
   'A local git branch with unpushed commits'
 ]::text[],
 'The personalize-term ___ calls the model and writes the rendered explanation.',
 'Use ''Edge Function'' in a sentence about secure backend work near the user.',
 'curated', 'curator', '2026-05-25'),

('sys-rls', 'RLS (row-level security)', 'R-L-S', 'systems', 'coding', 2,
 'A database rule system that decides which rows a logged-in user can read or change.',
 'Row-level security is authorization inside the database. Instead of trusting the app to filter rows correctly, the database checks a policy for each row: this user can see their own progress, but not anyone else''s; this user can insert their own report, but not edit someone else''s. Supabase relies heavily on RLS.',
 'RLS is blocking the query; the user is signed in, but the policy hides every row.',
 'When data "exists" but the app sees nothing, RLS is often the reason. Knowing the term helps you debug auth problems at the right layer.',
 ARRAY['sys-authz','sys-authn','sys-edge-function']::text[],
 ARRAY['sys-authz']::text[],
 'sys-idempotent',
 ARRAY[
   'A cache that stores API responses by URL',
   'A login method that sends a magic link',
   'A script that runs on a fixed schedule'
 ]::text[],
 '___ is blocking the query; the user is signed in, but the policy hides every row.',
 'Use ''RLS'' in a sentence about database policies hiding rows from the wrong user.',
 'curated', 'curator', '2026-05-25'),

('sys-idempotent', 'idempotent', null, 'systems', 'coding', 2,
 'Safe to run more than once because the repeated run leaves the system in the same final state.',
 'Idempotent is the word for "retry-safe." Creating the same settings row if it does not exist is idempotent; adding $10 to a balance every time is not. Migrations, webhook handlers, and retry jobs should often be idempotent so a timeout or second click does not duplicate work.',
 'Make the migration idempotent so rerunning it does not create duplicate rows.',
 'Agent work repeats commands. Webhooks retry. Deploy scripts get pasted twice. Idempotent is the word that keeps those repeats from becoming damage.',
 ARRAY['sys-webhook','sys-edge-function','dev-build']::text[],
 ARRAY['sys-webhook']::text[],
 'sys-rls',
 ARRAY[
   'Fast because it runs near the user',
   'Hidden behind a login screen',
   'Written in a strongly typed language'
 ]::text[],
 'Make the migration ___ so rerunning it does not create duplicate rows.',
 'Use ''idempotent'' in a sentence about a retry-safe operation.',
 'curated', 'curator', '2026-05-25'),

('sys-preview-environment', 'preview environment', null, 'systems', 'coding', 1,
 'A non-production environment built from a branch so changes can be tested before users get them.',
 'A preview environment is the whole temporary setting around a preview deployment: the branch build, its URL, feature flags, environment variables, auth behavior, and sometimes preview-only data. It should feel close to production, but it is allowed to be safer, smaller, or gated.',
 'The preview environment uses a protected URL, so curl failing does not always mean the deploy is broken.',
 'Preview environments are where you can review without touching production. Knowing the phrase helps separate "the app is broken" from "the preview has different gates."',
 ARRAY['ent-preview-deployment','ent-deployment-alias','dev-staging']::text[],
 ARRAY['ent-preview-deployment']::text[],
 'ent-stack-preview',
 ARRAY[
   'A local folder that stores build output',
   'A database backup created before a migration',
   'A production domain pointed at main'
 ]::text[],
 'The ___ uses a protected URL, so curl failing does not always mean the deploy is broken.',
 'Use ''preview environment'' in a sentence about testing a branch before production.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
