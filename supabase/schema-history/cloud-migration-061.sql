-- jargon Stage B+1.22 - dev build literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 16 coding-domain terms that explain how a React/Vite app gets
-- installed, developed, checked, built, debugged, and reasoned about.
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

('dev-lockfile', 'lockfile', null, 'dev-concepts', 'coding', 1,
 'A file that pins the exact dependency versions a project installed.',
 'A lockfile is the package manager''s receipt. `package.json` might say a project accepts version 4.x of a library, but the lockfile records the exact version actually installed, plus the versions of every dependency underneath it. That is how you, CI, Vercel, and another agent can install the same project and get the same dependency tree.',
 'Commit the lockfile so CI installs the same dependency versions you tested locally.',
 'Lockfiles explain a huge class of "works on my machine" problems. If the lockfile changed, the project changed even when app code did not.',
 ARRAY['dev-package-manager','dev-dependency','dev-semver','dev-node-modules']::text[],
 ARRAY['dev-package-manager','dev-dependency']::text[],
 'dev-transitive-dependency',
 ARRAY[
   'A file that stores a user session token',
   'A Git branch that cannot be force-pushed',
   'A screenshot used as a visual baseline'
 ]::text[],
 'Commit the ___ so CI installs the same dependency versions you tested locally.',
 'Use ''lockfile'' in a sentence about keeping installs identical across machines.',
 'curated', 'curator', '2026-05-25'),

('dev-node-modules', 'node_modules', null, 'dev-concepts', 'coding', 1,
 'The local folder where JavaScript dependencies are installed.',
 '`node_modules` is the big generated folder full of packages your app depends on. You do not edit it by hand and you usually do not commit it. If it is missing or stale, the project may fail to run until the package manager installs dependencies again.',
 'Delete node_modules and reinstall if the local dependency tree seems stale.',
 'This is one of the first folders a new dev sees and one of the easiest to misunderstand. It is machinery, not source code.',
 ARRAY['dev-package-manager','dev-dependency','dev-lockfile']::text[],
 ARRAY['dev-package-manager']::text[],
 'dev-lockfile',
 ARRAY[
   'The folder where app screenshots are exported',
   'The database table for user accounts',
   'The Git folder that stores commit history'
 ]::text[],
 'Delete ___ and reinstall if the local dependency tree seems stale.',
 'Use ''node_modules'' in a sentence about installed JavaScript dependencies.',
 'curated', 'curator', '2026-05-25'),

('dev-semver', 'semantic versioning', 'SEM-ver', 'dev-concepts', 'coding', 2,
 'The major.minor.patch version pattern used to signal how risky an update is.',
 'Semantic versioning, often shortened to semver, uses versions like 2.4.1. The first number is major, the second is minor, and the third is patch. In theory, patch means bug fix, minor means backwards-compatible feature, and major means breaking change. In practice, it is a promise you still verify with tests.',
 'The package moved from 2.4.1 to 2.5.0, so semver says it should be a minor update.',
 'Dependency updates feel random until version numbers have meaning. Semver gives you a first read on whether an update should be boring or suspicious.',
 ARRAY['dev-lockfile','dev-dependency','dev-package-manager','dev-transitive-dependency']::text[],
 ARRAY['dev-dependency']::text[],
 'dev-transitive-dependency',
 ARRAY[
   'A naming pattern for Git branches',
   'A database migration numbering scheme',
   'A CSS scale for spacing tokens'
 ]::text[],
 'The package moved from 2.4.1 to 2.5.0, so ___ says it should be a minor update.',
 'Use ''semantic versioning'' in a sentence about reading a dependency version number.',
 'curated', 'curator', '2026-05-25'),

('dev-transitive-dependency', 'transitive dependency', null, 'dev-concepts', 'coding', 2,
 'A dependency your project gets indirectly because another dependency needs it.',
 'A transitive dependency is not one you chose directly. Your app installs library A, library A installs library B, and now library B is part of your project too. Security alerts and build breaks often come from these indirect packages, which is why dependency trees can be deeper than the list in `package.json`.',
 'The vulnerability came from a transitive dependency several layers below the package we installed.',
 'This term turns a confusing audit report into a map: the risky package may be in the tree even if you never asked for it by name.',
 ARRAY['dev-dependency','dev-package-manager','dev-lockfile','dev-semver']::text[],
 ARRAY['dev-dependency','dev-package-manager']::text[],
 'dev-lockfile',
 ARRAY[
   'A component nested inside another component',
   'A PR stacked on top of another PR',
   'A redirect created by a router'
 ]::text[],
 'The vulnerability came from a ___ several layers below the package we installed.',
 'Use ''transitive dependency'' in a sentence about an indirect package in a dependency tree.',
 'curated', 'curator', '2026-05-25'),

('dev-build-artifact', 'build artifact', null, 'dev-concepts', 'coding', 1,
 'A generated output file or folder produced by the build step.',
 'A build artifact is the thing a build leaves behind: compiled JavaScript, CSS bundles, static assets, coverage reports, or a deployable `dist` folder. Source code is what humans edit; artifacts are what tools produce. If an artifact is stale, the app can show old behavior even after source files changed.',
 'Vercel serves the build artifact, not the raw TypeScript files you edited.',
 'Artifacts explain why "the code changed" and "the preview changed" are not the same sentence. A build has to produce the new output first.',
 ARRAY['dev-build','dev-bundler','dev-source-map','ent-preview-deployment']::text[],
 ARRAY['dev-build']::text[],
 'dev-source-map',
 ARRAY[
   'A hand-written component in the source tree',
   'A GitHub issue used for release planning',
   'A user profile row stored in Postgres'
 ]::text[],
 'Vercel serves the ___, not the raw TypeScript files you edited.',
 'Use ''build artifact'' in a sentence about generated output from a build.',
 'curated', 'curator', '2026-05-25'),

('dev-bundler', 'bundler', null, 'dev-concepts', 'coding', 2,
 'A build tool that turns many source files into browser-ready assets.',
 'A bundler follows imports through your app, collects the code and styles that are needed, transforms TypeScript or JSX, and writes browser-ready files. Vite uses Rollup for production builds. When an import path breaks or a dependency cannot be resolved, the bundler is often the thing complaining.',
 'The bundler failed because the component imported a file that does not exist.',
 'Bundler errors are loud but often useful. They tell you the app could not be turned into something the browser can actually load.',
 ARRAY['dev-build','dev-build-artifact','dev-source-map','dev-dependency']::text[],
 ARRAY['dev-build','dev-dependency']::text[],
 'dev-source-map',
 ARRAY[
   'A browser extension that records clicks',
   'A database job that batches writes',
   'A Git command that combines branches'
 ]::text[],
 'The ___ failed because the component imported a file that does not exist.',
 'Use ''bundler'' in a sentence about turning source files into browser-ready assets.',
 'curated', 'curator', '2026-05-25'),

('dev-source-map', 'source map', null, 'dev-concepts', 'coding', 2,
 'A file that connects bundled code back to the original source files for debugging.',
 'A source map is a translation guide for debuggers. The browser may be running minified bundled JavaScript, but the source map lets DevTools point an error back to `src/routes/splash.tsx` line 42. Without it, production errors can point at unreadable generated code.',
 'Turn on source maps so the browser error points back to the original component.',
 'Source maps are why a cryptic deployed error can become a specific file and line instead of a wall of bundled code.',
 ARRAY['dev-bundler','dev-build-artifact','dev-build','agile-visual-qa']::text[],
 ARRAY['dev-build']::text[],
 'dev-bundler',
 ARRAY[
   'A diagram of all routes in the app',
   'A migration that maps old data into a new table',
   'A list of terms linked to a lesson path'
 ]::text[],
 'Turn on ___ so the browser error points back to the original component.',
 'Use ''source map'' in a sentence about debugging bundled JavaScript.',
 'curated', 'curator', '2026-05-25'),

('dev-hot-reload', 'hot reload', null, 'dev-concepts', 'coding', 1,
 'A dev-server feature that updates the running app after a file changes.',
 'Hot reload watches source files while the dev server is running. When you edit a component or CSS file, the browser updates without a full manual restart. It is a speed feature, not proof that the production build works. Sometimes a weird local state bug disappears after a hard refresh because hot reload preserved state that a real load would reset.',
 'Hot reload updated the button style instantly, but we still need a real build before shipping.',
 'This is why local development feels alive. It also explains why a quick refresh can fix a local oddity without proving the underlying app is safe.',
 ARRAY['dev-localhost','dev-server','dev-build','dev-state']::text[],
 ARRAY['dev-localhost','dev-server']::text[],
 'dev-build',
 ARRAY[
   'A GitHub bot that posts PR comments',
   'A database policy that hides rows',
   'A package versioning rule'
 ]::text[],
 '___ updated the button style instantly, but we still need a real build before shipping.',
 'Use ''hot reload'' in a sentence about a dev server updating after a file edit.',
 'curated', 'curator', '2026-05-25'),

('dev-linter', 'linter', null, 'dev-concepts', 'coding', 1,
 'A tool that flags suspicious code patterns before the app runs.',
 'A linter scans source code for rules: unused variables, unsafe patterns, missing dependencies in React hooks, inconsistent imports, or code that violates the project style. It does not prove the app works, but it catches many small mistakes early and keeps the codebase from drifting into avoidable mess.',
 'The linter caught an unused variable before the build even started.',
 'Lint failures can look fussy until they prevent a real bug. The term helps you separate rule checks from runtime behavior.',
 ARRAY['dev-formatter','dev-typecheck','dev-test-runner','agile-regression-test']::text[],
 ARRAY['dev-build']::text[],
 'dev-typecheck',
 ARRAY[
   'A tool that packages source code for deployment',
   'A database table that logs model calls',
   'A browser view for manual QA'
 ]::text[],
 'The ___ caught an unused variable before the build even started.',
 'Use ''linter'' in a sentence about a code-quality rule check.',
 'curated', 'curator', '2026-05-25'),

('dev-formatter', 'formatter', null, 'dev-concepts', 'coding', 1,
 'A tool that rewrites code layout into a consistent style.',
 'A formatter handles code shape: spaces, wrapping, commas, indentation, and line breaks. Prettier is the common JavaScript example. The goal is not taste; the goal is to stop humans and agents from spending review energy on whether a line should wrap.',
 'Run the formatter so the diff only shows the real content change.',
 'Formatting is where a lot of noisy diffs come from. Knowing the term lets you ask whether a change is behavior or just code layout.',
 ARRAY['dev-linter','dev-typecheck','git-diff']::text[],
 ARRAY['dev-build']::text[],
 'dev-linter',
 ARRAY[
   'A tool that runs tests in watch mode',
   'A package that adds UI icons',
   'A deployment that previews a branch'
 ]::text[],
 'Run the ___ so the diff only shows the real content change.',
 'Use ''formatter'' in a sentence about consistent code layout.',
 'curated', 'curator', '2026-05-25'),

('dev-test-runner', 'test runner', null, 'dev-concepts', 'coding', 1,
 'A tool that finds test files, runs them, and reports pass or fail.',
 'A test runner is the program behind commands like `npm run test`. Vitest finds test files, sets up the environment, executes assertions, and reports which tests passed or failed. Playwright is a browser test runner for end-to-end checks. The tests are the recipes; the runner is the thing executing them.',
 'Vitest is the test runner for the content-integrity checks.',
 'When an agent says "the test runner failed," you can ask whether the app behavior failed, the test setup failed, or the runner could not even start.',
 ARRAY['dev-test-harness','dev-test-coverage','agile-regression-test','dev-snapshot-test']::text[],
 ARRAY['dev-test']::text[],
 'dev-test-coverage',
 ARRAY[
   'A user who tries the app before release',
   'A deployment branch for QA',
   'A package manager that installs libraries'
 ]::text[],
 'Vitest is the ___ for the content-integrity checks.',
 'Use ''test runner'' in a sentence about a tool that executes tests.',
 'curated', 'curator', '2026-05-25'),

('dev-test-coverage', 'test coverage', null, 'dev-concepts', 'coding', 2,
 'A measure of which code was touched by tests during a run.',
 'Test coverage tells you which lines, branches, or functions executed while tests ran. High coverage can be useful, but it is not the same as high confidence: a test can touch code without asserting the important behavior. Coverage is a map of what got exercised, not a grade on whether the tests are meaningful.',
 'Coverage says the route rendered, but it does not prove the mobile layout looked good.',
 'This keeps metrics in their lane. you cares about real confidence, and coverage is one signal, not the whole truth.',
 ARRAY['dev-test-runner','agile-regression-test','agile-visual-qa','dev-contract-test']::text[],
 ARRAY['dev-test-runner']::text[],
 'agile-regression-test',
 ARRAY[
   'A count of how many users finished onboarding',
   'A version number for a package release',
   'A cache setting for a static asset'
 ]::text[],
 '___ says the route rendered, but it does not prove the mobile layout looked good.',
 'Use ''test coverage'' in a sentence about what a test run exercised.',
 'curated', 'curator', '2026-05-25'),

('dev-component', 'component', null, 'dev-concepts', 'coding', 1,
 'A reusable piece of UI with its own inputs, rendering, and sometimes state.',
 'In React, a component is a function that returns UI. A button, version pill, quiz card, form, or whole route can be a component. Components receive inputs called props, may hold state, and re-render when their inputs or state change.',
 'The version pill is a component because it renders UI and owns its open/closed state.',
 'Component is the noun underneath most frontend work. It makes the UI feel like a set of named parts instead of one giant page.',
 ARRAY['dev-props','dev-state','dev-hook','dev-framework']::text[],
 ARRAY['dev-frontend','dev-framework']::text[],
 'dev-hook',
 ARRAY[
   'A database row that stores user progress',
   'A package installed by npm',
   'A Git commit that updates one feature'
 ]::text[],
 'The version pill is a ___ because it renders UI and owns its open/closed state.',
 'Use ''component'' in a sentence about a reusable React UI piece.',
 'curated', 'curator', '2026-05-25'),

('dev-props', 'props', null, 'dev-concepts', 'coding', 1,
 'Inputs passed into a component by whatever renders it.',
 'Props are how one React component gives another component information. A quiz card might receive a term, a list of answer options, and an `onAnswer` function as props. Props should be treated like read-only inputs: the child uses them, but the parent owns the decision to pass them.',
 'Pass the current term as props instead of making the card fetch its own data.',
 'Props explain a lot of frontend bugs: if the wrong value went in, the component may be innocent and the parent may be the place to look.',
 ARRAY['dev-component','dev-state','dev-hook','dev-typecheck']::text[],
 ARRAY['dev-component']::text[],
 'dev-state',
 ARRAY[
   'CSS classes generated during a build',
   'Secrets loaded from environment variables',
   'Rows returned by a database query'
 ]::text[],
 'Pass the current term as ___ instead of making the card fetch its own data.',
 'Use ''props'' in a sentence about inputs passed into a React component.',
 'curated', 'curator', '2026-05-25'),

('dev-state', 'state', null, 'dev-concepts', 'coding', 1,
 'Data an app or component remembers and uses to render the current screen.',
 'State is the live memory of the interface: whether a modal is open, which answer is selected, which user is signed in, or what text is in a form. When state changes, React re-renders the affected UI. Some state is local to one component; some lives in a store or database.',
 'The version pill stores open state so it knows whether to show the release notes.',
 'State is the word behind "why did the UI change when I clicked that?" It is also where many subtle bugs hide.',
 ARRAY['dev-component','dev-props','dev-hook','dev-hot-reload']::text[],
 ARRAY['dev-component']::text[],
 'dev-hook',
 ARRAY[
   'A file generated by the build step',
   'A Git branch waiting for review',
   'A package version saved in a lockfile'
 ]::text[],
 'The version pill stores open ___ so it knows whether to show the release notes.',
 'Use ''state'' in a sentence about data a component remembers while rendering.',
 'curated', 'curator', '2026-05-25'),

('dev-hook', 'hook', null, 'dev-concepts', 'coding', 2,
 'A React function that lets a component use state, effects, refs, or shared behavior.',
 'A hook is a special React function like `useState`, `useEffect`, `useMemo`, or a custom `useSomething` helper. Hooks let function components remember state, run side effects, cache work, and share behavior without classes. Hook bugs often come from stale dependencies or doing async work in the wrong lifecycle moment.',
 'Use a hook to close the version notes when the Escape key is pressed.',
 'Hooks are where modern React apps do most of their invisible work. Knowing the word makes frontend explanations much less foggy.',
 ARRAY['dev-component','dev-state','dev-props','dev-linter']::text[],
 ARRAY['dev-component','dev-state']::text[],
 'dev-hydration',
 ARRAY[
   'A link that sends users to another route',
   'A dependency installed from npm',
   'A deployment created from a pull request'
 ]::text[],
 'Use a ___ to close the version notes when the Escape key is pressed.',
 'Use ''hook'' in a sentence about React state or effects inside a component.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
