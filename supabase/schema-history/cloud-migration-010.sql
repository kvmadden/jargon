-- jargon Stage B3 — 27 more curated anchor terms for the dev-concepts path (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds 27 difficulty-1 anchor terms covering the most-used dev concepts beyond
-- README/API/deploy. All curated, reviewed by the curator on 2026-05-04. Idempotent —
-- `on conflict (id) do nothing` so re-runs are safe. Voice matches the existing
-- 48 anchors (git-commit / dev-readme template).
--
-- Dictionary count after this migration:
--   dev-concepts:  3 → 30  (3 existing + 27 new)
--   total:         48 → 75
--
-- dev-server / dev-client are CONCEPTUAL ("what is a server", "what is a client")
-- vs. the systems-engineering sys-server (a specific machine running an application).
-- The long_definitions name this distinction explicitly.
--
-- Cross-references: every related_terms / prerequisites / stretch_term id
-- resolves to one of the existing 48 anchors or one of these 27. The CHECK
-- constraint on multiple_choice_distractors (length = 3) is honored by every row.

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── dev-concepts: codebase shape (3) ─────────────────────────
('dev-repo', 'repository', 'repo', 'dev-concepts', 1,
 'A folder of code tracked by Git, with all of its history and branches in one place.',
 'A repository (almost always shortened to "repo") is the unit of a project in version control. It holds every file, every commit, every branch — the entire history of how the code got the way it is. A repo can live just on your laptop, but most teams sync them to a hosting service like GitHub.',
 'I cloned the repo last night and the README walks through setup pretty cleanly.',
 'Every Claude Code session opens inside a repo. When dev family says "send me the repo" or "is it on the same repo?" they mean this folder-plus-history bundle. Hearing repo and thinking "the project" makes most build conversations land.',
 ARRAY['git-clone','git-commit','dev-readme']::text[],
 ARRAY[]::text[],
 'git-fork',
 ARRAY[
   'A backup of a single source code file',
   'A live deployment of a web application',
   'A folder of compiled binaries ready to ship'
 ]::text[],
 'I cloned the ___ last night and the README walks through setup pretty cleanly.',
 'Use ''repo'' or ''repository'' in a sentence about a project tracked in version control.',
 'curated', 'curator', '2026-05-04'),

('dev-endpoint', 'endpoint', null, 'dev-concepts', 1,
 'A specific URL that an API exposes for one kind of request.',
 'An endpoint is a single address inside an API — `/users` to get users, `/login` to log in, `/orders/123` to fetch one order. Each endpoint accepts certain requests and returns certain responses. An API is really just a bundle of endpoints with a shared base URL.',
 'The /users endpoint returns 401 if the token is missing — that''s why the app is blank.',
 'Every "the API is broken" debugging conversation eventually narrows down to "which endpoint?" Knowing the term means you can talk about a specific URL on a specific service without losing precision.',
 ARRAY['dev-api','sys-rest','dev-backend']::text[],
 ARRAY['dev-api']::text[],
 null,
 ARRAY[
   'A page of an app a user can visit',
   'A device connected to a corporate network',
   'A point on a chart showing the latest data'
 ]::text[],
 'The /users ___ returns 401 if the token is missing — that''s why the app is blank.',
 'Use ''endpoint'' in a sentence about one specific URL on an API.',
 'curated', 'curator', '2026-05-04'),

('dev-frontend', 'frontend', null, 'dev-concepts', 1,
 'The part of an app that a user actually sees and interacts with — usually in a browser or on a phone.',
 'The frontend is everything that runs on the user''s device: buttons, screens, layouts, animations. React, Vue, and Swift UI are frontend frameworks. The frontend talks to the backend to get data and save changes, but the visual surface itself is its own world of code.',
 'The frontend is fine — the spinner just means the backend is taking forever to respond.',
 'Every Catalyst and side reaction app you build is mostly frontend code. When dev family asks "is the bug frontend or backend?" they''re narrowing down which half of the system to look at — fluency here cuts the search space in half.',
 ARRAY['dev-backend','dev-client','dev-framework']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'The first screen a user sees when launching an app',
   'A storefront page on an e-commerce site',
   'The marketing website for a software product'
 ]::text[],
 'The ___ is fine — the spinner just means the backend is taking forever to respond.',
 'Use ''frontend'' in a sentence about the visible part of an app.',
 'curated', 'curator', '2026-05-04'),

-- ─── dev-concepts: client/server roles (4) ────────────────────
('dev-backend', 'backend', null, 'dev-concepts', 1,
 'The part of an app that runs on a server — handling data, auth, and business logic out of sight of the user.',
 'The backend is everything the user doesn''t see directly: the database, the API, the auth checks, the scheduled jobs. When the frontend taps a button, the backend is what answers. Supabase is a backend; so is a custom Node server, a Rails app, or a Python API.',
 'I''ll wire the backend up to send the email — the frontend just needs to fire the request.',
 'Most "why doesn''t this work?" answers eventually point at the backend. Knowing the term lets you have precise conversations about where data lives, who can touch it, and why a request failed.',
 ARRAY['dev-frontend','dev-server','dev-database']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'The settings menu of an app',
   'A dashboard that admins use to manage users',
   'The codebase that handles user interface design'
 ]::text[],
 'I''ll wire the ___ up to send the email — the frontend just needs to fire the request.',
 'Use ''backend'' in a sentence about the server-side half of an app.',
 'curated', 'curator', '2026-05-04'),

('dev-server', 'server (concept)', null, 'dev-concepts', 1,
 'In the client/server model, the side that waits for requests and sends back responses.',
 'As a concept, "server" is a role: the program (or computer) that other programs call into. It''s the listener in the conversation. This is distinct from the systems sense of server (a specific machine you SSH into) — here, server just means "whichever side is being asked, not the side doing the asking."',
 'In a request/response model, the server is whoever responds — your phone is the client.',
 'Every API conversation assumes you understand the role of "server" in the abstract. Knowing the conceptual server (a role) vs. a specific machine makes architecture talk much easier to follow.',
 ARRAY['dev-client','dev-backend','sys-server']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A waiter at a restaurant who takes orders',
   'The fastest computer on a local network',
   'A program that runs only when a user clicks a button'
 ]::text[],
 'In a request/response model, the ___ is whoever responds — your phone is the client.',
 'Use ''server'' in a sentence about the side that responds to requests.',
 'curated', 'curator', '2026-05-04'),

('dev-client', 'client', null, 'dev-concepts', 1,
 'In the client/server model, the side that initiates a request and waits for a response.',
 'A client is whatever asks. Your phone is a client when it loads a webpage. Your browser is a client to the web server. The Anthropic SDK in Jargon is a client to the Anthropic API. Anything that says "give me this" is acting as a client in that moment.',
 'The mobile app is a client — every screen is asking the backend for data.',
 'When you read "the client sends a request" in API docs or hear "is it a client-side bug?" in a debug session, this is the role being talked about. Knowing the pair (client asks, server answers) unlocks how every networked app is wired.',
 ARRAY['dev-server','dev-frontend','dev-api']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A paying customer of a software company',
   'A team member assigned to write client documentation',
   'A spreadsheet shared between two people'
 ]::text[],
 'The mobile app is a ___ — every screen is asking the backend for data.',
 'Use ''client'' in a sentence about the side that asks for data.',
 'curated', 'curator', '2026-05-04'),

('dev-database', 'database (concept)', null, 'dev-concepts', 1,
 'The system of record for an app — where the data that has to outlive a single session lives.',
 'As a concept, the database is the persistent memory of an app. When you sign up, your account row gets written there. When you log in, the auth check reads from there. Without a database, every app would forget you the moment you closed it. (Distinct from the systems entry sys-database, which goes deeper into Postgres-style table mechanics.)',
 'Anything we want to remember across sessions has to live in the database, not in app state.',
 'Most app architecture conversations start with "where does the data live?" Knowing what a database IS — a permanent place to keep data — makes that question a clear starting point instead of a vague one.',
 ARRAY['dev-backend','sys-database','dev-server']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A list of contacts saved in a phone app',
   'A folder of backup files on an external drive',
   'A read-only document explaining the project schema'
 ]::text[],
 'Anything we want to remember across sessions has to live in the ___, not in app state.',
 'Use ''database'' in a sentence about where an app keeps its persistent data.',
 'curated', 'curator', '2026-05-04'),

-- ─── dev-concepts: code reuse (4) ─────────────────────────────
('dev-framework', 'framework', null, 'dev-concepts', 1,
 'A pre-built skeleton for an app — it dictates the structure and you fill in the specifics.',
 'A framework gives you the bones of an app: routing, state management, lifecycle hooks, conventions for where things go. React, Vue, Rails, Django, Next.js — all frameworks. The tradeoff is power for opinion: a framework saves you weeks but makes you do things its way.',
 'We picked Vite + React as the framework so the build pipeline came mostly for free.',
 'Every Jargon, Catalyst, and side reaction app sits on top of a framework (React + Vite). Knowing the term means you can read tutorials and pick the right tool for a job without confusing it with a library.',
 ARRAY['dev-library','dev-dependency','dev-frontend']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A small reusable function imported into your code',
   'A design system used to style components',
   'A test runner that executes your test files'
 ]::text[],
 'We picked Vite + React as the ___ so the build pipeline came mostly for free.',
 'Use ''framework'' in a sentence about the structural foundation of an app.',
 'curated', 'curator', '2026-05-04'),

('dev-library', 'library', null, 'dev-concepts', 1,
 'A bundle of pre-written code you call into when you need it — it doesn''t dictate your app''s structure.',
 'A library is something YOU call. Lodash, date-fns, Zustand — you import a function or a class, use it, and your code keeps the steering wheel. That''s the difference from a framework, which calls YOU. (Hollywood Principle: a library you call, a framework calls you.)',
 'I''m going to add a date library so we''re not hand-rolling timezone math.',
 'Almost every install you''ll do via npm is a library. Recognizing the difference between library (a tool you reach for) and framework (a structure you live inside) is the foundation for "should I add this dependency?" decisions.',
 ARRAY['dev-framework','dev-dependency','dev-package-manager']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A read-only reference of code examples',
   'A folder of documentation for an open-source project',
   'A platform that hosts your application code'
 ]::text[],
 'I''m going to add a date ___ so we''re not hand-rolling timezone math.',
 'Use ''library'' in a sentence about pulling in pre-written code for one specific job.',
 'curated', 'curator', '2026-05-04'),

('dev-dependency', 'dependency', null, 'dev-concepts', 1,
 'A piece of outside code your project relies on to work — usually a library installed via a package manager.',
 'Dependencies are the libraries (and their libraries, and so on) that your project needs to run. They''re listed in a manifest like `package.json` and installed into a folder like `node_modules`. Adding one is a tradeoff: you save time, but you take on whatever bugs and updates that code carries forever.',
 'Every dependency we add is one more thing to keep updated and one more thing that can break.',
 'When Claude Code says "I''m adding this as a dependency" or dev family asks "what are your dependencies?" they''re asking about the outside code your project leans on. Fluency here is what powers "should we even add this?" judgment.',
 ARRAY['dev-library','dev-package-manager','dev-framework']::text[],
 ARRAY['dev-library']::text[],
 null,
 ARRAY[
   'A required field on a form',
   'A user permission needed to run an action',
   'A test that another test relies on running first'
 ]::text[],
 'Every ___ we add is one more thing to keep updated and one more thing that can break.',
 'Use ''dependency'' in a sentence about a library your project pulls in.',
 'curated', 'curator', '2026-05-04'),

('dev-package-manager', 'package manager', null, 'dev-concepts', 1,
 'A tool that installs, updates, and removes the libraries your project depends on.',
 'A package manager (npm, yarn, pnpm for JavaScript; pip for Python; brew for macOS apps) reads a manifest file, figures out everything your project needs, and downloads it from a central registry. It also keeps a lockfile so every machine ends up with the exact same versions.',
 'Run the package manager after you pull — there are new dependencies in package.json.',
 'Every "I cloned the repo but it won''t run" answer is usually "did you run the package manager?" Knowing the term means you understand the install step that bridges fresh code and a working app.',
 ARRAY['dev-dependency','dev-library','dev-build']::text[],
 ARRAY['dev-dependency']::text[],
 null,
 ARRAY[
   'A program that organizes shipping containers',
   'A tool that compresses your code for production',
   'A service that hosts your dependencies on the cloud'
 ]::text[],
 'Run the ___ after you pull — there are new dependencies in package.json.',
 'Use ''package manager'' in a sentence about installing your project''s dependencies.',
 'curated', 'curator', '2026-05-04'),

-- ─── dev-concepts: local environment (3) ──────────────────────
('dev-env-variable', 'environment variable', 'env var', 'dev-concepts', 1,
 'A named value held outside your code — usually for secrets, URLs, or settings that change per environment.',
 'Environment variables (env vars) live alongside the code, not inside it. Things like API keys, database URLs, and feature flags get stored as env vars so the same code can run with different settings in dev, staging, and production. They''re also how you keep secrets out of Git.',
 'Put the Supabase key in an env var so we don''t commit it to the repo by accident.',
 'Every secret leak you have ever read about started with someone hardcoding a value that should have been an env var. Knowing the term means you understand both safety AND why "it works locally but not in production" usually means a missing env var.',
 ARRAY['dev-localhost','dev-staging','dev-deploy']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A constant defined at the top of a JavaScript file',
   'A configuration setting saved inside a database row',
   'A flag passed when calling a function'
 ]::text[],
 'Put the Supabase key in an ___ so we don''t commit it to the repo by accident.',
 'Use ''environment variable'' in a sentence about storing a secret outside your code.',
 'curated', 'curator', '2026-05-04'),

('dev-localhost', 'localhost', 'LOH-cul-host', 'dev-concepts', 1,
 'The address that always points to your own machine — used for running and testing apps locally.',
 '`localhost` (also written as `127.0.0.1`) means "this computer." When you run a dev server it usually listens on localhost so only your machine can reach it. URLs like `http://localhost:5173` mean "the app running on this laptop, on port 5173" — invisible to anyone else.',
 'The dev server is up at localhost:5173 — open it in Safari to test the touch targets.',
 'Every "open it in your browser" instruction in a Claude Code session points to localhost. Knowing the term means you understand the difference between testing on your own machine and testing somewhere the public can reach.',
 ARRAY['dev-port','dev-server','dev-staging']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A file path on the local filesystem',
   'A nickname for the production environment',
   'The name of the user logged into the operating system'
 ]::text[],
 'The dev server is up at ___:5173 — open it in Safari to test the touch targets.',
 'Use ''localhost'' in a sentence about an app running on your own computer.',
 'curated', 'curator', '2026-05-04'),

('dev-port', 'port', null, 'dev-concepts', 1,
 'A numbered channel on a computer that lets multiple programs share a network address without colliding.',
 'A port is like an apartment number in a building. The address (`localhost`) is the building; the port (`5173`, `3000`, `54321`) tells the network which program inside to deliver the request to. That''s how you can run a Vite dev server on 5173 and a Supabase server on 54321 at the same time without confusion.',
 'The other dev server is already on port 3000 — we''ll need to move one of them.',
 'Every "address already in use" error is a port collision. Recognizing port numbers in URLs and error messages means you can untangle "two things fighting for the same channel" in seconds.',
 ARRAY['dev-localhost','dev-server']::text[],
 ARRAY['dev-localhost']::text[],
 null,
 ARRAY[
   'A USB connector on the side of a laptop',
   'A version of a software product for a different platform',
   'A folder where downloaded files are stored'
 ]::text[],
 'The other dev server is already on ___ 3000 — we''ll need to move one of them.',
 'Use ''port'' in a sentence about which network channel an app is running on.',
 'curated', 'curator', '2026-05-04'),

-- ─── dev-concepts: build & ship (5) ───────────────────────────
('dev-build', 'build', null, 'dev-concepts', 1,
 'The packaged, optimized output of your source code — what you actually deploy.',
 'A build takes your raw source files (TypeScript, JSX, CSS, images) and runs them through a tool like Vite or webpack that bundles, minifies, and optimizes everything into a folder of static assets. The build is what gets uploaded to a server, never the source.',
 'The build failed because we forgot to install the new dependency on CI.',
 'Every deploy starts with a build. When Claude Code says "the build is broken" or "the build is clean," they''re reporting on the step that turns your code into something a server can actually serve.',
 ARRAY['dev-deploy','dev-package-manager','dev-ci-cd']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'The act of writing the first version of an app',
   'A user interface mockup made by a designer',
   'A meeting where the team plans the next feature'
 ]::text[],
 'The ___ failed because we forgot to install the new dependency on CI.',
 'Use ''build'' in a sentence about the packaged output of your source code.',
 'curated', 'curator', '2026-05-04'),

('dev-ship', 'ship', null, 'dev-concepts', 1,
 'To get a feature into users'' hands — usually by deploying the build to production.',
 'Ship is the verb every dev uses for "we''re done, it''s out there." It''s lighter than "deploy" (which is the technical action) and broader — you can ship a feature, ship a fix, ship an entire app. The opposite is "blocked" or "still in review."',
 'I want to ship the streak fix today so users on a Friday-night streak don''t lose it.',
 'Some teams live by "ship polished tools, never MVPs" — ship is the word for the moment work crosses from "in progress" to "real for users." Hearing it in standup or in Claude Code makes the cadence of release talk land naturally.',
 ARRAY['dev-deploy','dev-build','dev-staging']::text[],
 ARRAY['dev-deploy']::text[],
 null,
 ARRAY[
   'Boxing up software on physical media to mail to customers',
   'Demoing a feature to stakeholders before release',
   'Filing a ticket asking another team to release something'
 ]::text[],
 'I want to ___ the streak fix today so users on a Friday-night streak don''t lose it.',
 'Use ''ship'' in a sentence about getting a feature in front of users.',
 'curated', 'curator', '2026-05-04'),

('dev-staging', 'staging vs production', null, 'dev-concepts', 1,
 'Two parallel deployments of your app — staging is for final testing, production is the live version users see.',
 'Most teams keep at least two environments. Staging is a near-identical copy of production where the team tests builds before users see them. Production (often shortened to "prod") is the real thing — the version a customer hits when they open the app. The cardinal sin is shipping to prod without checking staging first.',
 'I''ll deploy to staging tonight and check it on the iPhone 14 before pushing to prod tomorrow.',
 'Every grown-up release process has a staging step. When dev family says "is it on staging or prod?" they''re asking how cooked it is — knowing the pair makes you fluent in release-readiness conversations.',
 ARRAY['dev-deploy','dev-ship','dev-env-variable']::text[],
 ARRAY['dev-deploy']::text[],
 'dev-feature-flag',
 ARRAY[
   'A development branch and a release branch',
   'A test runner and a build runner',
   'A debug log and a production log'
 ]::text[],
 'I''ll deploy to ___ tonight and check it on the iPhone 14 before pushing to prod tomorrow.',
 'Use ''staging'' or ''production'' in a sentence about where your app is currently deployed.',
 'curated', 'curator', '2026-05-04'),

('dev-ci-cd', 'CI/CD', 'C-I-C-D', 'dev-concepts', 1,
 'Automated pipelines that test your code on every push and ship it when the tests pass.',
 'CI (Continuous Integration) means every commit triggers an automated run of your tests and build. CD (Continuous Deployment, or Continuous Delivery) means a passing CI run automatically deploys to staging — sometimes even straight to production. GitHub Actions, Vercel, and Netlify all run CI/CD pipelines.',
 'CI just went red — the new test is failing on Node 18 but passing locally on 20.',
 'Every "is the build green?" or "did CI pass?" question in tech orgs is about CI/CD. Knowing the term means you can read pipeline status badges and understand why a PR is or isn''t mergeable yet.',
 ARRAY['dev-build','dev-deploy','dev-unit-test']::text[],
 ARRAY['dev-build']::text[],
 null,
 ARRAY[
   'A coding style enforcement system',
   'A two-person code review process',
   'A scheduled rotation of who handles bugs'
 ]::text[],
 '___ just went red — the new test is failing on Node 18 but passing locally on 20.',
 'Use ''CI/CD'' in a sentence about an automated test-and-deploy pipeline.',
 'curated', 'curator', '2026-05-04'),

('dev-unit-test', 'unit test', null, 'dev-concepts', 1,
 'A small automated test that checks one piece of code in isolation.',
 'A unit test takes a single function (or a single component) and verifies it does what it''s supposed to with a few specific inputs. The "unit" is small on purpose — when a unit test fails, you know exactly which piece broke. Vitest and Jest are common unit-test runners for JS/TS.',
 'I''ll add a unit test for the streak math so we catch any timezone regressions early.',
 'Every Jargon test in `src/lib/__tests__/` is a unit test. Knowing the term separates "tests one small thing" (unit) from "tests how things work together" (integration) — the most common test-talk distinction.',
 ARRAY['dev-integration-test','dev-bug','dev-ci-cd']::text[],
 ARRAY[]::text[],
 'dev-integration-test',
 ARRAY[
   'A manual test performed by a human tester',
   'A performance test that measures app speed',
   'A test that runs the entire app end to end'
 ]::text[],
 'I''ll add a ___ for the streak math so we catch any timezone regressions early.',
 'Use ''unit test'' in a sentence about checking one small piece of code automatically.',
 'curated', 'curator', '2026-05-04'),

('dev-integration-test', 'integration test', null, 'dev-concepts', 1,
 'An automated test that exercises several pieces working together — usually slower and broader than a unit test.',
 'An integration test stitches multiple parts of your code together (or hits a real database, or talks to a real API) to verify they cooperate. They catch bugs that unit tests miss — the ones that only show up when two correct pieces meet — but they take longer and break more easily as the system changes.',
 'The unit tests pass but the integration test caught a bug at the auth/database boundary.',
 'When dev family says "the integration suite is flaky" or Claude Code differentiates "unit" from "integration" tests, knowing the term clarifies which level of confidence you''re currently at.',
 ARRAY['dev-unit-test','dev-bug','dev-ci-cd']::text[],
 ARRAY['dev-unit-test']::text[],
 null,
 ARRAY[
   'A test of how two designers'' mockups merge together',
   'A test that runs only on the production database',
   'A test that measures how long your app takes to start'
 ]::text[],
 'The unit tests pass but the ___ caught a bug at the auth/database boundary.',
 'Use ''integration test'' in a sentence about testing how multiple parts of an app work together.',
 'curated', 'curator', '2026-05-04'),

-- ─── dev-concepts: bugs & maintenance (5) ─────────────────────
('dev-bug', 'bug', null, 'dev-concepts', 1,
 'A defect in code that causes the app to behave incorrectly.',
 'A bug is anything the code does that it''s not supposed to do — a wrong calculation, a button that doesn''t respond, a layout that breaks on iPhone. The term comes from a literal moth jammed in an early computer in 1947. Most engineering work is split between adding features and squashing bugs.',
 'I just hit a bug where the streak resets at the wrong hour — going to investigate now.',
 'Bug is the universal word for "something is broken." When you log a JIRA ticket as a bug, when Claude Code says "I see a bug here," when dev family asks "is that a bug or a feature?" — same word, same idea. Foundational vocabulary.',
 ARRAY['dev-issue-ticket','dev-unit-test','dev-refactor']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A new feature requested by a user',
   'A small icon used in an interface',
   'A planned interruption for system maintenance'
 ]::text[],
 'I just hit a ___ where the streak resets at the wrong hour — going to investigate now.',
 'Use ''bug'' in a sentence about something not working right in code.',
 'curated', 'curator', '2026-05-04'),

('dev-issue-ticket', 'issue / ticket', null, 'dev-concepts', 1,
 'A tracked record of one piece of work — a bug to fix, a feature to build, or a chore to handle.',
 '"Issue" is what GitHub and most open-source tools call a tracked piece of work. "Ticket" is what JIRA and most enterprise tools call the same thing. Both are the same idea: a single line item with a title, description, assignee, and status that the team can talk about and track to completion.',
 'Open an issue on the repo with the screenshot so I don''t lose track of it.',
 'Every piece of engineering work eventually becomes an issue or a ticket somewhere. Knowing they''re the same idea (issue = ticket = one bounded chunk of work) means you can navigate any team''s tracker without re-learning the vocabulary.',
 ARRAY['agile-ticket','ent-jira','dev-bug']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'An invoice for software services',
   'A merge request awaiting review',
   'A monitoring alert from a server'
 ]::text[],
 'Open an ___ on the repo with the screenshot so I don''t lose track of it.',
 'Use ''issue'' or ''ticket'' in a sentence about tracking one piece of work.',
 'curated', 'curator', '2026-05-04'),

('dev-mvp', 'MVP', 'M-V-P', 'dev-concepts', 1,
 'Minimum Viable Product — the smallest version of an app that delivers core value, shipped to learn from real users.',
 'MVP is the strip-it-down philosophy: build the least amount of product you can get away with, ship it, see what real users do, iterate. The opposite of a polished launch. One common rule is "ship polished tools, never MVPs" — but the term shows up everywhere in startup and tech-family conversations.',
 'They''re calling this v0.1 release an MVP so they can learn from real usage before adding more.',
 'When dev family or a tech podcast says "we shipped an MVP," they mean "barely-there but in users'' hands." Knowing the term means you understand the cultural philosophy you''re reacting against — and can explain why your work doesn''t look like one.',
 ARRAY['dev-ship','dev-feature-flag','dev-refactor']::text[],
 ARRAY['dev-ship']::text[],
 null,
 ARRAY[
   'Most Valuable Programmer — a top-performing engineer',
   'A staging copy of an app reserved for QA',
   'A pricing tier with the smallest feature set'
 ]::text[],
 'They''re calling this v0.1 release an ___ so they can learn from real usage before adding more.',
 'Use ''MVP'' in a sentence about a stripped-down first version of a product.',
 'curated', 'curator', '2026-05-04'),

('dev-refactor', 'refactor', null, 'dev-concepts', 1,
 'Rewriting how code is built without changing what it does — like reorganizing a workflow without changing the output.',
 'A refactor restructures the inside of a piece of code (clearer names, fewer files, less duplication, better abstractions) while keeping the external behavior identical. Done well, the user notices nothing — but the next change becomes easier. Done badly, you introduce bugs while telling yourself you weren''t.',
 'Let''s refactor the lesson engine before we add the new SRS rules — it''s getting hard to read.',
 'When Claude Code says "I''m going to refactor this" or dev family asks "is this a refactor or a feature?" they''re drawing the line between "shape change" and "behavior change." Knowing the term keeps you on the right side of that distinction.',
 ARRAY['dev-bug','dev-tech-debt','dev-legacy']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'Adding a new feature requested by users',
   'Reverting a commit that introduced a bug',
   'Translating an app into a new spoken language'
 ]::text[],
 'Let''s ___ the lesson engine before we add the new SRS rules — it''s getting hard to read.',
 'Use ''refactor'' in a sentence about rewriting code without changing what it does.',
 'curated', 'curator', '2026-05-04'),

('dev-legacy', 'legacy code', null, 'dev-concepts', 1,
 'Older code that''s still running in production — usually inherited, often poorly understood, expensive to change.',
 'Legacy code is anything the team is afraid to touch: old enough that the original authors are gone, important enough that you can''t delete it, fragile enough that small changes break it in surprising places. Most enterprise codebases (large enterprise systems included) are mostly legacy, with new features built carefully on top.',
 'Half the migration is wading through legacy code from before the rewrite in 2018.',
 'Anything older than a few years in a big company becomes legacy. When dev family complains about "the legacy auth system" or "I''ve been stuck in legacy all week," knowing the term gives the complaint texture: it''s old, dangerous, and slow to change.',
 ARRAY['dev-tech-debt','dev-refactor','dev-bug']::text[],
 ARRAY[]::text[],
 'dev-tech-debt',
 ARRAY[
   'Code written by a junior developer that needs review',
   'Sample code copied from a tutorial into a project',
   'Old commits that haven''t been merged into main'
 ]::text[],
 'Half the migration is wading through ___ from before the rewrite in 2018.',
 'Use ''legacy code'' in a sentence about old, hard-to-change code in a project.',
 'curated', 'curator', '2026-05-04'),

('dev-tech-debt', 'tech debt', null, 'dev-concepts', 1,
 'The future cost of taking shortcuts now — code or design decisions you''ll have to come back and pay for later.',
 'Tech debt is the metaphor every engineer uses for "we did the fast thing instead of the right thing, and someday we''ll pay interest on that." Hardcoded values, missing tests, copy-pasted code, abandoned-but-still-running services — all tech debt. Some debt is fine; too much makes every new feature slow.',
 'We''re taking on tech debt by skipping tests for the launch — let''s log it and circle back in two weeks.',
 'When dev family says "we have a ton of tech debt" or PMs say "we need a debt sprint," this is what they mean. Knowing the term means you can have honest "shortcut now, pay later" conversations instead of pretending shortcuts are free.',
 ARRAY['dev-legacy','dev-refactor','dev-mvp']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'Money owed to a software vendor',
   'A backlog of unfixed bugs in a tracker',
   'Salaries owed to engineering staff'
 ]::text[],
 'We''re taking on ___ by skipping tests for the launch — let''s log it and circle back in two weeks.',
 'Use ''tech debt'' in a sentence about a shortcut you''ll have to fix later.',
 'curated', 'curator', '2026-05-04'),

-- ─── dev-concepts: release control (1) ────────────────────────
('dev-feature-flag', 'feature flag', null, 'dev-concepts', 1,
 'A switch in your code that turns a feature on or off without redeploying — used to ship safely.',
 'A feature flag wraps new code in an `if` that checks a remote setting. You can ship the code dark (everyone sees the old behavior), then flip it on for 1%, 10%, 100% of users without touching the build. If something breaks, you flip it back off in seconds — no rollback deploy needed.',
 'Put the new lesson UI behind a feature flag so we can roll it out to me first before everyone sees it.',
 'Big tech companies ship dozens of features a day behind flags. Knowing the term means you understand "ship code ≠ release feature" — they''re separable, and that separation is how mature teams move fast without breaking things.',
 ARRAY['dev-staging','dev-ship','dev-deploy']::text[],
 ARRAY['dev-ship']::text[],
 null,
 ARRAY[
   'A label attached to a JIRA ticket',
   'A required field on a settings screen',
   'A warning banner shown to admin users'
 ]::text[],
 'Put the new lesson UI behind a ___ so we can roll it out to me first before everyone sees it.',
 'Use ''feature flag'' in a sentence about controlling whether a feature is on or off in production.',
 'curated', 'curator', '2026-05-04')

on conflict (id) do nothing;
