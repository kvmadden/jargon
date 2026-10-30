-- jargon Stage B+1.30 - software architecture foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for practical software architecture basics:
-- APIs, interfaces, abstractions, services, monoliths, microservices,
-- coupling, cohesion, dependency injection, event-driven architecture,
-- message buses, idempotency keys, consistency, eventual consistency,
-- and service boundaries.
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

('arch-api', 'API', 'A-P-I', 'systems', 'coding', 1,
 'Application Programming Interface: a contract for how software talks to software.',
 'API stands for Application Programming Interface. An API is the exposed contract one piece of software offers to another: which actions exist, what input shape they expect, and what output or error they return. APIs can be HTTP endpoints, library functions, SDK methods, or internal service contracts.',
 'The mobile app used the billing API to fetch the customer invoice.',
 'API is the door-handle word for software integration. It helps you distinguish the contract from the server, database, UI, or implementation behind it.',
 ARRAY['dev-api','sys-http-request','sys-http-response','arch-interface']::text[],
 ARRAY['dev-api']::text[],
 'arch-interface',
 ARRAY[
   'A database row that stores one record',
   'A hardware bus between components',
   'A model validation score'
 ]::text[],
 'The mobile app used the billing ___ to fetch the customer invoice.',
 'Use ''API'' in a sentence about one system calling another.',
 'curated', 'curator', '2026-05-25'),

('arch-interface', 'interface', null, 'systems', 'coding', 1,
 'A boundary that describes how code or a system can be used.',
 'An interface says what another piece of code or software can rely on without exposing every internal detail. It might be a TypeScript interface, a class method list, a public API shape, or a service contract. The point is the same: callers know how to use the thing from the outside.',
 'The storage interface let the app swap local files for cloud storage without changing every caller.',
 'Interface is how engineers talk about clean boundaries. It helps you hear the difference between what a component promises and how it fulfills that promise.',
 ARRAY['arch-api','arch-abstraction','arch-service-boundary']::text[],
 ARRAY['arch-api']::text[],
 'arch-abstraction',
 ARRAY[
   'A browser cookie sent with requests',
   'A one-time data repair after a migration',
   'A GPU instruction set'
 ]::text[],
 'The storage ___ let the app swap local files for cloud storage without changing every caller.',
 'Use ''interface'' in a sentence about a boundary callers can rely on.',
 'curated', 'curator', '2026-05-25'),

('arch-abstraction', 'abstraction', null, 'systems', 'coding', 2,
 'A simplified layer that hides lower-level details.',
 'An abstraction gives callers a simpler idea to work with while hiding the messy details underneath. A payment abstraction might expose chargeCustomer() while hiding Stripe, retries, logging, and database writes. Good abstractions remove irrelevant complexity; bad abstractions hide important behavior.',
 'The auth helper was a useful abstraction because callers did not need to know the token refresh flow.',
 'Abstraction is the word behind many design debates. It helps you ask whether a layer makes work simpler or just buries complexity where nobody can see it.',
 ARRAY['arch-interface','arch-coupling','arch-service-boundary']::text[],
 ARRAY['arch-interface']::text[],
 'arch-coupling',
 ARRAY[
   'A network packet sent across routers',
   'A final test set for a model',
   'A public DNS record'
 ]::text[],
 'The auth helper was a useful ___ because callers did not need to know the token refresh flow.',
 'Use ''abstraction'' in a sentence about hiding lower-level details behind a simpler layer.',
 'curated', 'curator', '2026-05-25'),

('arch-service', 'service', null, 'systems', 'coding', 1,
 'A deployable unit that owns a capability or business area.',
 'A service is a running piece of software that owns a job: auth, billing, search, notifications, image processing, or recommendations. A service usually has its own code, runtime, API, logs, and operational responsibilities.',
 'The billing service owns invoice creation and payment retries.',
 'Service is the basic shape behind backend architecture talk. It helps you locate responsibility: which part owns this behavior, this data, and this failure?',
 ARRAY['arch-api','arch-microservice','arch-service-boundary']::text[],
 ARRAY['arch-api']::text[],
 'arch-service-boundary',
 ARRAY[
   'A prop passed to a React component',
   'A CSS formatter rule',
   'A browser redirect target'
 ]::text[],
 'The billing ___ owns invoice creation and payment retries.',
 'Use ''service'' in a sentence about a running software unit that owns a capability.',
 'curated', 'curator', '2026-05-25'),

('arch-monolith', 'monolith', null, 'systems', 'coding', 1,
 'An application where many capabilities ship as one unit.',
 'A monolith is one application that contains many parts: login, billing, admin, search, reporting, and more. It often has one codebase, one build, and one deploy. Monoliths can be simple and productive; the tradeoff is that one change can require shipping the whole application.',
 'The startup kept the app as a monolith until the team understood the service boundaries.',
 'Monolith is not an insult by default. It helps you understand the tradeoff between one understandable app and many independently deployed services.',
 ARRAY['arch-microservice','arch-service','arch-service-boundary']::text[],
 ARRAY['arch-service']::text[],
 'arch-microservice',
 ARRAY[
   'A small independent UI component',
   'A network router at the edge',
   'A model training dataset'
 ]::text[],
 'The startup kept the app as a ___ until the team understood the service boundaries.',
 'Use ''monolith'' in a sentence about one application that ships many capabilities together.',
 'curated', 'curator', '2026-05-25'),

('arch-microservice', 'microservice', null, 'systems', 'coding', 2,
 'A small independently deployed service with a narrow responsibility.',
 'A microservice is a service split out so it can be built, deployed, scaled, and owned more independently. Microservices can help teams move separately, but they also add network calls, monitoring, versioning, and distributed-system failure modes.',
 'Search became a microservice so the search team could deploy and scale it separately.',
 'Microservice is one of the main architecture tradeoff words. It helps you hear both the independence benefit and the coordination cost.',
 ARRAY['arch-service','arch-monolith','arch-message-bus','arch-consistency']::text[],
 ARRAY['arch-service','arch-api']::text[],
 'arch-event-driven',
 ARRAY[
   'A single code file inside a package',
   'A database column with fixed choices',
   'A browser session value'
 ]::text[],
 'Search became a ___ so the search team could deploy and scale it separately.',
 'Use ''microservice'' in a sentence about a small independently deployed service.',
 'curated', 'curator', '2026-05-25'),

('arch-coupling', 'coupling', null, 'systems', 'coding', 2,
 'How strongly one part of a system depends on another.',
 'Coupling measures how tightly pieces are tied together. If changing billing breaks search, those areas are coupled. Some coupling is unavoidable, but high coupling makes systems harder to change because one local edit has distant consequences.',
 'The checkout page had too much coupling to the inventory database shape.',
 'Coupling is the hidden-friction word. It helps you understand why a small change can become risky across a codebase.',
 ARRAY['arch-cohesion','arch-abstraction','arch-service-boundary']::text[],
 ARRAY['arch-service','arch-interface']::text[],
 'arch-cohesion',
 ARRAY[
   'How fast a network response arrives',
   'How many positives a model catches',
   'How much disk space a build uses'
 ]::text[],
 'The checkout page had too much ___ to the inventory database shape.',
 'Use ''coupling'' in a sentence about one part depending too strongly on another.',
 'curated', 'curator', '2026-05-25'),

('arch-cohesion', 'cohesion', null, 'systems', 'coding', 2,
 'How tightly a module groups related responsibilities.',
 'Cohesion describes whether a module, service, or component is focused on one related job. High cohesion means the pieces inside belong together. Low cohesion means unrelated behavior is bundled together, making the system harder to name, test, and change.',
 'The profile service had better cohesion after billing logic moved out.',
 'Cohesion is the healthy-boundary partner to coupling. It helps you ask whether a thing has one clear responsibility or too many unrelated jobs.',
 ARRAY['arch-coupling','arch-service-boundary','arch-abstraction']::text[],
 ARRAY['arch-service','arch-coupling']::text[],
 'arch-service-boundary',
 ARRAY[
   'How much data a network can move',
   'How often a model prediction is correct',
   'How long a session stays signed in'
 ]::text[],
 'The profile service had better ___ after billing logic moved out.',
 'Use ''cohesion'' in a sentence about related responsibilities belonging together.',
 'curated', 'curator', '2026-05-25'),

('arch-dependency-injection', 'dependency injection', null, 'systems', 'coding', 2,
 'Passing dependencies in instead of creating them inside.',
 'Dependency injection means a module receives the things it depends on instead of constructing them itself. A component might receive an API client, clock, logger, or database adapter. That makes behavior easier to test and swap because the dependency is explicit.',
 'The test passed a fake email client through dependency injection.',
 'Dependency injection sounds fancy, but it is mostly "hand the part what it needs." It helps you understand many testing and architecture conversations about seams.',
 ARRAY['arch-interface','dev-mock','dev-test-harness']::text[],
 ARRAY['arch-interface','dev-mock']::text[],
 'arch-abstraction',
 ARRAY[
   'A browser rule for cross-origin requests',
   'A background process without a window',
   'A final held-out model dataset'
 ]::text[],
 'The test passed a fake email client through ___.',
 'Use ''dependency injection'' in a sentence about passing a dependency into code.',
 'curated', 'curator', '2026-05-25'),

('arch-event-driven', 'event-driven architecture', null, 'systems', 'coding', 2,
 'A design where components react to emitted events.',
 'Event-driven architecture means parts of a system publish facts that happened and other parts react. Instead of checkout directly calling every downstream workflow, it might publish OrderPlaced. Email, analytics, fulfillment, and fraud checks can subscribe to that event.',
 'The app became event-driven when checkout published OrderPlaced and other services reacted.',
 'Event-driven is the decoupling word for many modern systems. It helps you understand why work may happen after the original request already returned.',
 ARRAY['arch-message-bus','arch-microservice','sys-queue']::text[],
 ARRAY['arch-service','arch-microservice']::text[],
 'arch-message-bus',
 ARRAY[
   'A single deployable app with all behavior inside',
   'A direct database join across two tables',
   'A CSS rule triggered by hover'
 ]::text[],
 'The app became ___ when checkout published OrderPlaced and other services reacted.',
 'Use ''event-driven architecture'' in a sentence about services reacting to events.',
 'curated', 'curator', '2026-05-25'),

('arch-message-bus', 'message bus', null, 'systems', 'coding', 2,
 'Shared infrastructure for publishing and consuming events or messages.',
 'A message bus carries events or messages between producers and consumers. Producers publish a message; consumers subscribe, process, and sometimes retry later. It helps services communicate without every service directly calling every other service.',
 'The message bus delivered the password-reset event to email and audit services.',
 'Message bus is the plumbing word behind event-driven systems. It helps you understand where async work goes and why it may be retried later.',
 ARRAY['arch-event-driven','sys-queue','arch-microservice']::text[],
 ARRAY['arch-event-driven']::text[],
 'arch-eventual-consistency',
 ARRAY[
   'A single function parameter',
   'A browser storage value',
   'A model loss score'
 ]::text[],
 'The ___ delivered the password-reset event to email and audit services.',
 'Use ''message bus'' in a sentence about publishing and consuming events.',
 'curated', 'curator', '2026-05-25'),

('arch-idempotency-key', 'idempotency key', null, 'systems', 'coding', 2,
 'A unique key that lets repeated writes be treated as one attempt.',
 'An idempotency key lets a server recognize that two write requests are the same intended operation. If checkout retries after a timeout, the key helps the server avoid charging the card twice while still returning a useful response.',
 'The checkout request included an idempotency key so retrying did not create a duplicate charge.',
 'Idempotency key is the practical safety word for retries. It helps you connect reliability, payments, webhooks, and duplicate-write prevention.',
 ARRAY['sys-idempotent','sys-retry','arch-api']::text[],
 ARRAY['sys-idempotent','sys-retry']::text[],
 'arch-consistency',
 ARRAY[
   'A browser URL path',
   'A model training label',
   'A CPU cache line'
 ]::text[],
 'The checkout request included an ___ so retrying did not create a duplicate charge.',
 'Use ''idempotency key'' in a sentence about safe retrying of writes.',
 'curated', 'curator', '2026-05-25'),

('arch-consistency', 'consistency', null, 'systems', 'coding', 2,
 'Whether different reads agree about the same data state.',
 'Consistency is about whether parts of a system agree on what is true right now. In one architecture, every read immediately sees the latest write. In another, replicas, caches, or downstream services may lag. Stronger consistency is simpler for users but can cost speed or availability.',
 'The profile page needed stronger consistency so the saved name appeared immediately after editing.',
 'Consistency is where architecture meets user trust. It helps you understand stale data, replicas, caches, and why two screens can briefly disagree.',
 ARRAY['arch-eventual-consistency','sys-cache-invalidation','sys-transaction']::text[],
 ARRAY['sys-cache-invalidation','sys-transaction']::text[],
 'arch-eventual-consistency',
 ARRAY[
   'How closely code follows a formatter',
   'How many model positives are correct',
   'How wide a network pipe is'
 ]::text[],
 'The profile page needed stronger ___ so the saved name appeared immediately after editing.',
 'Use ''consistency'' in a sentence about whether different reads agree.',
 'curated', 'curator', '2026-05-25'),

('arch-eventual-consistency', 'eventual consistency', null, 'systems', 'coding', 3,
 'A state where replicas may lag but converge later.',
 'Eventual consistency means the system may show old data for a short time, but if no new writes happen, every copy should eventually agree. This often appears with caches, replicas, queues, search indexes, analytics pipelines, and event-driven systems.',
 'The search index was eventually consistent, so a new record appeared in search a few seconds after saving.',
 'Eventual consistency explains a lot of "why is it not there yet?" moments. It helps you distinguish broken behavior from delayed propagation.',
 ARRAY['arch-consistency','arch-event-driven','arch-message-bus','sys-cache-invalidation']::text[],
 ARRAY['arch-consistency','arch-event-driven']::text[],
 'arch-message-bus',
 ARRAY[
   'A database rule that rejects bad rows',
   'A model metric for false positives',
   'A local server port'
 ]::text[],
 'The search index was ___, so a new record appeared in search a few seconds after saving.',
 'Use ''eventual consistency'' in a sentence about delayed agreement across copies.',
 'curated', 'curator', '2026-05-25'),

('arch-service-boundary', 'service boundary', null, 'systems', 'coding', 2,
 'The line that decides what a service owns and exposes.',
 'A service boundary defines which data, behavior, and decisions belong inside a service and what other services may ask from it. Good boundaries keep ownership clear. Bad boundaries create duplicate logic, hidden coupling, and arguments about which team owns a bug.',
 'The team moved invoice status behind the billing service boundary.',
 'Service boundary is the ownership word. It helps you follow architecture conversations about where behavior should live and why crossing the line has a cost.',
 ARRAY['arch-service','arch-microservice','arch-coupling','arch-cohesion']::text[],
 ARRAY['arch-service','arch-coupling','arch-cohesion']::text[],
 'arch-event-driven',
 ARRAY[
   'A network certificate for HTTPS',
   'A React state value',
   'A data label for supervised learning'
 ]::text[],
 'The team moved invoice status behind the billing ___.',
 'Use ''service boundary'' in a sentence about what a service owns.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
