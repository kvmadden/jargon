-- jargon Stage B+1.32 - systems-engineering foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for practical systems-engineering literacy:
-- requirements, constraints, tradeoffs, interface control, system boundaries,
-- stakeholders, use cases, verification, validation, traceability, FMEA,
-- hazard analysis, control loops, feedback, and lifecycle thinking.
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

('se-requirement', 'requirement', null, 'systems', 'coding', 1,
 'A stated need the system must satisfy.',
 'A requirement is a clear statement of what the system must do, support, prevent, or prove. Good requirements are specific enough to design against and test against. Vague wishes become better requirements when they name the actor, condition, behavior, and acceptance evidence.',
 'The requirement said the invite link must expire after seven days.',
 'Requirement is the starting noun for systems work. It helps you hear the difference between a preference, a design idea, and something the system is obligated to satisfy.',
 ARRAY['se-verification','se-traceability','prod-acceptance-criteria','se-stakeholder']::text[],
 ARRAY['prod-acceptance-criteria']::text[],
 'se-traceability',
 ARRAY[
   'A runtime cache stored near users',
   'A database row returned by a query',
   'A model setting for output randomness'
 ]::text[],
 'The ___ said the invite link must expire after seven days.',
 'Use ''requirement'' in a sentence about a need the system must satisfy.',
 'curated', 'curator', '2026-05-26'),

('se-constraint', 'constraint', null, 'systems', 'coding', 1,
 'A limit the design must respect.',
 'A constraint is a boundary condition on the solution: budget, timeline, latency, regulation, battery life, hardware, browser support, staffing, or existing integrations. Constraints do not say what the system should be; they narrow what designs are possible.',
 'The mobile-first constraint ruled out a dense desktop-only dashboard.',
 'Constraint is the word for reality pushing back. It helps you understand why a technically nicer design may still be the wrong design.',
 ARRAY['se-tradeoff','math-constraint','se-requirement','se-system-boundary']::text[],
 ARRAY['se-requirement']::text[],
 'se-tradeoff',
 ARRAY[
   'A background process managed by the operating system',
   'A network packet moving through a router',
   'A stored result reused for speed'
 ]::text[],
 'The mobile-first ___ ruled out a dense desktop-only dashboard.',
 'Use ''constraint'' in a sentence about a limit a design must respect.',
 'curated', 'curator', '2026-05-26'),

('se-tradeoff', 'tradeoff', null, 'systems', 'coding', 1,
 'Choosing one benefit while accepting another cost.',
 'A tradeoff is a decision where improving one quality can hurt another. You might trade speed for accuracy, flexibility for simplicity, privacy for personalization, or cost for reliability. Systems engineering treats tradeoffs as explicit decisions, not hidden accidents.',
 'The team made a tradeoff: faster sign-in, but less profile detail on the first screen.',
 'Tradeoff is the honest decision word. It helps you ask what was gained, what was lost, and who is affected.',
 ARRAY['se-constraint','se-stakeholder','qa-slo','prod-kpi']::text[],
 ARRAY['se-constraint']::text[],
 'se-validation',
 ARRAY[
   'A database key that points to another table',
   'A code formatter rule',
   'A language-model token limit'
 ]::text[],
 'The team made a ___: faster sign-in, but less profile detail on the first screen.',
 'Use ''tradeoff'' in a sentence about choosing one benefit while accepting a cost.',
 'curated', 'curator', '2026-05-26'),

('se-interface-control', 'interface control document', null, 'systems', 'coding', 3,
 'A formal description of how systems connect.',
 'An interface control document records how two systems interact: inputs, outputs, data shapes, timing, responsibilities, assumptions, error behavior, versioning, and ownership. The point is to prevent both sides from silently changing the connection and breaking the whole system.',
 'The payment team updated the interface control document before changing the webhook payload.',
 'Interface control is the formal boundary word. It helps you understand why teams document connections instead of relying on memory and hallway agreements.',
 ARRAY['arch-interface','arch-api','se-system-boundary','se-traceability']::text[],
 ARRAY['arch-interface','se-system-boundary']::text[],
 'se-traceability',
 ARRAY[
   'A dashboard metric tracked over time',
   'A test fixture loaded before a unit test',
   'A CDN asset cached near users'
 ]::text[],
 'The payment team updated the ___ before changing the webhook payload.',
 'Use ''interface control document'' in a sentence about documenting how systems connect.',
 'curated', 'curator', '2026-05-26'),

('se-system-boundary', 'system boundary', null, 'systems', 'coding', 2,
 'The line between what the system owns and what it interacts with.',
 'A system boundary defines what is inside the system and what is outside it. It clarifies owned behavior, external dependencies, users, inputs, outputs, data flows, and failure responsibilities. Without a boundary, scope and accountability drift.',
 'The diagram drew the system boundary around the app, database, and edge functions, but not the email provider.',
 'System boundary is how big-system conversations stay sane. It helps you ask what is actually part of the thing being designed.',
 ARRAY['arch-service-boundary','se-interface-control','se-stakeholder','se-use-case']::text[],
 ARRAY['arch-service-boundary']::text[],
 'se-interface-control',
 ARRAY[
   'A CSS class applied to a button',
   'A model validation score',
   'A shell command alias'
 ]::text[],
 'The diagram drew the ___ around the app, database, and edge functions, but not the email provider.',
 'Use ''system boundary'' in a sentence about what a system owns versus interacts with.',
 'curated', 'curator', '2026-05-26'),

('se-stakeholder', 'stakeholder', null, 'systems', 'coding', 1,
 'A person or group affected by the system outcome.',
 'A stakeholder is anyone who cares about or is affected by the system: users, operators, support teams, customers, compliance, finance, engineering, leadership, or external partners. Stakeholders create requirements and constraints even when they never touch the UI.',
 'Support was a stakeholder because the new error states changed the tickets they would receive.',
 'Stakeholder is the people word in system design. It helps you remember that technical choices land on someone.',
 ARRAY['se-requirement','se-tradeoff','prod-acceptance-criteria','se-validation']::text[],
 ARRAY['se-requirement']::text[],
 'se-validation',
 ARRAY[
   'A thread inside a running process',
   'A database index on a column',
   'A token generated by a language model'
 ]::text[],
 'Support was a ___ because the new error states changed the tickets they would receive.',
 'Use ''stakeholder'' in a sentence about a person or group affected by a system.',
 'curated', 'curator', '2026-05-26'),

('se-use-case', 'use case', null, 'systems', 'coding', 1,
 'A scenario describing how someone uses the system.',
 'A use case describes a real interaction between an actor and the system: what the actor wants, what triggers the flow, what the system does, and what outcome counts as success. Use cases turn abstract requirements into concrete behavior.',
 'The gift-invite use case starts when you fills a profile and ends when the recipient lands in the app.',
 'Use case is the story-with-purpose word. It helps you translate a feature idea into a specific flow someone can test.',
 ARRAY['se-requirement','prod-story','prod-acceptance-criteria','se-validation']::text[],
 ARRAY['se-requirement','prod-story']::text[],
 'se-verification',
 ARRAY[
   'A low-level CPU instruction family',
   'A cache entry reused for speed',
   'A log line written by a server'
 ]::text[],
 'The gift-invite ___ starts when you fills a profile and ends when the recipient lands in the app.',
 'Use ''use case'' in a sentence about a scenario where someone uses a system.',
 'curated', 'curator', '2026-05-26'),

('se-verification', 'verification', null, 'systems', 'coding', 2,
 'Checking that the system was built correctly against requirements.',
 'Verification asks whether the implementation satisfies the stated requirements. Tests, inspections, reviews, simulations, and traceability checks can all provide verification evidence. It is often summarized as "did we build the thing right?"',
 'The E2E test provided verification that the invite flow met the requirement.',
 'Verification is the evidence word for requirements. It helps you distinguish passing the spec from solving the right real-world problem.',
 ARRAY['se-validation','se-requirement','se-traceability','qa-e2e-test']::text[],
 ARRAY['se-requirement','qa-e2e-test']::text[],
 'se-validation',
 ARRAY[
   'Choosing a cheaper design with lower reliability',
   'Moving code closer to users at the edge',
   'Grouping permissions by role'
 ]::text[],
 'The E2E test provided ___ that the invite flow met the requirement.',
 'Use ''verification'' in a sentence about proving implementation matches requirements.',
 'curated', 'curator', '2026-05-26'),

('se-validation', 'validation', null, 'systems', 'coding', 2,
 'Checking that the system solves the right real-world problem.',
 'Validation asks whether the requirements and design actually meet the user or stakeholder need. A system can be verified against the spec and still fail validation if the spec solved the wrong problem. It is often summarized as "did we build the right thing?"',
 'User testing gave validation that the onboarding flow actually helped people start learning.',
 'Validation is the reality-check word. It helps you ask whether success in tests means success for people.',
 ARRAY['se-verification','se-stakeholder','se-use-case','prod-acceptance-criteria']::text[],
 ARRAY['se-verification','se-stakeholder']::text[],
 'se-traceability',
 ARRAY[
   'A queue message retried after failure',
   'A firewall rule for a network port',
   'A CPU cache storing hot data'
 ]::text[],
 'User testing gave ___ that the onboarding flow actually helped people start learning.',
 'Use ''validation'' in a sentence about proving a system solves the right problem.',
 'curated', 'curator', '2026-05-26'),

('se-traceability', 'traceability', null, 'systems', 'coding', 3,
 'Linking requirements to design, tests, and evidence.',
 'Traceability means you can follow a requirement through design decisions, implementation, tests, verification evidence, and change history. It helps teams prove coverage, manage risk, and understand what breaks when a requirement changes.',
 'The release checklist kept traceability from each requirement to its test evidence.',
 'Traceability is the paper-trail word. It helps you understand why serious systems teams care about links between goals, code, and proof.',
 ARRAY['se-requirement','se-verification','se-interface-control','prod-audit-log']::text[],
 ARRAY['se-requirement','se-verification']::text[],
 'se-lifecycle',
 ARRAY[
   'A load balancer routing traffic',
   'A CSS variable for a brand color',
   'A model label used for training'
 ]::text[],
 'The release checklist kept ___ from each requirement to its test evidence.',
 'Use ''traceability'' in a sentence about linking requirements to proof.',
 'curated', 'curator', '2026-05-26'),

('se-fmea', 'FMEA', 'F-M-E-A', 'systems', 'coding', 3,
 'Failure mode and effects analysis: a structured way to find what could break and what happens next.',
 'FMEA stands for failure mode and effects analysis. It lists possible failure modes, their effects, severity, causes, likelihood, detection, and mitigations. The goal is to catch important failure paths before they become incidents.',
 'The team used FMEA to notice that a failed email send could strand an invited user.',
 'FMEA is a disciplined "what could go wrong?" tool. It helps you hear risk analysis as a method, not just anxious guessing.',
 ARRAY['se-hazard-analysis','sec-threat-model','qa-postmortem','se-verification']::text[],
 ARRAY['se-requirement','se-hazard-analysis']::text[],
 'se-hazard-analysis',
 ARRAY[
   'A metric dashboard for latency',
   'A database schema migration',
   'A code formatter for TypeScript'
 ]::text[],
 'The team used ___ to notice that a failed email send could strand an invited user.',
 'Use ''FMEA'' in a sentence about analyzing failure modes and effects.',
 'curated', 'curator', '2026-05-26'),

('se-hazard-analysis', 'hazard analysis', null, 'systems', 'coding', 3,
 'Identifying unsafe states and how to control them.',
 'Hazard analysis looks for conditions that could cause harm, loss, unsafe operation, or unacceptable risk. It asks what hazards exist, what causes them, what controls reduce them, and how the team will verify those controls.',
 'The hazard analysis flagged that expired invite links needed a clear recovery path.',
 'Hazard analysis is risk thinking with consequences attached. It helps you understand how safety-minded teams reason before something breaks.',
 ARRAY['se-fmea','se-control-loop','se-verification','sec-threat-model']::text[],
 ARRAY['se-fmea','se-requirement']::text[],
 'se-control-loop',
 ARRAY[
   'A CDN cache rule for static files',
   'A vector search index for embeddings',
   'A component prop passed through React'
 ]::text[],
 'The ___ flagged that expired invite links needed a clear recovery path.',
 'Use ''hazard analysis'' in a sentence about finding unsafe states and controls.',
 'curated', 'curator', '2026-05-26'),

('se-control-loop', 'control loop', null, 'systems', 'coding', 2,
 'A system that measures output and adjusts input.',
 'A control loop observes what is happening, compares it with a target, and changes inputs to reduce the gap. Thermostats, autoscaling, recommendation tuning, and human-in-the-loop review flows all use control-loop logic.',
 'Autoscaling is a control loop: measure queue depth, add workers, then measure again.',
 'Control loop is the feedback-system word. It helps you connect engineering systems to everyday adjustment patterns.',
 ARRAY['se-feedback','cloud-autoscaling','cloud-metric','math-state-machine']::text[],
 ARRAY['se-feedback','cloud-metric']::text[],
 'se-feedback',
 ARRAY[
   'A primary key for one database row',
   'A browser cookie storing a session id',
   'A source map for debugging bundles'
 ]::text[],
 'Autoscaling is a ___: measure queue depth, add workers, then measure again.',
 'Use ''control loop'' in a sentence about measuring output and adjusting input.',
 'curated', 'curator', '2026-05-26'),

('se-feedback', 'feedback', null, 'systems', 'coding', 1,
 'Information returned to adjust future behavior.',
 'Feedback is information from outputs, users, sensors, tests, metrics, or reviews that changes what the system or team does next. Feedback can stabilize a system, improve a product, or expose that the wrong thing is being optimized.',
 'The failed quiz answer became feedback for which term you should review next.',
 'Feedback is the learning signal word. It helps you see how systems improve instead of treating each result as isolated.',
 ARRAY['se-control-loop','ml-loss-function','cloud-metric','prod-kpi']::text[],
 ARRAY['se-control-loop']::text[],
 'se-lifecycle',
 ARRAY[
   'A container image template',
   'A database enum with fixed choices',
   'A DNS record for a domain'
 ]::text[],
 'The failed quiz answer became ___ for which term you should review next.',
 'Use ''feedback'' in a sentence about information used to adjust future behavior.',
 'curated', 'curator', '2026-05-26'),

('se-lifecycle', 'lifecycle', null, 'systems', 'coding', 2,
 'The full path from concept through design, operation, maintenance, and retirement.',
 'A lifecycle is the whole journey of a system or product: idea, requirements, design, build, verification, validation, release, operation, maintenance, change, and retirement. Lifecycle thinking prevents teams from only optimizing the launch moment.',
 'The lifecycle plan included who would maintain the integration after launch.',
 'Lifecycle is the long-view word. It helps you ask what happens after the first version works.',
 ARRAY['se-requirement','se-validation','se-traceability','prod-roadmap']::text[],
 ARRAY['se-requirement','se-validation']::text[],
 'se-traceability',
 ARRAY[
   'A CPU core running one thread',
   'A server log for one request',
   'A model prediction on new input'
 ]::text[],
 'The ___ plan included who would maintain the integration after launch.',
 'Use ''lifecycle'' in a sentence about a system from idea through operation and retirement.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
