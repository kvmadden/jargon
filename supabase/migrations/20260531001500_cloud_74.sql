-- jargon Stage B+1.34 - developer workflow foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for practical developer workflow literacy:
-- repositories, branches, commits, diffs, pull requests, code review, rebases,
-- merges, merge conflicts, CI, builds, artifacts, localhost, ports, and debuggers.
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

('flow-repository', 'repository', 'repo', 'systems', 'coding', 1,
 'The version-controlled home for a codebase.',
 'A repository, often shortened to repo, is the folder and history for a project tracked by version control. It contains files, commits, branches, tags, and the story of how the code changed. A repo may live locally, on GitHub, or in both places.',
 'The jargon repository holds the React app, Supabase migrations, tests, and docs.',
 'Repository is the "where does the project live?" word. It helps you orient before talking about branches, commits, pull requests, or local changes.',
 ARRAY['flow-branch','flow-commit','git-remote','dev-repo']::text[],
 ARRAY['dev-repo']::text[],
 'flow-branch',
 ARRAY[
   'A runtime metric tracked over time',
   'A browser rule for cross-origin requests',
   'A model input used during training'
 ]::text[],
 'The jargon ___ holds the React app, Supabase migrations, tests, and docs.',
 'Use ''repository'' or ''repo'' in a sentence about a version-controlled project.',
 'curated', 'curator', '2026-05-26'),

('flow-branch', 'branch', null, 'systems', 'coding', 1,
 'A separate line of work in version control.',
 'A branch lets work happen without changing the main line immediately. Developers create branches for fixes, experiments, PRs, or stacked work. The branch can later be merged, rebased, or discarded.',
 'The content pack lived on a branch until it was ready for review.',
 'Branch is the safe-work word. It helps you understand how multiple changes can be developed without all landing on main at once.',
 ARRAY['flow-repository','flow-commit','flow-pull-request','flow-merge']::text[],
 ARRAY['flow-repository']::text[],
 'flow-pull-request',
 ARRAY[
   'A database constraint for valid rows',
   'A CDN cache near users',
   'A service-level objective'
 ]::text[],
 'The content pack lived on a ___ until it was ready for review.',
 'Use ''branch'' in a sentence about a separate line of code work.',
 'curated', 'curator', '2026-05-26'),

('flow-commit', 'commit', null, 'systems', 'coding', 1,
 'A saved snapshot of code changes with a message.',
 'A commit records a specific set of file changes in Git history. It has an id, author, timestamp, and message. Good commits make progress reviewable and reversible because each one explains what changed and why.',
 'The commit added the QA lessons and their matching tests.',
 'Commit is the saved-progress word. It helps you talk about the exact change, not just the current folder state.',
 ARRAY['flow-branch','flow-diff','flow-pull-request','git-sha']::text[],
 ARRAY['flow-branch']::text[],
 'flow-diff',
 ARRAY[
   'A live server port',
   'A fake dependency used in tests',
   'A cloud runtime environment'
 ]::text[],
 'The ___ added the QA lessons and their matching tests.',
 'Use ''commit'' in a sentence about saving code changes into history.',
 'curated', 'curator', '2026-05-26'),

('flow-diff', 'diff', null, 'systems', 'coding', 1,
 'The visible change between two versions of files.',
 'A diff shows what lines were added, removed, or changed between two versions. Code review usually starts by reading the diff, because it makes the actual change visible without rereading the whole project.',
 'The diff showed one new migration, two content files, and version-pill updates.',
 'Diff is the "what actually changed?" word. It helps you inspect work without relying on a summary.',
 ARRAY['flow-commit','flow-code-review','flow-pull-request']::text[],
 ARRAY['flow-commit']::text[],
 'flow-code-review',
 ARRAY[
   'A request routed across healthy servers',
   'A CPU instruction family',
   'A model output confidence score'
 ]::text[],
 'The ___ showed one new migration, two content files, and version-pill updates.',
 'Use ''diff'' in a sentence about comparing file changes.',
 'curated', 'curator', '2026-05-26'),

('flow-pull-request', 'pull request (PR)', 'P-R or pull request', 'systems', 'coding', 1,
 'A reviewable proposal to merge code changes.',
 'PR stands for pull request. A pull request packages branch changes for review before they merge into another branch, usually main. It shows commits, diffs, tests, discussion, approvals, and merge status.',
 'The PR showed the new migration, test coverage, and preview link.',
 'Pull request is the collaboration word for code changes. It helps you understand where review, CI, comments, and merge decisions happen.',
 ARRAY['flow-branch','flow-code-review','flow-ci','flow-merge']::text[],
 ARRAY['flow-branch','flow-commit']::text[],
 'flow-code-review',
 ARRAY[
   'A local port used by a dev server',
   'A test setup file with known data',
   'A serverless function runtime'
 ]::text[],
 'The ___ showed the new migration, test coverage, and preview link.',
 'Use ''PR'' or ''pull request'' in a sentence about proposing code for review.',
 'curated', 'curator', '2026-05-26'),

('flow-code-review', 'code review', null, 'systems', 'coding', 1,
 'Human or agent inspection of proposed code changes.',
 'Code review means reading a change before it lands to look for bugs, missing tests, unclear design, risky behavior, and maintainability problems. It often happens on a pull request, but it can also happen locally or in an agent thread.',
 'The code review caught that the docs still mentioned the old migration range.',
 'Code review is the second-pair-of-eyes word. It helps you separate implementation from independent inspection.',
 ARRAY['flow-pull-request','flow-diff','qa-regression-test','flow-ci']::text[],
 ARRAY['flow-diff','flow-pull-request']::text[],
 'qa-regression-test',
 ARRAY[
   'A database row identity',
   'A network latency measurement',
   'A background operating-system process'
 ]::text[],
 'The ___ caught that the docs still mentioned the old migration range.',
 'Use ''code review'' in a sentence about inspecting proposed changes.',
 'curated', 'curator', '2026-05-26'),

('flow-rebase', 'rebase', null, 'systems', 'coding', 2,
 'Moving commits onto a newer base branch.',
 'A rebase takes commits from one branch and replays them on top of another base, often the latest main. Rebasing can make history linear and update a branch without a merge commit, but it can also require resolving conflicts carefully.',
 'The feature branch needed a rebase after main gained new migrations.',
 'Rebase is the "move my work onto newer ground" word. It helps you understand why a branch can be current yesterday and stale today.',
 ARRAY['flow-branch','flow-commit','flow-merge','flow-conflict']::text[],
 ARRAY['flow-branch','flow-commit']::text[],
 'flow-conflict',
 ARRAY[
   'A cache rule for CDN assets',
   'A customer-facing reliability promise',
   'A test double for an email service'
 ]::text[],
 'The feature branch needed a ___ after main gained new migrations.',
 'Use ''rebase'' in a sentence about moving commits onto a newer base.',
 'curated', 'curator', '2026-05-26'),

('flow-merge', 'merge', null, 'systems', 'coding', 1,
 'Combining changes from one branch into another.',
 'A merge brings branch changes into another branch. Git tries to combine the histories and file changes automatically. If two branches changed the same area differently, a merge conflict may need a human decision.',
 'After review, the branch was ready to merge into main.',
 'Merge is the "bring it together" word. It helps you understand the moment proposed work becomes part of the shared line.',
 ARRAY['flow-branch','flow-pull-request','flow-conflict','flow-rebase']::text[],
 ARRAY['flow-branch','flow-pull-request']::text[],
 'flow-conflict',
 ARRAY[
   'A local URL for the developer machine',
   'A structured incident review',
   'A row inserted during test setup'
 ]::text[],
 'After review, the branch was ready to ___ into main.',
 'Use ''merge'' in a sentence about combining branch changes.',
 'curated', 'curator', '2026-05-26'),

('flow-conflict', 'merge conflict', null, 'systems', 'coding', 2,
 'A place where Git cannot automatically combine changes.',
 'A merge conflict happens when Git sees competing edits and cannot safely choose the right result. Someone must inspect the conflict markers, keep the correct lines, remove the markers, and rerun verification.',
 'The README had a merge conflict because two branches edited the migration range.',
 'Merge conflict is the "Git needs a decision" word. It helps you understand why combining branches can require careful human judgment.',
 ARRAY['flow-merge','flow-rebase','flow-diff','flow-branch']::text[],
 ARRAY['flow-merge','flow-rebase']::text[],
 'flow-rebase',
 ARRAY[
   'An uptime promise to customers',
   'A browser security boundary',
   'A model overfitting its training data'
 ]::text[],
 'The README had a ___ because two branches edited the migration range.',
 'Use ''merge conflict'' in a sentence about Git needing a human combine decision.',
 'curated', 'curator', '2026-05-26'),

('flow-ci', 'CI', 'C-I', 'systems', 'coding', 1,
 'Continuous Integration: automated checks that run after code changes.',
 'CI stands for Continuous Integration. CI systems run builds, tests, linting, type checks, and other gates when code changes. Good CI catches problems before humans merge or deploy a broken branch.',
 'CI failed because one content-integrity test caught a missing scenario card.',
 'CI is the automated-review word. It helps you understand why a green local run still needs shared checks before merge.',
 ARRAY['flow-pull-request','flow-build','qa-regression-test','qa-test-coverage']::text[],
 ARRAY['flow-pull-request','qa-unit-test']::text[],
 'flow-build',
 ARRAY[
   'A local server port',
   'A manual code review comment',
   'A database join'
 ]::text[],
 '___ failed because one content-integrity test caught a missing scenario card.',
 'Use ''CI'' in a sentence about automated checks after code changes.',
 'curated', 'curator', '2026-05-26'),

('flow-build', 'build', null, 'systems', 'coding', 1,
 'Turning source code into runnable output.',
 'A build turns source files into something the runtime can use: bundled JavaScript, compiled TypeScript, CSS assets, server output, or a container image. A build can fail even when the editor looks fine.',
 'The build failed because TypeScript found a missing import.',
 'Build is the "can the code become a runnable app?" word. It helps you distinguish writing source from producing an artifact that can ship.',
 ARRAY['flow-artifact','flow-ci','cloud-deploy','dev-build']::text[],
 ARRAY['flow-ci']::text[],
 'flow-artifact',
 ARRAY[
   'A traffic router for servers',
   'A reliability target inside a team',
   'A prepared test dataset'
 ]::text[],
 'The ___ failed because TypeScript found a missing import.',
 'Use ''build'' in a sentence about turning source code into runnable output.',
 'curated', 'curator', '2026-05-26'),

('flow-artifact', 'artifact', null, 'systems', 'coding', 2,
 'A generated file or bundle produced by a build.',
 'An artifact is an output from a build or automation step: a bundled app, test report, coverage file, container image, source map, or downloadable package. Artifacts are generated outputs, not usually hand-edited source files.',
 'The deployment used the build artifact from the passing CI run.',
 'Artifact is the generated-output word. It helps you understand what a build produced and what a deploy actually consumes.',
 ARRAY['flow-build','flow-ci','cloud-image','dev-build-artifact']::text[],
 ARRAY['flow-build']::text[],
 'cloud-deploy',
 ARRAY[
   'A branch waiting for review',
   'A hidden credential in an environment',
   'A runtime process managed by the OS'
 ]::text[],
 'The deployment used the build ___ from the passing CI run.',
 'Use ''artifact'' in a sentence about a generated build output.',
 'curated', 'curator', '2026-05-26'),

('flow-localhost', 'localhost', null, 'systems', 'coding', 1,
 'The developer machine addressed as a local server.',
 'Localhost is a hostname that points back to the same machine you are using. When a dev server runs at localhost:5173, the browser is talking to a server on your own computer, not the public internet.',
 'you opened localhost to test the app before checking the preview URL.',
 'Localhost is the "this machine" word. It helps you separate private local behavior from deployed preview or production behavior.',
 ARRAY['flow-port','cloud-environment','sys-origin','dev-localhost']::text[],
 ARRAY['cloud-environment']::text[],
 'flow-port',
 ARRAY[
   'A pull request review decision',
   'A model validation dataset',
   'A database constraint'
 ]::text[],
 'you opened ___ to test the app before checking the preview URL.',
 'Use ''localhost'' in a sentence about a local dev server.',
 'curated', 'curator', '2026-05-26'),

('flow-port', 'port', null, 'systems', 'coding', 1,
 'A number that lets multiple local services listen separately.',
 'A port is a numbered endpoint on a machine. Local dev servers, databases, and APIs can all run on the same computer because each listens on a different port, such as 5173, 3000, or 5432.',
 'Vite served the app on port 5173 while another project used port 3000.',
 'Port is the address-detail word. It helps you understand why localhost can host several different services at once.',
 ARRAY['flow-localhost','net-port','sys-origin','os-process']::text[],
 ARRAY['flow-localhost','net-port']::text[],
 'sys-origin',
 ARRAY[
   'A code review comment',
   'A generated build bundle',
   'A traceability link'
 ]::text[],
 'Vite served the app on ___ 5173 while another project used port 3000.',
 'Use ''port'' in a sentence about multiple services listening on one machine.',
 'curated', 'curator', '2026-05-26'),

('flow-debugger', 'debugger', null, 'systems', 'coding', 2,
 'A tool for pausing code and inspecting state while it runs.',
 'A debugger lets a developer set breakpoints, pause execution, inspect variables, step through code, and understand why behavior is happening. It is different from logs because it lets you stop inside the running program.',
 'The debugger showed the route state before the lesson card rendered.',
 'Debugger is the "pause and inspect" word. It helps you understand a slower, more precise way to investigate behavior than guessing from output.',
 ARRAY['flow-localhost','cloud-log','qa-root-cause','code-stack-trace']::text[],
 ARRAY['flow-localhost','code-stack-trace']::text[],
 'qa-root-cause',
 ARRAY[
   'A customer uptime contract',
   'A database seed row',
   'A CDN cache rule'
 ]::text[],
 'The ___ showed the route state before the lesson card rendered.',
 'Use ''debugger'' in a sentence about pausing code and inspecting state.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
