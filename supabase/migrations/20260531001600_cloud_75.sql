-- jargon Stage B+1.35 - product/enterprise foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for product and enterprise-software literacy:
-- roadmaps, milestones, backlogs, tickets, epics, stories, acceptance criteria,
-- KPI, OKR, CRM, ERP, systems of record, enterprise SSO, audit logs, and compliance.
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

('prod-roadmap', 'roadmap', null, 'systems', 'coding', 1,
 'A planned sequence of product bets, releases, or capability work.',
 'A roadmap is a directional plan for what a team expects to build or improve over time. Good roadmaps explain priorities, order, uncertainty, and why the work matters. They are not the same as a fixed promise unless the team explicitly treats them that way.',
 'The roadmap put mobile onboarding before the team dashboard.',
 'Roadmap is the planning-word you will hear in product and leadership conversations. It helps separate direction from a guaranteed delivery date.',
 ARRAY['prod-milestone','prod-backlog','prod-epic','prod-okr']::text[],
 ARRAY['prod-milestone']::text[],
 'prod-milestone',
 ARRAY[
   'A generated bundle produced by a build',
   'A service-level objective for uptime',
   'A row-level database policy'
 ]::text[],
 'The ___ put mobile onboarding before the team dashboard.',
 'Use ''roadmap'' in a sentence about planned product direction.',
 'curated', 'curator', '2026-05-26'),

('prod-milestone', 'milestone', null, 'systems', 'coding', 1,
 'A named checkpoint for a body of work.',
 'A milestone groups work around a target such as a launch, review date, demo, release, or phase boundary. It helps teams see whether a larger body of work is on track without treating every ticket as equally important.',
 'The beta milestone included sign-in, lesson play, and basic progress tracking.',
 'Milestone is the checkpoint word. It helps you understand where a project is in a larger sequence.',
 ARRAY['prod-roadmap','prod-epic','prod-ticket','flow-pull-request']::text[],
 ARRAY['prod-roadmap']::text[],
 'prod-epic',
 ARRAY[
   'A branch replayed onto a newer base',
   'A number that lets localhost run multiple services',
   'A model prediction on new input'
 ]::text[],
 'The beta ___ included sign-in, lesson play, and basic progress tracking.',
 'Use ''milestone'' in a sentence about a named checkpoint for work.',
 'curated', 'curator', '2026-05-26'),

('prod-backlog', 'backlog', null, 'systems', 'coding', 1,
 'The queue of work not yet done.',
 'A backlog is the ordered or unordered collection of possible work: bugs, improvements, chores, ideas, research, and requests. A healthy backlog is curated; an unhealthy one becomes a junk drawer nobody trusts.',
 'The backlog had five visual QA fixes and three content gaps.',
 'Backlog is the queue word. It helps you hear whether an item is planned, merely captured, or actually being worked.',
 ARRAY['prod-ticket','prod-roadmap','prod-epic','prod-story']::text[],
 ARRAY['prod-ticket']::text[],
 'prod-ticket',
 ARRAY[
   'A generated test report',
   'A traffic router across servers',
   'A cryptographic fingerprint'
 ]::text[],
 'The ___ had five visual QA fixes and three content gaps.',
 'Use ''backlog'' in a sentence about queued product or engineering work.',
 'curated', 'curator', '2026-05-26'),

('prod-ticket', 'ticket', null, 'systems', 'coding', 1,
 'A trackable unit of work, bug, request, or investigation.',
 'A ticket is a record for one piece of work. It usually has a title, description, owner, status, priority, comments, and links to designs or pull requests. Tickets help teams coordinate without losing context in chat.',
 'The ticket asked for the version pill to show the latest three releases.',
 'Ticket is the trackable-work word. It helps you follow how loose requests become owned tasks.',
 ARRAY['prod-backlog','prod-story','flow-pull-request','prod-acceptance-criteria']::text[],
 ARRAY['prod-backlog']::text[],
 'prod-story',
 ARRAY[
   'A server log emitted during runtime',
   'A database index used for faster reads',
   'A validation dataset for a model'
 ]::text[],
 'The ___ asked for the version pill to show the latest three releases.',
 'Use ''ticket'' in a sentence about a trackable unit of work.',
 'curated', 'curator', '2026-05-26'),

('prod-epic', 'epic', null, 'systems', 'coding', 2,
 'A larger body of related product work.',
 'An epic groups multiple stories, tickets, or tasks under one larger outcome. It is bigger than a single ticket but smaller and more concrete than a whole strategy. Epics help teams plan, estimate, and communicate progress across related work.',
 'The learning-content epic included ML, systems, QA, and product vocabulary packs.',
 'Epic is the bigger-bucket word. It helps you understand why many tickets may belong to one larger goal.',
 ARRAY['prod-story','prod-ticket','prod-milestone','prod-roadmap']::text[],
 ARRAY['prod-ticket','prod-roadmap']::text[],
 'prod-story',
 ARRAY[
   'A fake dependency used in a test',
   'A CPU core running a thread',
   'A customer uptime contract'
 ]::text[],
 'The learning-content ___ included ML, systems, QA, and product vocabulary packs.',
 'Use ''epic'' in a sentence about a larger body of related work.',
 'curated', 'curator', '2026-05-26'),

('prod-story', 'story', null, 'systems', 'coding', 1,
 'A user-shaped description of desired behavior.',
 'A story frames work from a user or stakeholder perspective, often in the form "as a user, I want..." The useful part is not the template; it is the discipline of naming who needs what outcome and why.',
 'The story said Sam wants to tap any unfamiliar term and see a plain explanation.',
 'Story is the user-outcome word. It helps you connect implementation tasks back to a person trying to do something.',
 ARRAY['prod-epic','prod-acceptance-criteria','prod-ticket','se-use-case']::text[],
 ARRAY['prod-ticket','se-use-case']::text[],
 'prod-acceptance-criteria',
 ARRAY[
   'A branch waiting for code review',
   'A dashboard metric over time',
   'A background process on the OS'
 ]::text[],
 'The ___ said Sam wants to tap any unfamiliar term and see a plain explanation.',
 'Use ''story'' in a sentence about user-shaped desired behavior.',
 'curated', 'curator', '2026-05-26'),

('prod-acceptance-criteria', 'acceptance criteria', null, 'systems', 'coding', 2,
 'Conditions that define when work is done.',
 'Acceptance criteria are specific checks that must be true before a story or ticket counts as complete. They can cover behavior, edge cases, copy, accessibility, performance, data, and verification evidence.',
 'The acceptance criteria required mobile and desktop layouts to pass visual QA.',
 'Acceptance criteria are the done-means-done words. They help you make fuzzy requests testable.',
 ARRAY['prod-story','se-requirement','se-verification','qa-e2e-test']::text[],
 ARRAY['prod-story','se-requirement']::text[],
 'se-verification',
 ARRAY[
   'A code bundle produced by a build',
   'A customer relationship database',
   'A one-way hash of a password'
 ]::text[],
 'The ___ required mobile and desktop layouts to pass visual QA.',
 'Use ''acceptance criteria'' in a sentence about conditions for done.',
 'curated', 'curator', '2026-05-26'),

('prod-kpi', 'KPI', 'K-P-I', 'systems', 'coding', 2,
 'Key performance indicator: a metric used to track business health.',
 'KPI stands for key performance indicator. A KPI is a chosen business metric that signals whether something important is moving in the right direction: retention, conversion, revenue, activation, support response time, or churn.',
 'Weekly active learners became a KPI for whether the learning loop was working.',
 'KPI is the business-measurement word. It helps you understand which numbers leadership treats as signal rather than noise.',
 ARRAY['prod-okr','cloud-metric','prod-roadmap','qa-slo']::text[],
 ARRAY['cloud-metric']::text[],
 'prod-okr',
 ARRAY[
   'A browser port on localhost',
   'A code review comment',
   'A prepared fixture for a test'
 ]::text[],
 'Weekly active learners became a ___ for whether the learning loop was working.',
 'Use ''KPI'' in a sentence about a key business metric.',
 'curated', 'curator', '2026-05-26'),

('prod-okr', 'OKR', 'O-K-R', 'systems', 'coding', 2,
 'Objectives and key results: a goal-setting format that links outcomes to measures.',
 'OKR stands for objectives and key results. The objective names the qualitative aim; key results name measurable outcomes that show progress. A good OKR says what the team is trying to accomplish, not just which tasks it will do.',
 'The OKR paired "make jargon useful for you" with key results around lesson completion and retention.',
 'OKR is the goal-and-measure word. It helps you hear the difference between doing work and proving the work mattered.',
 ARRAY['prod-kpi','prod-roadmap','prod-milestone','cloud-metric']::text[],
 ARRAY['prod-kpi']::text[],
 'prod-roadmap',
 ARRAY[
   'A generated build artifact',
   'A database transaction',
   'A security permission bundle'
 ]::text[],
 'The ___ paired "make jargon useful for you" with key results around lesson completion and retention.',
 'Use ''OKR'' in a sentence about an objective and measurable key results.',
 'curated', 'curator', '2026-05-26'),

('prod-crm', 'CRM', 'C-R-M', 'systems', 'coding', 2,
 'Customer relationship management software for customer accounts and sales activity.',
 'CRM stands for customer relationship management. A CRM stores accounts, contacts, deals, notes, sales stages, support context, and customer interactions. Salesforce and HubSpot are common examples.',
 'The sales team checked the CRM before asking engineering about the customer escalation.',
 'CRM is the customer-system word. It helps you understand where business teams track who a customer is and what has happened with them.',
 ARRAY['prod-system-of-record','ent-salesforce','ent-hubspot','prod-audit-log']::text[],
 ARRAY['prod-system-of-record']::text[],
 'prod-system-of-record',
 ARRAY[
   'A serverless function runtime',
   'A unit test helper',
   'A network transport protocol'
 ]::text[],
 'The sales team checked the ___ before asking engineering about the customer escalation.',
 'Use ''CRM'' in a sentence about customer account and sales tracking software.',
 'curated', 'curator', '2026-05-26'),

('prod-erp', 'ERP', 'E-R-P', 'systems', 'coding', 2,
 'Enterprise resource planning software for finance, inventory, operations, and planning.',
 'ERP stands for enterprise resource planning. An ERP is the backbone system many large companies use for finance, procurement, inventory, HR, supply chain, and operational planning. SAP and Oracle are common examples.',
 'The warehouse integration waited on the ERP because inventory counts lived there.',
 'ERP is the enterprise-backbone word. It helps you understand why some integrations involve huge slow systems instead of a simple app database.',
 ARRAY['prod-system-of-record','ent-sap','ent-oracle','prod-compliance']::text[],
 ARRAY['prod-system-of-record']::text[],
 'prod-compliance',
 ARRAY[
   'A Git branch for review',
   'A language-model prompt setting',
   'A browser storage cookie'
 ]::text[],
 'The warehouse integration waited on the ___ because inventory counts lived there.',
 'Use ''ERP'' in a sentence about enterprise finance, inventory, or operations software.',
 'curated', 'curator', '2026-05-26'),

('prod-system-of-record', 'system of record', null, 'systems', 'coding', 2,
 'The authoritative source for a type of business data.',
 'A system of record is the place everyone agrees is the official source for a data category. A CRM might be the system of record for accounts. An ERP might be the system of record for inventory. Other systems may copy the data, but the source wins when they disagree.',
 'The CRM was the system of record for customer owner and account status.',
 'System of record is the authority word. It helps you ask which system is trusted when two screens disagree.',
 ARRAY['prod-crm','prod-erp','data-primary-key','prod-audit-log']::text[],
 ARRAY['prod-crm','prod-erp']::text[],
 'prod-audit-log',
 ARRAY[
   'A code review checklist',
   'A model training split',
   'A local dev server port'
 ]::text[],
 'The CRM was the ___ for customer owner and account status.',
 'Use ''system of record'' in a sentence about the authoritative source for business data.',
 'curated', 'curator', '2026-05-26'),

('prod-sso', 'enterprise SSO', 'S-S-O', 'systems', 'coding', 2,
 'Single sign-on managed organization-wide by an identity provider.',
 'SSO stands for single sign-on. Enterprise SSO lets employees use one managed identity provider, such as Okta, Google Workspace, Microsoft Entra ID, or OneLogin, to access many work apps with centralized access control.',
 'The enterprise SSO requirement meant users had to sign in through Okta.',
 'Enterprise SSO is the work-login word. It helps you understand why company apps rarely use only a standalone email-password flow.',
 ARRAY['sec-sso','sec-oauth','sec-role','prod-compliance']::text[],
 ARRAY['sec-sso','sec-oauth']::text[],
 'prod-compliance',
 ARRAY[
   'A product roadmap checkpoint',
   'A generated build artifact',
   'A database join'
 ]::text[],
 'The enterprise ___ requirement meant users had to sign in through Okta.',
 'Use ''enterprise SSO'' in a sentence about organization-wide single sign-on.',
 'curated', 'curator', '2026-05-26'),

('prod-audit-log', 'audit log', null, 'systems', 'coding', 2,
 'A record of who did what and when.',
 'An audit log records important actions with actor, time, target, and details. It helps teams answer questions such as who changed this setting, who accessed this record, what integration fired, and what happened before an incident.',
 'The audit log showed who accepted the invite and when.',
 'Audit log is the accountability-evidence word. It helps you understand how systems reconstruct history after a question, bug, or compliance request.',
 ARRAY['prod-compliance','cloud-log','prod-system-of-record','sec-permission']::text[],
 ARRAY['cloud-log']::text[],
 'prod-compliance',
 ARRAY[
   'A customer relationship database',
   'A work item in a backlog',
   'A release checkpoint'
 ]::text[],
 'The ___ showed who accepted the invite and when.',
 'Use ''audit log'' in a sentence about recording who did what and when.',
 'curated', 'curator', '2026-05-26'),

('prod-compliance', 'compliance', null, 'systems', 'coding', 2,
 'Meeting required rules, policies, contracts, or standards.',
 'Compliance means satisfying rules that come from law, contracts, internal policy, security standards, privacy expectations, or industry requirements. In software, compliance often affects logging, access control, retention, auditability, approvals, and data handling.',
 'Compliance required the app to keep an audit log of admin changes.',
 'Compliance is the "rules with consequences" word. It helps you understand why some enterprise work is not optional polish.',
 ARRAY['prod-audit-log','sec-permission','prod-sso','prod-erp']::text[],
 ARRAY['prod-audit-log','sec-permission']::text[],
 'sec-threat-model',
 ARRAY[
   'A small browser smoke test',
   'A CPU cache lookup',
   'A branch merge conflict'
 ]::text[],
 '___ required the app to keep an audit log of admin changes.',
 'Use ''compliance'' in a sentence about meeting required rules or standards.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
