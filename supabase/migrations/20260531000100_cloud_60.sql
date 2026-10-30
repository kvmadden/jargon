-- jargon Stage B+1.21 - dev practice pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 13 coding-domain terms that make the quiz game surfaces richer:
-- fixtures, mocks, selectors, test harnesses, contract/snapshot tests,
-- hydration, retry/timeout/rate-limit loops, race conditions, cache
-- invalidation, and rollbacks.
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

-- dev-concepts / testing
('dev-test-harness', 'test harness', null, 'dev-concepts', 'coding', 2,
 'A controlled wrapper that lets you run one part of an app in isolation for testing.',
 'A test harness sets up the conditions a test needs: fake data, mocked services, a mounted component, a dev-only route, or a helper that starts the app in a known state. The point is not the harness itself; the point is making a messy real workflow small enough to test repeatedly.',
 'The /dev/quiz route is a test harness for quiz cards, so Playwright can exercise them without signing in.',
 'Good harnesses turn visual QA and bug reports into repeatable checks. They are how a vague "that card feels broken" becomes a button you can press every run.',
 ARRAY['dev-fixture','dev-mock','agile-smoke-test','agile-regression-test']::text[],
 ARRAY['dev-test']::text[],
 'dev-contract-test',
 ARRAY[
   'A production server that handles real user traffic',
   'A Git branch that contains several stacked PRs',
   'A design file exported from Figma'
 ]::text[],
 'The /dev/quiz route is a ___ for quiz cards, so Playwright can exercise them without signing in.',
 'Use ''test harness'' in a sentence about isolating part of an app for repeatable testing.',
 'curated', 'curator', '2026-05-25'),

('dev-fixture', 'fixture', null, 'dev-concepts', 'coding', 1,
 'Prepared test data used to put code into a known state.',
 'A fixture is a small, intentional chunk of fake or seeded data. It might be a user object, a term row, a transcript snippet, or a set of progress records. Tests use fixtures so they do not depend on whatever random data happens to exist in a live database.',
 'The quiz-card fixture includes one term, three distractors, and a fake progress row.',
 'When tests are hard to read, fixtures are often the missing noun. They let you see what world the test is pretending to be in.',
 ARRAY['dev-test-harness','dev-mock','agile-regression-test']::text[],
 ARRAY['dev-test']::text[],
 'dev-mock',
 ARRAY[
   'A live API response from production',
   'A browser screenshot after a release',
   'A pull request waiting for review'
 ]::text[],
 'The quiz-card ___ includes one term, three distractors, and a fake progress row.',
 'Use ''fixture'' in a sentence about prepared data for a test.',
 'curated', 'curator', '2026-05-25'),

('dev-mock', 'mock', null, 'dev-concepts', 'coding', 1,
 'A fake replacement for a real dependency, used so a test can control what happens.',
 'A mock stands in for something outside the code under test: a network request, database call, clock, file system, or browser API. The test controls the mock so it can prove how the app behaves when the dependency succeeds, fails, or returns a specific shape.',
 'Mock the Supabase OTP endpoint so the auth test does not send a real email.',
 'Mocks are why local tests can check risky flows without firing live webhooks, sending emails, or touching production data.',
 ARRAY['dev-fixture','dev-test-harness','dev-api']::text[],
 ARRAY['dev-test']::text[],
 'dev-contract-test',
 ARRAY[
   'A real customer account used for QA',
   'A database migration applied in production',
   'A CSS class that changes button color'
 ]::text[],
 '___ the Supabase OTP endpoint so the auth test does not send a real email.',
 'Use ''mock'' in a sentence about replacing a real dependency in a test.',
 'curated', 'curator', '2026-05-25'),

('dev-selector', 'selector', null, 'dev-concepts', 'coding', 1,
 'A stable way for code or tests to find one element on a page.',
 'A selector points at a specific element in the DOM. Tests can select by role, label, text, CSS, or data-testid. Good selectors match how a user understands the page when possible; brittle selectors depend on incidental layout or class names that change during polish.',
 'Use a role selector for the Google sign-in button instead of clicking the second button on the page.',
 'Most browser automation bugs are not logic bugs; they are selector bugs. Knowing the term makes it easier to ask whether the test is clicking the right thing.',
 ARRAY['dev-test-harness','agile-visual-qa','dev-framework']::text[],
 ARRAY['dev-test']::text[],
 'dev-snapshot-test',
 ARRAY[
   'A secret key stored in an environment variable',
   'A pull request label used for triage',
   'A database row returned by RLS'
 ]::text[],
 'Use a role ___ for the Google sign-in button instead of clicking the second button on the page.',
 'Use ''selector'' in a sentence about finding a page element in a browser test.',
 'curated', 'curator', '2026-05-25'),

('dev-snapshot-test', 'snapshot test', null, 'dev-concepts', 'coding', 2,
 'A test that stores a previous output and fails when the new output changes.',
 'A snapshot test saves the rendered output, serialized data, or generated text from one run, then compares future runs against it. It is useful for catching unexpected changes, but weak when the snapshot is huge or nobody reviews the diff. The test says "this changed"; a human still decides whether that change is good.',
 'The snapshot test failed because the version pill text changed from iteration 15 to iteration 16.',
 'Snapshot tests are easy to approve blindly. Knowing the term helps you ask the better question: did this change intentionally?',
 ARRAY['dev-selector','agile-regression-test','dev-test-harness']::text[],
 ARRAY['dev-test']::text[],
 'dev-contract-test',
 ARRAY[
   'A manual screenshot used in visual QA',
   'A test that calls a live payment webhook',
   'A branch created only for preview'
 ]::text[],
 'The ___ failed because the version pill text changed from iteration 15 to iteration 16.',
 'Use ''snapshot test'' in a sentence about detecting changed output.',
 'curated', 'curator', '2026-05-25'),

('dev-contract-test', 'contract test', null, 'dev-concepts', 'coding', 2,
 'A test that checks two pieces of software still agree on the shape they exchange.',
 'A contract test protects the boundary between systems. If the frontend expects `{ terms: [...] }` and the API starts returning `{ data: [...] }`, the contract broke even if both sides still build. Contract tests are especially useful around APIs, generated types, webhooks, and shared packages.',
 'Add a contract test so the Edge Function response still matches the TypeScript type the client expects.',
 'This repo has a lot of thin wiring between React, Supabase, Edge Functions, and generated types. Contract tests keep that wiring honest.',
 ARRAY['dev-api','dev-typecheck','dev-test-harness','dev-codegen']::text[],
 ARRAY['dev-api','dev-test']::text[],
 'dev-codegen',
 ARRAY[
   'A test that compares two screenshots pixel by pixel',
   'A checklist for whether a design feels polished',
   'A Git command that combines several commits'
 ]::text[],
 'Add a ___ so the Edge Function response still matches the TypeScript type the client expects.',
 'Use ''contract test'' in a sentence about two systems agreeing on a data shape.',
 'curated', 'curator', '2026-05-25'),

('dev-hydration', 'hydration', null, 'dev-concepts', 'coding', 2,
 'The browser step where JavaScript attaches behavior to HTML that was already rendered.',
 'Hydration happens when a page arrives with HTML already on screen and the client-side JavaScript boots up, connects React to that markup, and makes buttons, forms, and stateful components interactive. Hydration bugs often look like "the page is visible but clicking does nothing" or "the server rendered one thing and the browser expected another."',
 'The page looked loaded, but hydration had not finished, so the button did not respond yet.',
 'Modern web apps can fail between "I see it" and "I can use it." Hydration is the word for that awkward middle step.',
 ARRAY['dev-framework','dev-build','sys-cache']::text[],
 ARRAY['dev-framework']::text[],
 'dev-snapshot-test',
 ARRAY[
   'Uploading local commits to GitHub',
   'Checking database rows against RLS policies',
   'Generating TypeScript types from a schema'
 ]::text[],
 'The page looked loaded, but ___ had not finished, so the button did not respond yet.',
 'Use ''hydration'' in a sentence about JavaScript making already-rendered HTML interactive.',
 'curated', 'curator', '2026-05-25'),

-- systems / reliability
('sys-race-condition', 'race condition', null, 'systems', 'coding', 2,
 'A bug where the result depends on which async operation finishes first.',
 'A race condition happens when two things run at the same time and the app accidentally depends on their timing. It might pass locally and fail in production because one request, timer, tab, or render finished in a different order. The fix is usually to make the ordering explicit or make repeated events safe.',
 'The auth redirect had a race condition: the second render skipped the check while the first request was still resolving.',
 'Race conditions explain the worst kind of bug: real, intermittent, and hard to reproduce. Agent work hits them around auth, effects, previews, and retries.',
 ARRAY['sys-retry','sys-idempotent','sys-event-driven','dev-bug']::text[],
 ARRAY['sys-event-driven']::text[],
 'sys-idempotent',
 ARRAY[
   'A syntax error caused by a missing bracket',
   'A test failure caused by a wrong expected string',
   'A database table without an index'
 ]::text[],
 'The auth redirect had a ___: the second render skipped the check while the first request was still resolving.',
 'Use ''race condition'' in a sentence about timing-dependent async behavior.',
 'curated', 'curator', '2026-05-25'),

('sys-rate-limit', 'rate limit', null, 'systems', 'coding', 1,
 'A cap on how many requests a client can make in a time window.',
 'A rate limit protects a service from being overwhelmed. An API might allow 100 requests per minute, then return 429 Too Many Requests until the window resets. Good clients slow down, batch work, or retry later instead of hammering the same endpoint harder.',
 'The GitHub API hit its rate limit, so the script waited before fetching more PR data.',
 'Rate limits show up whenever agents call hosted APIs in loops. Knowing the term makes "why did the tool stop?" much less mysterious.',
 ARRAY['sys-api-gateway','dev-api','sys-retry','sys-timeout']::text[],
 ARRAY['dev-api']::text[],
 'sys-retry',
 ARRAY[
   'A feature flag that hides unfinished UI',
   'A database policy that filters rows',
   'A local branch with no remote tracking branch'
 ]::text[],
 'The GitHub API hit its ___, so the script waited before fetching more PR data.',
 'Use ''rate limit'' in a sentence about a service slowing down too many requests.',
 'curated', 'curator', '2026-05-25'),

('sys-timeout', 'timeout', null, 'systems', 'coding', 1,
 'A deadline after which a slow operation is stopped instead of waiting forever.',
 'A timeout is a safety cutoff. If a network request, model call, test, or browser action takes too long, the runtime gives up and reports a timeout. Timeouts can mean the system is down, the selector was wrong, the request is too slow, or the deadline is too aggressive.',
 'The browser test hit a timeout waiting for the sign-in button because the page never finished loading.',
 'Timeouts are not always the root bug; they are often the symptom that tells you where to look next.',
 ARRAY['sys-retry','sys-rate-limit','sys-monitoring']::text[],
 ARRAY['dev-api']::text[],
 'sys-retry',
 ARRAY[
   'A scheduled job that runs every night',
   'A cache entry stored too long',
   'A branch that needs a rebase'
 ]::text[],
 'The browser test hit a ___ waiting for the sign-in button because the page never finished loading.',
 'Use ''timeout'' in a sentence about stopping a slow operation after a deadline.',
 'curated', 'curator', '2026-05-25'),

('sys-retry', 'retry', null, 'systems', 'coding', 1,
 'Trying the same operation again after a failure, usually with a delay or limit.',
 'A retry is useful when a failure might be temporary: a network blip, a rate limit, a busy database, or a flaky third-party API. Good retry logic has limits and is paired with idempotency, because repeating an unsafe operation can create duplicates or double-charge someone.',
 'Retry the fetch twice with a short delay, but make sure the write is idempotent first.',
 'Agents retry commands and APIs all the time. Knowing the word helps separate "try again safely" from "repeat the damage."',
 ARRAY['sys-idempotent','sys-timeout','sys-rate-limit','sys-queue']::text[],
 ARRAY['sys-idempotent']::text[],
 'sys-race-condition',
 ARRAY[
   'Rendering HTML before JavaScript starts',
   'Moving commits onto a newer base branch',
   'Comparing a screenshot to a baseline'
 ]::text[],
 '___ the fetch twice with a short delay, but make sure the write is idempotent first.',
 'Use ''retry'' in a sentence about trying a temporary failure again safely.',
 'curated', 'curator', '2026-05-25'),

('sys-cache-invalidation', 'cache invalidation', null, 'systems', 'coding', 2,
 'The act of clearing or refreshing stale cached data so users see the current truth.',
 'Cache invalidation is how you tell a cache that its old answer is no longer safe. If a preview alias points to yesterday, a CDN serves old assets, or an API response keeps showing stale data, the cache needs to be busted, expired, or refreshed. It is hard because the whole point of a cache is to reuse old work.',
 'The deploy was correct, but cache invalidation lagged, so the browser still showed the old bundle.',
 'This explains a lot of "I swear I changed it" moments. Knowing the term gives you a better next move than refreshing at random.',
 ARRAY['sys-cache','ent-deployment-alias','ent-preview-deployment']::text[],
 ARRAY['sys-cache']::text[],
 'sys-rollback',
 ARRAY[
   'A rule that stops users from reading other rows',
   'A branch created from another branch',
   'A model setting that controls randomness'
 ]::text[],
 'The deploy was correct, but ___ lagged, so the browser still showed the old bundle.',
 'Use ''cache invalidation'' in a sentence about clearing stale cached data.',
 'curated', 'curator', '2026-05-25'),

('sys-rollback', 'rollback', null, 'systems', 'coding', 2,
 'Returning a system to the last known-good version after a bad release.',
 'A rollback is the emergency move when a new deploy, migration, or config change breaks something important. Instead of continuing forward, you restore the previous working version or undo the risky change. Feature flags can avoid some rollbacks because you can turn the feature off without redeploying.',
 'The checkout release broke login, so the team rolled back to the previous deployment.',
 'Rollback is one of the main words behind release safety. It means the team planned for "what if this goes wrong?" before it did.',
 ARRAY['dev-deploy','dev-feature-flag','ent-preview-deployment','sys-cache-invalidation']::text[],
 ARRAY['dev-deploy']::text[],
 'sys-cache-invalidation',
 ARRAY[
   'A test fixture used to fake database rows',
   'A selector used to find a page button',
   'A model call that returns structured JSON'
 ]::text[],
 'The checkout release broke login, so the team did a ___ to the previous deployment.',
 'Use ''rollback'' in a sentence about returning to the last known-good version.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
