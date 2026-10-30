-- jargon Stage B3 — 27 more curated anchor terms for the enterprise path (paste-ready)
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds 27 difficulty-1 anchor terms covering the brand-name enterprise tools
-- that show up in dev / PM / data conversations. All curated, reviewed by the curator
-- on 2026-05-04. Idempotent — `on conflict (id) do nothing` so re-runs are safe.
-- Voice matches the existing 3 enterprise anchors (ent-jira / ent-slack /
-- ent-salesforce template) — name the company behind it when non-obvious,
-- ground "why_it_matters" in following Claude Code or talking to dev family.
--
-- Dictionary count after this migration:
--   enterprise:  3 → 30  (3 existing + 27 new)
--   total:       75 → 102
--
-- Brand-name distractors strategy: each row's three distractors describe OTHER
-- well-known enterprise tools' roles (a learner who half-knows the category
-- gets tricked, a learner who knows the exact tool does not). For example,
-- ent-snowflake's distractors describe Looker, Salesforce, and Datadog.
--
-- Cross-references: every related_terms / prerequisites / stretch_term id
-- resolves to one of the existing 75 anchors or one of these 27. The CHECK
-- constraint on multiple_choice_distractors (length = 3) is honored by every row.

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── enterprise: docs & wikis (2) ─────────────────────────────
('ent-confluence', 'Confluence', 'CON-flew-ence', 'enterprise', 1,
 'Atlassian''s wiki — where enterprise teams write specs, runbooks, and meeting notes that need to outlive a Slack thread.',
 'Confluence is the long-form companion to JIRA. Teams use it for documentation that has to be findable later: project briefs, onboarding guides, architecture docs, retro notes. Built by Atlassian (same company as JIRA), and the two are tightly linked — a JIRA ticket often points to a Confluence page for the deep context.',
 'We need to write that up in Confluence so the next on-call shift has a runbook.',
 'Every "where''s the doc?" question at a Fortune 500 eventually points to Confluence. Knowing the term means you can navigate enterprise knowledge bases without asking "wait, where do you keep that stuff?"',
 ARRAY['ent-jira','ent-notion','dev-readme']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A workplace chat tool organized into channels',
   'A spreadsheet platform for tracking budgets',
   'A video-call tool used for remote standups'
 ]::text[],
 'We need to write that up in ___ so the next on-call shift has a runbook.',
 'Use ''Confluence'' in a sentence about writing internal documentation at a big company.',
 'curated', 'curator', '2026-05-04'),

('ent-notion', 'Notion', null, 'enterprise', 1,
 'A flexible workspace that blends docs, databases, and project boards — popular with startups and side projects.',
 'Notion is what most modern startups use instead of Confluence. Pages can hold rich text, tables, kanban boards, embedded databases, and links between everything. It''s less rigid than enterprise tools — which is its charm and its curse, depending on who you ask.',
 'I''ve got the spec living in a Notion doc — let me share the link.',
 'Family members at startups, indie hackers, and most newer tech podcasts mention Notion constantly. Knowing the term means you understand "send me the Notion" without picturing a vague document somewhere.',
 ARRAY['ent-confluence','ent-linear','dev-readme']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A note-taking app built into macOS',
   'A diagramming tool used for architecture sketches',
   'A cloud storage service for sharing files'
 ]::text[],
 'I''ve got the spec living in a ___ doc — let me share the link.',
 'Use ''Notion'' in a sentence about a flexible workspace doc you''re sharing with someone.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: code hosting (2) ─────────────────────────────
('ent-github', 'GitHub', null, 'enterprise', 1,
 'Microsoft''s code-hosting platform — where most of the world''s open-source and a huge chunk of enterprise code lives.',
 'GitHub is where Git repositories go to be shared. It hosts the code, runs pull requests and code review, fires CI/CD via GitHub Actions, and tracks issues. Owned by Microsoft since 2018. If a project is open-source, the odds are overwhelming it lives on GitHub.',
 'The Jargon repo is on GitHub — push the branch and I''ll open the PR there.',
 'Every Claude Code session that mentions "the repo," "the PR," or "open an issue" almost always means a GitHub repo. Hearing GitHub and picturing the same place where push, PR, and issue all happen is foundational.',
 ARRAY['ent-gitlab','dev-repo','git-pr']::text[],
 ARRAY['dev-repo']::text[],
 'ent-gitlab',
 ARRAY[
   'A package registry for npm libraries',
   'A continuous-integration runner that lives on Atlassian',
   'A code editor built by Microsoft'
 ]::text[],
 'The Jargon repo is on ___ — push the branch and I''ll open the PR there.',
 'Use ''GitHub'' in a sentence about where a repo is hosted.',
 'curated', 'curator', '2026-05-04'),

('ent-gitlab', 'GitLab', null, 'enterprise', 1,
 'GitHub''s biggest competitor — code hosting plus a built-in CI/CD pipeline, popular at companies that self-host.',
 'GitLab does most of what GitHub does (repos, merge requests, issues) but bundles in a CI/CD system that''s usually a separate add-on elsewhere. A lot of large enterprises and security-conscious teams self-host GitLab on their own infrastructure instead of trusting a vendor''s cloud.',
 'Our team uses GitLab because the security team won''t let us host code outside the firewall.',
 'When dev family or a tech podcast says "we''re on GitLab" instead of GitHub, knowing the term means you don''t have to ask "what''s the difference?" mid-conversation.',
 ARRAY['ent-github','dev-repo','dev-ci-cd']::text[],
 ARRAY['dev-repo']::text[],
 null,
 ARRAY[
   'A documentation site for open-source projects',
   'A Linux distribution maintained by Microsoft',
   'A bug-tracking system built by Atlassian'
 ]::text[],
 'Our team uses ___ because the security team won''t let us host code outside the firewall.',
 'Use ''GitLab'' in a sentence about a self-hosted alternative to GitHub.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: issue trackers (2) ───────────────────────────
('ent-linear', 'Linear', null, 'enterprise', 1,
 'A fast, opinionated issue tracker — the modern startup answer to JIRA.',
 'Linear is what teams who hate JIRA usually move to. It''s built around speed (every action has a keyboard shortcut), opinionated workflows, and a clean UI. Smaller and newer teams tend to pick it; large enterprises usually stay on JIRA for compliance and customization reasons.',
 'We''re moving the roadmap into Linear so the cycles actually feel manageable.',
 'When dev family at a startup says "I''ll add a Linear issue" or "check the Linear board," knowing the term means you don''t mentally swap it with JIRA — they''re different tools with different vibes.',
 ARRAY['ent-jira','ent-asana','dev-issue-ticket']::text[],
 ARRAY['dev-issue-ticket']::text[],
 null,
 ARRAY[
   'A spreadsheet template for product roadmaps',
   'A Gantt-chart tool for project timelines',
   'A code-review tool integrated with GitHub'
 ]::text[],
 'We''re moving the roadmap into ___ so the cycles actually feel manageable.',
 'Use ''Linear'' in a sentence about tracking issues at a startup-style team.',
 'curated', 'curator', '2026-05-04'),

('ent-asana', 'Asana', 'uh-SAH-nuh', 'enterprise', 1,
 'A task and project management tool — popular with marketing, ops, and cross-functional teams.',
 'Asana is built around tasks, projects, and timelines rather than software-engineering tickets specifically. You see it most often outside pure dev teams — marketing campaigns, product launches, content calendars. It''s lighter than JIRA but heavier than a checklist.',
 'I''m tracking the launch checklist in Asana so the marketing team can see the same thing.',
 'When a cross-functional org says "it''s in Asana," they mean a task-tracking tool that isn''t JIRA. Knowing the term keeps you from confusing project management (Asana) with engineering ticketing (JIRA).',
 ARRAY['ent-jira','ent-linear','dev-issue-ticket']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A meeting scheduling tool with calendar integration',
   'A bug-tracking system used by software engineers',
   'A whiteboard tool for live design sessions'
 ]::text[],
 'I''m tracking the launch checklist in ___ so the marketing team can see the same thing.',
 'Use ''Asana'' in a sentence about a non-engineering team tracking work.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: CRM & customer ops (3) ───────────────────────
('ent-hubspot', 'HubSpot', null, 'enterprise', 1,
 'A CRM and marketing platform — Salesforce''s lighter, friendlier competitor for small and mid-sized businesses.',
 'HubSpot is customer-relationship management built for teams that found Salesforce overwhelming. It bundles a CRM, email marketing, landing pages, and a help desk into one suite. Most often used by SMBs and startups; once a company hits enterprise scale, they usually migrate to Salesforce.',
 'The growth team logs every demo request in HubSpot — pull the report from there.',
 'When startup family or a marketing podcast says "we run on HubSpot," they mean a CRM that isn''t Salesforce. Knowing the difference (lighter, SMB-focused) means CRM-talk doesn''t collapse into one big blur.',
 ARRAY['ent-salesforce','ent-zendesk','ent-intercom']::text[],
 ARRAY[]::text[],
 'ent-salesforce',
 ARRAY[
   'A logistics tool for tracking package shipments',
   'A monitoring dashboard for server health',
   'A version-control system for marketing assets'
 ]::text[],
 'The growth team logs every demo request in ___ — pull the report from there.',
 'Use ''HubSpot'' in a sentence about a CRM used by a smaller company.',
 'curated', 'curator', '2026-05-04'),

('ent-zendesk', 'Zendesk', null, 'enterprise', 1,
 'A customer-support platform — where companies manage incoming tickets from customers and route them to support agents.',
 'Zendesk is the system that powers most "submit a ticket" forms you''ve filled out. It catches emails, chats, and form submissions, turns them into tickets, and routes them to the right support agent. The customer-facing side of "ticketing," distinct from JIRA''s engineering-internal side.',
 'The customer flagged the bug in Zendesk first — support escalated it to JIRA this morning.',
 'When someone says "the Zendesk ticket" vs. "the JIRA ticket," they mean two completely different systems pointed at two different audiences. Knowing the split keeps the customer-vs-engineering conversation crisp.',
 ARRAY['ent-intercom','ent-jira','dev-issue-ticket']::text[],
 ARRAY['dev-issue-ticket']::text[],
 null,
 ARRAY[
   'A CRM platform for tracking sales pipelines',
   'A workplace chat tool organized into channels',
   'A documentation wiki built by Atlassian'
 ]::text[],
 'The customer flagged the bug in ___ first — support escalated it to JIRA this morning.',
 'Use ''Zendesk'' in a sentence about a customer support ticket.',
 'curated', 'curator', '2026-05-04'),

('ent-intercom', 'Intercom', null, 'enterprise', 1,
 'A customer-messaging platform — the "chat with us" widget in the corner of most modern web apps.',
 'Intercom started as that little chat bubble in the bottom-right of SaaS websites and grew into a full customer-messaging suite: live chat, in-app messages, help-center articles, AI bots. It overlaps with Zendesk but leans more conversational and product-embedded.',
 'Users are pinging us in Intercom about the new pricing — we should write a help article.',
 'When a startup founder or PM says "they messaged us in Intercom," knowing the term means you picture a real product surface (the chat bubble) rather than a vague support inbox.',
 ARRAY['ent-zendesk','ent-hubspot']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A telephony system for call centers',
   'A bug-tracking tool for QA teams',
   'A workplace chat tool for internal teams'
 ]::text[],
 'Users are pinging us in ___ about the new pricing — we should write a help article.',
 'Use ''Intercom'' in a sentence about messaging customers from inside a product.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: BI & analytics (3) ───────────────────────────
('ent-looker', 'Looker', null, 'enterprise', 1,
 'Google''s business-intelligence platform — where data teams build dashboards and explore metrics on top of a data warehouse.',
 'Looker is a BI tool: you connect it to a data warehouse (Snowflake, BigQuery, Redshift) and build governed dashboards on top. Acquired by Google in 2019. The differentiator is LookML — a modeling layer that defines metrics in code so every dashboard agrees on what "active user" actually means.',
 'Pull the Looker dashboard for last quarter''s retention before the meeting.',
 'When dev family or a data person says "I built that in Looker," knowing the term means you can ask the right follow-up — what dashboard, on what data — instead of nodding past it.',
 ARRAY['ent-tableau','ent-powerbi','ent-bigquery']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A spreadsheet program built by Microsoft',
   'A data warehouse for storing structured data',
   'A monitoring dashboard for server uptime'
 ]::text[],
 'Pull the ___ dashboard for last quarter''s retention before the meeting.',
 'Use ''Looker'' in a sentence about pulling a dashboard built on top of a data warehouse.',
 'curated', 'curator', '2026-05-04'),

('ent-tableau', 'Tableau', 'tab-LOH', 'enterprise', 1,
 'Salesforce''s drag-and-drop BI tool — the dominant choice for analysts who build charts visually instead of writing SQL.',
 'Tableau is what data analysts at most large companies use to turn rows of data into charts and dashboards. It''s known for a powerful drag-and-drop interface — you can build a complex visualization without writing a single line of code. Acquired by Salesforce in 2019, often paired with a Snowflake or Redshift warehouse underneath.',
 'The analyst built the regional pipeline view in Tableau — share the link in #leadership.',
 'Every Fortune 500 and most consulting decks lean on Tableau for charts. Knowing the term means you don''t conflate "the dashboard" with "the data" — Tableau is the rendering layer, not the source.',
 ARRAY['ent-looker','ent-powerbi','ent-snowflake']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A data warehouse used to store analytics data',
   'A spreadsheet macro for pivoting tables',
   'A SQL editor used by database engineers'
 ]::text[],
 'The analyst built the regional pipeline view in ___ — share the link in #leadership.',
 'Use ''Tableau'' in a sentence about a chart or dashboard built by an analyst.',
 'curated', 'curator', '2026-05-04'),

('ent-powerbi', 'Power BI', 'POW-er B-I', 'enterprise', 1,
 'Microsoft''s BI tool — Tableau''s biggest competitor, deeply integrated with Excel and the rest of the Microsoft 365 stack.',
 'Power BI is Microsoft''s answer to Tableau. It does the same job (turn data into dashboards) but feels native to anyone who lives in Excel and Teams. Companies on a Microsoft-heavy stack (which is most large enterprises, including most retailers) usually default to Power BI because it''s already in the license bundle.',
 'Finance lives in Power BI — they''ll want any new metric added there too.',
 'When leadership says "the Power BI report" or family at a Microsoft-shop says "I built this in Power BI," knowing the term means BI talk doesn''t collapse into "some chart somewhere."',
 ARRAY['ent-tableau','ent-looker','ent-azure']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A cloud database service from Amazon',
   'A code editor built by Microsoft',
   'A pivot-table feature inside Microsoft Excel'
 ]::text[],
 'Finance lives in ___ — they''ll want any new metric added there too.',
 'Use ''Power BI'' in a sentence about a dashboard built on the Microsoft stack.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: data warehouses & lakes (4) ──────────────────
('ent-snowflake', 'Snowflake', null, 'enterprise', 1,
 'A cloud data warehouse — where companies pile up all their analytics data so BI tools can query it.',
 'Snowflake is a data warehouse you don''t install — it runs in the cloud (AWS, Azure, or GCP underneath) and you pay per query and per byte stored. Companies use it to consolidate data from every system (Salesforce, the product DB, marketing tools) into one queryable place. Tableau and Looker dashboards usually sit on top.',
 'Pull the Snowflake dashboard for last quarter — the warehouse refreshed at midnight.',
 'When dev family says "the data is in Snowflake" or PMs say "ask the analyst to query Snowflake," knowing the term means you picture a specific cloud data warehouse, not a generic database.',
 ARRAY['ent-databricks','ent-bigquery','ent-redshift']::text[],
 ARRAY['sys-database']::text[],
 'ent-databricks',
 ARRAY[
   'A business-intelligence dashboard tool',
   'A CRM platform for tracking customer accounts',
   'A monitoring service for server uptime'
 ]::text[],
 'Pull the ___ dashboard for last quarter — the warehouse refreshed at midnight.',
 'Use ''Snowflake'' in a sentence about querying a cloud data warehouse.',
 'curated', 'curator', '2026-05-04'),

('ent-databricks', 'Databricks', null, 'enterprise', 1,
 'A unified data and AI platform built on Apache Spark — Snowflake''s biggest competitor, leaning toward ML and big-data workloads.',
 'Databricks started as the commercial home of Apache Spark and grew into a one-stop shop for data engineering, analytics, and machine learning. Companies pick it over Snowflake when they have heavy ML pipelines or work with messy unstructured data (logs, images, raw text). Both run on top of AWS, Azure, or GCP.',
 'The ML team is on Databricks because their training jobs need real Spark muscle.',
 'When data family says "we''re on Databricks" instead of Snowflake, knowing the term means you can ask the right follow-up (ML? big data? both?) instead of treating them as the same thing.',
 ARRAY['ent-snowflake','ent-bigquery','ai-llm']::text[],
 ARRAY['sys-database']::text[],
 null,
 ARRAY[
   'A drag-and-drop dashboard tool',
   'A version-control system for data files',
   'A NoSQL database for storing JSON documents'
 ]::text[],
 'The ML team is on ___ because their training jobs need real Spark muscle.',
 'Use ''Databricks'' in a sentence about a data platform leaning toward ML and big-data work.',
 'curated', 'curator', '2026-05-04'),

('ent-bigquery', 'BigQuery', null, 'enterprise', 1,
 'Google''s serverless cloud data warehouse — where teams on GCP stash analytics data and run SQL at petabyte scale.',
 'BigQuery is GCP''s answer to Snowflake. You don''t provision servers — you just write SQL and Google scales the compute behind it, charging per query. Tightly integrated with the rest of GCP (Looker, GA4, Firebase) and a default choice for teams already on Google Cloud.',
 'The product analytics fire into BigQuery overnight — the dashboards rebuild from there.',
 'When dev family on a Google-shop team says "it''s in BigQuery," knowing the term means you understand they mean a specific cloud warehouse on GCP, not a generic SQL database.',
 ARRAY['ent-snowflake','ent-redshift','ent-gcp']::text[],
 ARRAY['sys-database']::text[],
 null,
 ARRAY[
   'A search engine algorithm built by Google',
   'A NoSQL database for mobile apps',
   'A spreadsheet tool inside Google Workspace'
 ]::text[],
 'The product analytics fire into ___ overnight — the dashboards rebuild from there.',
 'Use ''BigQuery'' in a sentence about a cloud data warehouse on Google''s stack.',
 'curated', 'curator', '2026-05-04'),

('ent-redshift', 'Redshift', null, 'enterprise', 1,
 'Amazon''s cloud data warehouse — the AWS-native equivalent of Snowflake or BigQuery.',
 'Redshift is AWS''s data warehouse. Teams already deep in AWS (most of the Fortune 500) often default to Redshift because the data is already there and the bills are already going to Amazon. Faces real competition from Snowflake, which runs on AWS itself but charges separately.',
 'The legacy analytics still live in Redshift — the migration to Snowflake is half done.',
 'When dev family at an AWS-heavy company says "Redshift cluster" or "we''re on Redshift," knowing the term means you place it on the data-warehouse map alongside Snowflake and BigQuery.',
 ARRAY['ent-snowflake','ent-bigquery','ent-aws']::text[],
 ARRAY['sys-database']::text[],
 null,
 ARRAY[
   'A photo-editing feature on iOS',
   'A drag-and-drop dashboard tool',
   'A real-time messaging service from Amazon'
 ]::text[],
 'The legacy analytics still live in ___ — the migration to Snowflake is half done.',
 'Use ''Redshift'' in a sentence about a data warehouse on AWS.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: legacy enterprise giants (3) ─────────────────
('ent-oracle', 'Oracle', null, 'enterprise', 1,
 'A legendary enterprise database and software giant — the place most Fortune 500 financial and ERP systems still run on.',
 'Oracle the company sells dozens of products, but most often "Oracle" means the Oracle Database — the relational database that powers a huge portion of bank, insurance, and pharma backends, including big chunks of them. It''s expensive, powerful, and famously sticky: companies rarely migrate off, even decades later.',
 'Half the integration work is just talking to the Oracle database the warehouse pulls from.',
 'When architecture talk mentions "Oracle" or family at a bank says "the Oracle DBA has to approve it," knowing the term means you don''t confuse the company (Oracle) with whatever generic SQL database might be in mind.',
 ARRAY['ent-sap','sys-database','ent-snowflake']::text[],
 ARRAY['sys-database']::text[],
 null,
 ARRAY[
   'A consulting firm specializing in cloud strategy',
   'A NoSQL document database for web apps',
   'A continuous-integration platform for Java teams'
 ]::text[],
 'Half the integration work is just talking to the ___ database the warehouse pulls from.',
 'Use ''Oracle'' in a sentence about a legacy enterprise database powering a large company.',
 'curated', 'curator', '2026-05-04'),

('ent-sap', 'SAP', 'S-A-P', 'enterprise', 1,
 'The German enterprise-software giant whose ERP system runs the supply chain and finance backbone of most of the Fortune 500.',
 'SAP is most famous for its ERP (Enterprise Resource Planning) software — the system that ties together a company''s finance, supply chain, HR, and procurement. If a multinational ships physical goods, odds are SAP is somewhere in the loop. Implementations are huge, slow, and notoriously hard to replace.',
 'The pricing change has to flow through SAP before any store can ring it up.',
 'When a large enterprise says "it''s an SAP issue," knowing the term means you understand a specific ERP backbone is involved — not just "some old system."',
 ARRAY['ent-oracle','ent-workday','ent-servicenow']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A customer-support ticketing tool',
   'A version-control system for code repositories',
   'A cloud storage service for enterprise files'
 ]::text[],
 'The pricing change has to flow through ___ before any store can ring it up.',
 'Use ''SAP'' in a sentence about an enterprise system that runs core business operations.',
 'curated', 'curator', '2026-05-04'),

('ent-palantir', 'Palantir', 'PAL-an-teer', 'enterprise', 1,
 'A controversial data-integration platform — used by governments, militaries, and a growing list of large enterprises to fuse messy data sources.',
 'Palantir builds platforms (Foundry for commercial, Gotham for government) that pull data from many systems into one operational view. Famous for intelligence and defense work, increasingly common in healthcare, manufacturing, and supply chain. Polarizing because of who its first customers were.',
 'They brought in Palantir to stitch the supply-chain data across the legacy systems.',
 'When tech podcasts or family in defense/healthcare mention Palantir, knowing the term means you place it on the data-platform map (between Snowflake-style warehouses and full custom integration work) instead of treating it as just another vendor name.',
 ARRAY['ent-snowflake','ent-databricks','ent-oracle']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A cybersecurity firewall product',
   'A drag-and-drop BI dashboard tool',
   'A cloud computing platform for startups'
 ]::text[],
 'They brought in ___ to stitch the supply-chain data across the legacy systems.',
 'Use ''Palantir'' in a sentence about a data-integration platform fusing many sources.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: HR & IT operations (3) ───────────────────────
('ent-workday', 'Workday', null, 'enterprise', 1,
 'A cloud HR and finance platform — where most large companies (large enterprises included) run payroll, time off, and the org chart.',
 'Workday is the system of record for HR at huge swaths of the Fortune 500. PTO requests, performance reviews, the org chart, payroll, and increasingly finance/ERP — all in one cloud platform. Replaces or sits alongside older tools like SAP and Oracle HR modules.',
 'Submit the time-off request in Workday so it routes to the right manager.',
 'Most large-company employees touch Workday every pay period. Knowing the term means HR-system talk has a real referent instead of being "that thing where I check my paystub."',
 ARRAY['ent-sap','ent-servicenow','ent-okta']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A project management tool used by software teams',
   'A workplace chat platform for office workers',
   'A calendar app integrated with email'
 ]::text[],
 'Submit the time-off request in ___ so it routes to the right manager.',
 'Use ''Workday'' in a sentence about an HR or payroll action at a big company.',
 'curated', 'curator', '2026-05-04'),

('ent-servicenow', 'ServiceNow', null, 'enterprise', 1,
 'An IT-service-management platform — where employees file IT tickets, request access, and report outages at large enterprises.',
 'ServiceNow runs the "submit an IT ticket" experience at most Fortune 500 companies. New laptop? File it in ServiceNow. Account locked? ServiceNow ticket. Server down? ServiceNow incident. It''s the JIRA of internal IT — different audience, similar shape.',
 'I opened a ServiceNow ticket for the VPN issue — IT said two business days.',
 'When IT or family at a large company says "did you open a ServiceNow ticket?" knowing the term means you understand which system handles internal IT requests vs. engineering work.',
 ARRAY['ent-jira','ent-okta','dev-issue-ticket']::text[],
 ARRAY['dev-issue-ticket']::text[],
 null,
 ARRAY[
   'A customer-support ticketing platform',
   'A bug-tracking tool used by developers',
   'A status-page service that reports outages publicly'
 ]::text[],
 'I opened a ___ ticket for the VPN issue — IT said two business days.',
 'Use ''ServiceNow'' in a sentence about filing an internal IT ticket.',
 'curated', 'curator', '2026-05-04'),

('ent-okta', 'Okta', 'OCK-tuh', 'enterprise', 1,
 'An identity provider — the single sign-on service that lets you log into every work app with one set of credentials.',
 'Okta sits in front of every other enterprise app. You log into Okta once, and from there you can launch Slack, Salesforce, Workday, GitHub, etc. without re-entering credentials. This pattern is called SSO (single sign-on); Okta is the dominant vendor for it.',
 'Okta is down again — nobody can log into anything until it''s back.',
 'When an enterprise says "log in via Okta" or "Okta is having issues," knowing the term means you understand why one service being down can break access to everything else at once.',
 ARRAY['ent-workday','ent-servicenow','ent-aws']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A password manager for individual users',
   'A VPN service for remote employees',
   'An email security gateway for spam filtering'
 ]::text[],
 '___ is down again — nobody can log into anything until it''s back.',
 'Use ''Okta'' in a sentence about single sign-on across work apps.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: cloud providers (3) ──────────────────────────
('ent-aws', 'AWS', 'A-W-S', 'enterprise', 1,
 'Amazon Web Services — the largest cloud provider, where a huge share of the internet''s servers, databases, and infrastructure run.',
 'AWS is Amazon''s cloud platform. Companies rent compute, storage, databases, and dozens of other services from it instead of running their own data centers. The default choice for most startups and a huge portion of enterprises. Competitors are Azure (Microsoft) and GCP (Google).',
 'The Lambda function runs in AWS — check CloudWatch if it''s erroring.',
 'When Claude Code or dev family mentions "the AWS bill," "spin up an EC2," or "S3 bucket," they''re talking about specific Amazon services. Knowing AWS as the umbrella keeps the rest of cloud talk navigable.',
 ARRAY['ent-azure','ent-gcp','ent-redshift']::text[],
 ARRAY[]::text[],
 'ent-kubernetes',
 ARRAY[
   'An online store for buying physical goods',
   'A streaming service for video content',
   'A customer-service department of a retailer'
 ]::text[],
 'The Lambda function runs in ___ — check CloudWatch if it''s erroring.',
 'Use ''AWS'' in a sentence about a service or app running on Amazon''s cloud.',
 'curated', 'curator', '2026-05-04'),

('ent-azure', 'Azure', 'AZH-er', 'enterprise', 1,
 'Microsoft''s cloud platform — AWS''s biggest competitor, dominant at companies already deep in the Microsoft 365 stack.',
 'Azure is Microsoft''s answer to AWS — same idea, different ecosystem. It tends to win at companies already running Office, Teams, Active Directory, and the rest of the Microsoft stack (which is most large enterprises, included). Tightly integrated with Power BI, GitHub, and the Microsoft developer tools.',
 'The new service is going on Azure because that''s where the rest of the workload runs.',
 'When architecture or dev family at a Microsoft shop mentions "Azure," knowing the term means you place it as the cloud, not as some other Microsoft tool.',
 ARRAY['ent-aws','ent-gcp','ent-powerbi']::text[],
 ARRAY[]::text[],
 null,
 ARRAY[
   'A blue color used in Microsoft branding',
   'A cloud database service from Oracle',
   'A version of Windows for enterprise customers'
 ]::text[],
 'The new service is going on ___ because that''s where the rest of the workload runs.',
 'Use ''Azure'' in a sentence about an app or service running on Microsoft''s cloud.',
 'curated', 'curator', '2026-05-04'),

('ent-gcp', 'GCP (Google Cloud)', 'G-C-P', 'enterprise', 1,
 'Google Cloud Platform — the third major cloud provider, often picked for data, ML, and Kubernetes workloads.',
 'GCP is Google''s cloud, the smallest of the big three (AWS and Azure are larger) but dominant in specific niches: data warehousing (BigQuery), ML/AI tooling, and anything Kubernetes — Google invented Kubernetes and runs the most polished managed version of it.',
 'We picked GCP because BigQuery and the ML tooling are so much better integrated.',
 'When dev family or a tech podcast says "we''re on GCP," knowing the term means you place it next to AWS and Azure (not as a separate kind of thing) and can ask why they chose it.',
 ARRAY['ent-aws','ent-azure','ent-bigquery']::text[],
 ARRAY[]::text[],
 'ent-kubernetes',
 ARRAY[
   'The search engine product from Google',
   'A productivity suite for office documents',
   'A consumer cloud-storage service for photos'
 ]::text[],
 'We picked ___ because BigQuery and the ML tooling are so much better integrated.',
 'Use ''GCP'' or ''Google Cloud'' in a sentence about a service running on Google''s cloud.',
 'curated', 'curator', '2026-05-04'),

-- ─── enterprise: containers & orchestration (2) ───────────────
('ent-docker', 'Docker', null, 'enterprise', 1,
 'The tool that packages an app and everything it needs to run into a portable container — so it works the same on every machine.',
 'Docker bundles your app, its dependencies, its runtime, and its config into a "container" — a self-contained unit that runs identically on your laptop, on a teammate''s machine, on a CI server, and in production. Solves the classic "it works on my machine" problem.',
 'I''ll dockerize the worker so we can run the same image locally and in staging.',
 'When Claude Code or dev family says "spin up the Docker container" or "the Docker image is broken," knowing the term means you picture a portable box wrapping the app, not some abstract setup step.',
 ARRAY['ent-kubernetes','dev-build','dev-deploy']::text[],
 ARRAY[]::text[],
 'ent-kubernetes',
 ARRAY[
   'A virtual machine that runs an entire operating system',
   'A version-control system for application binaries',
   'A continuous-integration tool that runs tests'
 ]::text[],
 'I''ll ___-ize the worker so we can run the same image locally and in staging.',
 'Use ''Docker'' in a sentence about packaging an app into a portable container.',
 'curated', 'curator', '2026-05-04'),

('ent-kubernetes', 'Kubernetes (k8s)', 'koo-ber-NET-eez', 'enterprise', 1,
 'The system that runs and orchestrates Docker containers across a fleet of servers — handles scaling, restarts, and networking automatically.',
 'Kubernetes (often shortened to k8s — "k", eight letters, "s") takes a bunch of Docker containers and runs them across many machines. It handles starting them, restarting them when they crash, scaling them up under load, networking them together, and rolling out new versions. Originally built by Google; now the default container orchestrator at most large enterprises.',
 'The Kubernetes cluster auto-scaled overnight when traffic spiked — no pages.',
 'When dev family says "we''re on Kubernetes" or Claude Code mentions "the k8s deploy," knowing the term means you understand the layer above Docker — orchestration, not just packaging.',
 ARRAY['ent-docker','ent-gcp','dev-deploy']::text[],
 ARRAY['ent-docker']::text[],
 null,
 ARRAY[
   'A relational database service from Google',
   'A dashboard for monitoring Docker container logs',
   'A configuration-management tool like Ansible'
 ]::text[],
 'The ___ cluster auto-scaled overnight when traffic spiked — no pages.',
 'Use ''Kubernetes'' in a sentence about orchestrating containers across many servers.',
 'curated', 'curator', '2026-05-04')

on conflict (id) do nothing;
