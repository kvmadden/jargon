-- jargon Stage B+1.33 - QA/reliability foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for practical testing and reliability literacy:
-- unit tests, integration tests, E2E tests, smoke tests, regression tests,
-- flaky tests, test coverage, fixtures, mocks, SLA, SLO, error budgets,
-- MTTR, postmortems, and root cause.
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

('qa-unit-test', 'unit test', null, 'systems', 'coding', 1,
 'A small test for one isolated piece of logic.',
 'A unit test checks a small unit of code, usually a function or module, without running the whole app. It should be fast, specific, and easy to understand when it fails. Unit tests are best for pure logic, validation rules, parsers, calculations, and small state transitions.',
 'The unit test proved the streak counter handled a missed day correctly.',
 'Unit test is the basic confidence word in code review. It helps you ask whether a small rule is protected before the app-level flow gets complicated.',
 ARRAY['qa-integration-test','qa-fixture','qa-mock','qa-test-coverage']::text[],
 ARRAY['code-function','dev-test-harness']::text[],
 'qa-integration-test',
 ARRAY[
   'A full browser flow through the deployed app',
   'A promised uptime target in a customer contract',
   'A review written after an incident'
 ]::text[],
 'The ___ proved the streak counter handled a missed day correctly.',
 'Use ''unit test'' in a sentence about testing one small piece of logic.',
 'curated', 'curator', '2026-05-26'),

('qa-integration-test', 'integration test', null, 'systems', 'coding', 2,
 'A test that checks multiple parts working together.',
 'An integration test verifies that separate pieces cooperate: a route and store, an API and database, a component and data loader, or two services. It is usually slower than a unit test but catches boundary bugs that isolated tests miss.',
 'The integration test caught the profile save bug between the form and database function.',
 'Integration test is the boundary-confidence word. It helps you understand why small tests can pass while the joined-up behavior still fails.',
 ARRAY['qa-unit-test','qa-e2e-test','arch-interface','sys-transaction']::text[],
 ARRAY['qa-unit-test']::text[],
 'qa-e2e-test',
 ARRAY[
   'A number that tracks latency over time',
   'A database structure for faster lookup',
   'A prompt style for giving examples'
 ]::text[],
 'The ___ caught the profile save bug between the form and database function.',
 'Use ''integration test'' in a sentence about checking multiple parts together.',
 'curated', 'curator', '2026-05-26'),

('qa-e2e-test', 'E2E test', 'E-to-E', 'systems', 'coding', 2,
 'End-to-end test: a test that exercises a full user flow through the app.',
 'E2E means end-to-end. An E2E test drives the app like a user would: open the page, click, type, navigate, and verify the result. It is useful for proving critical workflows, but it can be slower and more brittle than lower-level tests.',
 'The E2E test signed in, opened a lesson, answered a card, and saw XP update.',
 'E2E test is the real-flow word. It helps you understand browser-backed proof instead of trusting screenshots or isolated logic alone.',
 ARRAY['qa-smoke-test','qa-regression-test','qa-integration-test','browser-test']::text[],
 ARRAY['qa-integration-test']::text[],
 'qa-smoke-test',
 ARRAY[
   'A test for one isolated function only',
   'A customer-facing uptime promise',
   'A stored result reused for speed'
 ]::text[],
 'The ___ signed in, opened a lesson, answered a card, and saw XP update.',
 'Use ''E2E test'' in a sentence about exercising a full user flow.',
 'curated', 'curator', '2026-05-26'),

('qa-smoke-test', 'smoke test', null, 'systems', 'coding', 1,
 'A quick check that the most important path is not obviously broken.',
 'A smoke test is a small, fast check after a build or deploy to make sure the core path still works. It does not prove every edge case. It answers the first question: is the app basically alive?',
 'After the deploy, the smoke test opened the home screen and completed one practice card.',
 'Smoke test is the first-look confidence word. It helps you separate a quick sanity check from deep verification.',
 ARRAY['qa-e2e-test','qa-regression-test','cloud-deploy','qa-test-coverage']::text[],
 ARRAY['cloud-deploy']::text[],
 'qa-regression-test',
 ARRAY[
   'A failure analysis document after an outage',
   'A model metric for positive predictions',
   'A security rule for delegated access'
 ]::text[],
 'After the deploy, the ___ opened the home screen and completed one practice card.',
 'Use ''smoke test'' in a sentence about a quick post-build or post-deploy check.',
 'curated', 'curator', '2026-05-26'),

('qa-regression-test', 'regression test', null, 'systems', 'coding', 2,
 'A test that proves an old bug or behavior stays fixed.',
 'A regression test captures a bug or important behavior so it cannot quietly break again. The key discipline is proving the test would have failed before the fix and passes after the fix.',
 'The regression test locked in the mobile spacing fix so the footer could not crowd the bottom again.',
 'Regression test is the memory word for software quality. It helps you turn a painful bug into a permanent guard.',
 ARRAY['qa-smoke-test','qa-flaky-test','qa-e2e-test','dev-regression']::text[],
 ARRAY['qa-smoke-test']::text[],
 'qa-flaky-test',
 ARRAY[
   'A target for internal uptime',
   'A data row used to set up a test',
   'A traffic router across servers'
 ]::text[],
 'The ___ locked in the mobile spacing fix so the footer could not crowd the bottom again.',
 'Use ''regression test'' in a sentence about keeping a fixed bug fixed.',
 'curated', 'curator', '2026-05-26'),

('qa-flaky-test', 'flaky test', null, 'systems', 'coding', 2,
 'A test that sometimes passes and sometimes fails without a code change.',
 'A flaky test gives different results under the same code because of timing, network dependence, random ordering, shared state, or unstable selectors. Flakes are dangerous because they teach teams to ignore failing tests.',
 'The screenshot test was flaky because the animation had not finished before the assertion ran.',
 'Flaky test is the false-alarm word. It helps you understand why a failing check may still need real repair, not a shrug.',
 ARRAY['qa-regression-test','sys-race-condition','qa-e2e-test','qa-fixture']::text[],
 ARRAY['qa-regression-test']::text[],
 'qa-test-coverage',
 ARRAY[
   'A contractual uptime promise',
   'A database rule that rejects bad rows',
   'A model overfitting to training data'
 ]::text[],
 'The screenshot test was ___ because the animation had not finished before the assertion ran.',
 'Use ''flaky test'' in a sentence about nondeterministic test results.',
 'curated', 'curator', '2026-05-26'),

('qa-test-coverage', 'test coverage', null, 'systems', 'coding', 1,
 'How much code or behavior is exercised by tests.',
 'Test coverage measures what parts of a codebase or behavior set are touched by tests. Line coverage can help find blind spots, but high coverage does not guarantee good tests. The useful question is whether important behavior has meaningful protection.',
 'The version pill had test coverage for opening, showing release notes, and closing.',
 'Test coverage is the map word for confidence. It helps you ask where the app is protected and where it is still relying on hope.',
 ARRAY['qa-unit-test','qa-integration-test','qa-regression-test','qa-fixture']::text[],
 ARRAY['qa-unit-test']::text[],
 'qa-fixture',
 ARRAY[
   'A mean time to recovery after incidents',
   'A runtime cache near users',
   'A handoff document after an outage'
 ]::text[],
 'The version pill had ___ for opening, showing release notes, and closing.',
 'Use ''test coverage'' in a sentence about how much behavior tests exercise.',
 'curated', 'curator', '2026-05-26'),

('qa-fixture', 'fixture', null, 'systems', 'coding', 1,
 'Known test data or setup used to make a test repeatable.',
 'A fixture is prepared input, database state, file content, or setup that a test uses. Fixtures make tests repeatable by controlling the world around the behavior being checked.',
 'The test fixture created an allowlisted user before the sign-in check ran.',
 'Fixture is the controlled-setup word. It helps you understand how tests create known conditions instead of relying on whatever happens to exist.',
 ARRAY['qa-unit-test','qa-mock','sys-seed-data','qa-test-coverage']::text[],
 ARRAY['qa-unit-test']::text[],
 'qa-mock',
 ARRAY[
   'A customer reliability promise',
   'A router spreading traffic',
   'A model output format'
 ]::text[],
 'The test ___ created an allowlisted user before the sign-in check ran.',
 'Use ''fixture'' in a sentence about prepared test data or setup.',
 'curated', 'curator', '2026-05-26'),

('qa-mock', 'mock', null, 'systems', 'coding', 1,
 'A test double that imitates a dependency.',
 'A mock replaces a real dependency with a controlled fake during a test. Teams use mocks for API clients, clocks, email senders, payment gateways, and expensive services. Good mocks keep tests fast and focused; bad mocks can drift away from reality.',
 'The test used a mock email sender instead of sending a real invite.',
 'Mock is the fake-dependency word. It helps you hear when a test proved local behavior but did not touch the real outside service.',
 ARRAY['qa-fixture','arch-dependency-injection','qa-unit-test','dev-mock']::text[],
 ARRAY['qa-fixture','arch-dependency-injection']::text[],
 'qa-integration-test',
 ARRAY[
   'A database transaction across writes',
   'A final user-flow browser test',
   'A contractual uptime promise'
 ]::text[],
 'The test used a ___ email sender instead of sending a real invite.',
 'Use ''mock'' in a sentence about replacing a real dependency during a test.',
 'curated', 'curator', '2026-05-26'),

('qa-sla', 'SLA', 'S-L-A', 'systems', 'coding', 2,
 'Service-level agreement: a customer-facing reliability or response-time promise.',
 'SLA stands for service-level agreement. An SLA is an external promise, often contractual, about uptime, response time, support response, or other service behavior. If a vendor misses an SLA, customers may receive credits or other remedies.',
 'The vendor SLA promised 99.9 percent monthly availability.',
 'SLA is the promise-to-customers word. It helps you understand why reliability targets can have business and legal consequences.',
 ARRAY['qa-slo','qa-error-budget','qa-mttr','prod-compliance']::text[],
 ARRAY['qa-slo']::text[],
 'qa-slo',
 ARRAY[
   'A small isolated logic test',
   'A prepared test data setup',
   'A code path that sometimes fails nondeterministically'
 ]::text[],
 'The vendor ___ promised 99.9 percent monthly availability.',
 'Use ''SLA'' in a sentence about a customer-facing reliability promise.',
 'curated', 'curator', '2026-05-26'),

('qa-slo', 'SLO', 'S-L-O', 'systems', 'coding', 2,
 'Service-level objective: an internal reliability target.',
 'SLO stands for service-level objective. An SLO is the team target for reliability or performance, often set tighter than an external SLA. SLOs guide engineering decisions before customers feel a breach.',
 'The checkout SLO targeted 99.95 percent successful requests.',
 'SLO is the internal-target word. It helps you hear the difference between what a team aims for and what a contract promises.',
 ARRAY['qa-sla','qa-error-budget','cloud-metric','qa-mttr']::text[],
 ARRAY['qa-sla','cloud-metric']::text[],
 'qa-error-budget',
 ARRAY[
   'A review after an incident',
   'A fake dependency used in a test',
   'A full user-flow browser test'
 ]::text[],
 'The checkout ___ targeted 99.95 percent successful requests.',
 'Use ''SLO'' in a sentence about an internal reliability target.',
 'curated', 'curator', '2026-05-26'),

('qa-error-budget', 'error budget', null, 'systems', 'coding', 2,
 'The allowed amount of unreliability before teams slow risky changes.',
 'An error budget is the gap between perfect reliability and the agreed target. If the service is allowed 0.1 percent downtime, that small allowance is the budget. Burning it too fast can mean pausing risky launches and investing in reliability.',
 'The team froze risky deploys because checkout had burned most of its error budget.',
 'Error budget is the tradeoff word inside reliability. It helps you understand why teams can move fast sometimes and slow down after too many failures.',
 ARRAY['qa-slo','qa-sla','qa-mttr','cloud-alert']::text[],
 ARRAY['qa-slo']::text[],
 'qa-mttr',
 ARRAY[
   'A test data file loaded before each run',
   'A one-off migration that repairs rows',
   'A prompt example used for classification'
 ]::text[],
 'The team froze risky deploys because checkout had burned most of its ___.',
 'Use ''error budget'' in a sentence about the allowed amount of unreliability.',
 'curated', 'curator', '2026-05-26'),

('qa-mttr', 'MTTR', 'M-T-T-R', 'systems', 'coding', 2,
 'Mean time to recovery: the average time it takes to restore service after a failure.',
 'MTTR stands for mean time to recovery. It measures how quickly a team restores service after incidents. Shorter MTTR usually comes from better alerts, runbooks, observability, rollback paths, and practiced response.',
 'Better alerts lowered MTTR because the team found the failure faster.',
 'MTTR is the recovery-speed word. It helps you understand incident response as something teams can measure and improve.',
 ARRAY['cloud-alert','cloud-observability','qa-postmortem','qa-slo']::text[],
 ARRAY['cloud-alert','cloud-observability']::text[],
 'qa-postmortem',
 ARRAY[
   'A customer-facing uptime contract',
   'A unit test for one function',
   'A data shape used for test setup'
 ]::text[],
 'Better alerts lowered ___ because the team found the failure faster.',
 'Use ''MTTR'' in a sentence about restoring service after an incident.',
 'curated', 'curator', '2026-05-26'),

('qa-postmortem', 'postmortem', null, 'systems', 'coding', 2,
 'A review of what happened after an incident.',
 'A postmortem is a structured review after an incident. Good postmortems explain impact, timeline, detection, response, contributing factors, root cause when known, and follow-up actions. The best ones are blameless and useful.',
 'The postmortem showed the outage lasted longer because the alert pointed at the wrong service.',
 'Postmortem is the learning-after-failure word. It helps you understand incident review as improvement work, not blame theater.',
 ARRAY['qa-root-cause','qa-mttr','cloud-alert','se-fmea']::text[],
 ARRAY['qa-mttr','cloud-alert']::text[],
 'qa-root-cause',
 ARRAY[
   'A cache stored near users',
   'A model score minimized during training',
   'A typed function input'
 ]::text[],
 'The ___ showed the outage lasted longer because the alert pointed at the wrong service.',
 'Use ''postmortem'' in a sentence about reviewing an incident after it happens.',
 'curated', 'curator', '2026-05-26'),

('qa-root-cause', 'root cause', null, 'systems', 'coding', 2,
 'The underlying reason a failure happened.',
 'A root cause is the deeper reason behind a visible failure. It is not always one thing, and good incident reviews often name contributing factors too. The point is to fix the system condition that allowed the failure, not just the symptom.',
 'The root cause was a missing retry path, not the one failed request.',
 'Root cause is the deeper-why word. It helps you ask what condition made the bug possible instead of stopping at the first error message.',
 ARRAY['qa-postmortem','se-fmea','sec-threat-model','qa-regression-test']::text[],
 ARRAY['qa-postmortem']::text[],
 'se-fmea',
 ARRAY[
   'An internal uptime target',
   'A browser-level session value',
   'A generated build output'
 ]::text[],
 'The ___ was a missing retry path, not the one failed request.',
 'Use ''root cause'' in a sentence about the underlying reason a failure happened.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
