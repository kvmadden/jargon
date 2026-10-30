-- Jargon Stage B3 — 27 more curated anchor terms for the systems path
-- All difficulty 1, all curated, reviewed by the curator on 2026-05-04.
-- Voice matches the existing 3 systems anchors (sys-server / sys-database /
-- sys-rest template) — translator-not-professor: name what the thing IS in
-- plain English, lean on a real-world analogy in the long_definition, then
-- ground "why_it_matters" in (a) following Claude Code OR (b) talking to dev
-- family who throw infra terms at the owner daily. Systems vocab matters because
-- it is the "how does this app actually run" language under every conversation
-- about scale, reliability, latency, and outages.
--
-- Idempotent: `on conflict (id) do nothing` so re-runs don't fail and don't
-- overwrite anything an upstream cloud migration already inserted.
--
-- Dictionary count after this migration:
--   systems: 3 → 30  (3 existing + 27 new)
--   total: 183 → 210  (Stage A target met)
--
-- Distractor strategy: each row's three distractors describe OTHER systems
-- concepts (or adjacent infra artifacts) so a half-knowledgeable learner
-- gets tricked. For acronym pairs (authn/authz, SLA/SLO) the FIRST distractor
-- describes the OTHER one in the pair — same neighborhood, distinct meaning.
--
-- Cross-references: every related_terms / prerequisites / stretch_term id
-- resolves to one of the existing 183 anchors or one of these 27. Rich
-- internal cross-linking inside the path:
--   • sys-monolith ↔ sys-microservice ↔ sys-api-gateway ↔ sys-load-balancer (scaling family)
--   • sys-sql ↔ sys-nosql ↔ sys-index ↔ sys-schema ↔ sys-migration (database internals family)
--   • sys-dns ↔ sys-https ↔ sys-cdn (network / transit family)
--   • sys-cache ↔ sys-cdn (caching siblings; cross-path to cc-caching)
--   • sys-authn ↔ sys-authz ↔ sys-sso (auth family; cross-path to ent-okta)
--   • sys-rest ↔ sys-graphql ↔ sys-webhook ↔ sys-websocket (API/interaction patterns)
--   • sys-event-driven ↔ sys-pub-sub ↔ sys-queue ↔ sys-queue-worker ↔ sys-cron (async/background work)
--   • sys-monitoring ↔ sys-sla ↔ sys-slo (reliability / operations family)
--
-- Cross-path notes:
--   • sys-sql / sys-nosql / sys-index / sys-schema / sys-migration are the
--     INTERNALS of a database engine. sys-database (existing) is the abstract
--     storage system; dev-database (existing) is the conceptual role. The new
--     entries cross-link to both.
--   • sys-cache and cc-caching share the word "caching" but operate at
--     different layers — cross-link sys-cache → cc-caching.
--   • sys-sso links to ent-okta (the most common SSO vendor the owner will hear).

insert into terms (
  id, term, pronunciation, path, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

-- ─── systems: scaling architecture (4) ─────────────────────────
('sys-load-balancer', 'load balancer', null, 'systems', 1,
 'A traffic cop sitting in front of a pool of servers — spreads incoming requests across them so no one server gets crushed.',
 'A load balancer is the door between the internet and your fleet of servers. When a request comes in, the load balancer picks one of the available servers to handle it (round-robin, least-busy, by region, etc.). That way you can run 10 identical servers and the load balancer makes them act like one big one. If a server dies, the load balancer stops sending it traffic until it''s healthy again.',
 'The load balancer is sending all the traffic to one node — something''s wrong with the health checks.',
 'Every app that scales past one server has a load balancer in front of it. When dev family says "the LB," this is what they mean. Knowing the term means you understand how a single URL can be served by dozens of machines at once.',
 ARRAY['sys-server','sys-api-gateway','sys-microservice']::text[],
 ARRAY['sys-server']::text[],
 'sys-api-gateway',
 ARRAY[
   'A program that compresses files before sending them over the network',
   'A queue that holds requests until a worker is ready to process them',
   'A tool that copies data between two databases for backup'
 ]::text[],
 'The ___ is sending all the traffic to one node — something''s wrong with the health checks.',
 'Use ''load balancer'' in a sentence about spreading requests across multiple servers.',
 'curated', 'curator', '2026-05-04'),

('sys-microservice', 'microservice', null, 'systems', 1,
 'A small, focused service that does one thing — and a microservice architecture is many of these talking to each other.',
 'A microservice is a tiny app with one job: auth, payments, search, notifications, each lives in its own service with its own database, deployed independently. The microservice ARCHITECTURE means an app is built as dozens of these services rather than one big codebase. Pro: teams can ship independently. Con: now you have a distributed-systems problem on your hands.',
 'We split the monolith into eight microservices and now nothing deploys without a coordination meeting.',
 'When dev family says "we''re on microservices" or "that''s a service boundary," this is what they mean. Knowing the term means you understand the dominant tradeoff of modern backend architecture — speed of iteration vs. complexity of coordination.',
 ARRAY['sys-monolith','sys-api-gateway','sys-event-driven']::text[],
 ARRAY['sys-server']::text[],
 'sys-api-gateway',
 ARRAY[
   'A single large codebase that handles every part of an application',
   'A test suite that runs in a tiny isolated environment',
   'A tiny script that runs on a fixed schedule to clean up data'
 ]::text[],
 'We split the monolith into eight ___ and now nothing deploys without a coordination meeting.',
 'Use ''microservice'' in a sentence about a small, focused service that does one job.',
 'curated', 'curator', '2026-05-04'),

('sys-monolith', 'monolith', null, 'systems', 1,
 'One big codebase that runs as a single application — the opposite of microservices.',
 'A monolith is the traditional shape: one repo, one build, one deploy, one process. Login, billing, search, notifications all live inside the same app and share the same database. Easier to start, easier to debug end-to-end, harder to scale a single hot piece in isolation. Most apps start as monoliths; some stay that way forever and ship perfectly fine.',
 'It''s still a Rails monolith — every change ships the whole thing or nothing.',
 'When dev family says "the monolith" or "we''re breaking up the monolith," this is the shape they''re talking about. Knowing the term means you can follow architecture-history conversations and understand why "monolith" isn''t automatically a dirty word.',
 ARRAY['sys-microservice','sys-api-gateway','sys-server']::text[],
 ARRAY['sys-server']::text[],
 'sys-microservice',
 ARRAY[
   'A collection of small services that each handle one job',
   'A single physical server in a data center',
   'A blueprint for an upcoming software release'
 ]::text[],
 'It''s still a Rails ___ — every change ships the whole thing or nothing.',
 'Use ''monolith'' in a sentence about a single big application that contains everything.',
 'curated', 'curator', '2026-05-04'),

('sys-api-gateway', 'API gateway', null, 'systems', 1,
 'The single front door for an API — it routes requests to the right backend service and handles auth, rate limits, and logging in one place.',
 'An API gateway sits between clients and a fleet of backend services. The client talks to one URL; the gateway decides which microservice should actually handle each request, checks the API key, enforces rate limits, and logs the call. It''s the receptionist for a microservices building — one desk, many offices behind it. Tools: Kong, AWS API Gateway, Apigee.',
 'Add the new endpoint to the API gateway config — without that, the route doesn''t exist for clients.',
 'When dev family says "it has to go through the gateway" or "the gateway is rate-limiting us," this is what they mean. Knowing the term means you understand why microservice apps still feel like one API to whoever calls them.',
 ARRAY['sys-microservice','sys-load-balancer','sys-rest']::text[],
 ARRAY['sys-rest']::text[],
 'sys-microservice',
 ARRAY[
   'A type of database used to store user authentication tokens',
   'A bridge connecting two physical office networks',
   'A monitoring dashboard that shows the health of every service'
 ]::text[],
 'Add the new endpoint to the ___ config — without that, the route doesn''t exist for clients.',
 'Use ''API gateway'' in a sentence about the single front door routing requests to backend services.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems: database internals (5) ───────────────────────────
('sys-sql', 'SQL', 'sequel or S-Q-L', 'systems', 1,
 'The standard query language for relational databases — how you tell a database "give me the rows that match these conditions."',
 'SQL (Structured Query Language) is the language you use to talk to relational databases like Postgres, MySQL, and SQLite. You write statements like SELECT name FROM users WHERE active = true. The database parses it and returns rows. Almost every backend developer learns SQL because it''s the lingua franca of data — even non-relational tools (BigQuery, Snowflake) speak SQL.',
 'I rewrote the report as one SQL query — three joins, runs in 200ms instead of 30 seconds.',
 'When dev family says "I wrote a SQL query" or "is that table SQL?" this is the language. Knowing the term means you understand what SEPARATES the dominant database family (SQL) from its rivals (NoSQL).',
 ARRAY['sys-nosql','sys-database','sys-schema']::text[],
 ARRAY['sys-database']::text[],
 'sys-index',
 ARRAY[
   'A flexible-schema database family that stores data as JSON-like documents',
   'A scripting language used to automate server setup',
   'A specification for designing REST APIs'
 ]::text[],
 'I rewrote the report as one ___ query — three joins, runs in 200ms instead of 30 seconds.',
 'Use ''SQL'' in a sentence about querying a relational database.',
 'curated', 'curator', '2026-05-04'),

('sys-nosql', 'NoSQL', 'no-sequel', 'systems', 1,
 'A family of databases that don''t use the SQL/table model — usually trade strict structure for flexibility or scale.',
 'NoSQL ("not only SQL") is the umbrella for everything that isn''t a traditional relational database. Document stores (MongoDB) keep JSON-like records. Key-value stores (Redis, DynamoDB) act like giant hash maps. Wide-column stores (Cassandra) handle massive write volume. They typically give up the rigid schema and join power of SQL in exchange for easier scaling or schema flexibility.',
 'We moved the session store off Postgres to a NoSQL key-value setup — way faster reads.',
 'When dev family says "this fits a NoSQL pattern" or "we''re using a NoSQL store," this is the family. Knowing the term means you can hold the SQL/NoSQL distinction in your head when architecture discussions happen.',
 ARRAY['sys-sql','sys-database','sys-schema']::text[],
 ARRAY['sys-sql']::text[],
 null,
 ARRAY[
   'The standard query language for relational databases like Postgres and MySQL',
   'A protocol for streaming data between two servers in real time',
   'A library for caching results inside an app''s memory'
 ]::text[],
 'We moved the session store off Postgres to a ___ key-value setup — way faster reads.',
 'Use ''NoSQL'' in a sentence about a non-relational database family.',
 'curated', 'curator', '2026-05-04'),

('sys-index', 'index (database)', null, 'systems', 1,
 'A pre-built lookup structure on a database column — makes "find rows where X = …" fast instead of scanning the whole table.',
 'A database index is like the index at the back of a textbook. Without it, finding "users named Maria" means reading every page (every row in the table). With an index on the name column, the database jumps straight to where Maria-rows live. Indexes speed up reads dramatically but slow down writes (every insert has to also update the index) and use disk space.',
 'Add an index on user_id and email — that one query is doing a full table scan.',
 'When dev family says "we need an index on that column" or "the query is missing an index," this is what they mean. Knowing the term means you can follow the most common reason "the database is slow" gets fixed.',
 ARRAY['sys-sql','sys-database','sys-schema']::text[],
 ARRAY['sys-sql']::text[],
 'sys-schema',
 ARRAY[
   'A backup snapshot taken before each database upgrade',
   'A list of every table in the database',
   'A program that runs every night to compress old log files'
 ]::text[],
 'Add an ___ on user_id and email — that one query is doing a full table scan.',
 'Use ''index'' in a sentence about speeding up a slow database query.',
 'curated', 'curator', '2026-05-04'),

('sys-schema', 'schema (database)', null, 'systems', 1,
 'The blueprint for a database — what tables exist, what columns each one has, what type each column holds.',
 'A schema is the structural definition of a database: the users table has id (integer), email (text), created_at (timestamp). The schema is enforced by the database itself — try to insert a string into an integer column and it rejects you. Changing a schema (adding a column, dropping a table) requires a migration. Designing a schema well up front saves you years of pain.',
 'Don''t change the schema in production by hand — write a migration so it''s tracked.',
 'When dev family says "what''s the schema look like?" or "the schema needs to change," this is the blueprint. Knowing the term means you understand what shape the data has to fit into before you can store any.',
 ARRAY['sys-migration','sys-sql','sys-database']::text[],
 ARRAY['sys-database']::text[],
 'sys-migration',
 ARRAY[
   'A scripted change that updates the database structure from one version to the next',
   'A pre-built lookup structure that speeds up SELECT queries',
   'A backup file containing the full contents of a database'
 ]::text[],
 'Don''t change the ___ in production by hand — write a migration so it''s tracked.',
 'Use ''schema'' in a sentence about the structural definition of a database.',
 'curated', 'curator', '2026-05-04'),

('sys-migration', 'migration (database)', null, 'systems', 1,
 'A versioned, repeatable script that changes the database schema — add this column, drop that table, rename this index.',
 'A database migration is a small file (numbered or timestamped) that describes one schema change. Migrations get checked into git and run in order, so every developer''s database and every production database end up in the same state. Tools like Prisma, Knex, Rails migrations, and Supabase migrations all work this way. The Jargon project itself has 14 migrations under supabase/migrations — this entry adds the 15th.',
 'Write a migration to add the streak_freeze column — don''t edit the table directly.',
 'When dev family says "did you run the migrations?" or "I''ll write a migration for that," this is the file. Knowing the term means you understand how schema changes get tracked instead of done as one-off panic updates.',
 ARRAY['sys-schema','sys-database','sys-sql']::text[],
 ARRAY['sys-schema']::text[],
 null,
 ARRAY[
   'A snapshot copy of the database used for restoring after a crash',
   'The blueprint of tables, columns, and types in a database',
   'A pull request that adds a new feature to the codebase'
 ]::text[],
 'Write a ___ to add the streak_freeze column — don''t edit the table directly.',
 'Use ''migration'' in a sentence about a versioned change to a database schema.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems: caching & queues (3) ─────────────────────────────
('sys-queue', 'queue', null, 'systems', 1,
 'A list of jobs waiting to be processed — work goes in one end, workers pull from the other end when they''re ready.',
 'A queue is the buffer between "we know we need to do this" and "we''re actually doing it." A user uploads a video, the upload handler drops a "transcode this" job into the queue, then returns immediately. A pool of workers picks jobs up and processes them in order. Queues smooth out spikes — 1000 uploads in a second don''t crush the server, they just sit in the queue.',
 'We should hit the queue from a worker, not the web server — the upload should return in 50ms.',
 'When dev family says "drop it on the queue" or "the queue is backed up," this is what they mean. Knowing the term means you understand how apps handle "do this later" work without making users wait.',
 ARRAY['sys-queue-worker','sys-pub-sub','sys-event-driven']::text[],
 ARRAY['sys-server']::text[],
 'sys-queue-worker',
 ARRAY[
   'A program that listens for incoming HTTP requests in real time',
   'A pre-built lookup structure that speeds up database reads',
   'A meeting where engineers prioritize the next sprint of work'
 ]::text[],
 'We should hit the ___ from a worker, not the web server — the upload should return in 50ms.',
 'Use ''queue'' in a sentence about a buffer of jobs waiting to be processed.',
 'curated', 'curator', '2026-05-04'),

('sys-cache', 'cache', 'cash', 'systems', 1,
 'A fast temporary store for results so you don''t have to recompute or re-fetch them every time — like keeping the answer to a slow question on a sticky note.',
 'A cache holds the results of expensive work (a slow database query, an API response, a rendered page) so the next request can grab the answer instantly. Tools like Redis and Memcached are dedicated cache servers; browsers, CDNs, and even databases all have caches built in. The hard part is knowing when to throw old cache entries away ("cache invalidation" — famously one of the two hard problems in computer science).',
 'The dashboard is showing stale numbers — the cache hasn''t expired yet.',
 'When dev family says "cache it" or "cache invalidation bit us again," this is the layer. Knowing the term means you understand the most common trick for making any slow app fast — and the most common reason "the change isn''t showing up."',
 ARRAY['sys-cdn','cc-caching','sys-database']::text[],
 ARRAY['sys-server']::text[],
 'sys-cdn',
 ARRAY[
   'A network device that distributes incoming requests across many servers',
   'A backup of the database taken every night',
   'A queue of jobs waiting to be processed by a worker'
 ]::text[],
 'The dashboard is showing stale numbers — the ___ hasn''t expired yet.',
 'Use ''cache'' in a sentence about storing the result of slow work for fast reuse.',
 'curated', 'curator', '2026-05-04'),

('sys-cdn', 'CDN (content delivery network)', 'C-D-N', 'systems', 1,
 'A globally distributed cache for static files — copies of your images, CSS, and JS sit on servers near every user, so they load fast no matter where they are.',
 'A CDN (content delivery network) is a fleet of servers spread around the world, each holding cached copies of your static assets. A user in Tokyo hits the nearest CDN node, not your origin server in Virginia, so the page loads in milliseconds. Cloudflare, Fastly, AWS CloudFront, Vercel''s edge network — all CDNs. They also absorb DDoS traffic and shield your origin.',
 'The CDN is caching the old version — let me invalidate it.',
 'When dev family says "purge the CDN" or "is it serving from CDN?" this is the layer. Knowing the term means you understand why apps feel fast worldwide and why "I deployed but the change isn''t showing up" is often a CDN problem.',
 ARRAY['sys-cache','sys-dns','sys-https']::text[],
 ARRAY['sys-cache']::text[],
 null,
 ARRAY[
   'A central database that holds every user''s session data',
   'A protocol for encrypting traffic between client and server',
   'A pool of background workers that process queued jobs'
 ]::text[],
 'The ___ is caching the old version — let me invalidate it.',
 'Use ''CDN'' in a sentence about serving static files from servers near each user.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems: network basics (3) ───────────────────────────────
('sys-dns', 'DNS', 'D-N-S', 'systems', 1,
 'The phone book of the internet — translates a human name like jargon.app into the IP address servers actually use.',
 'DNS (Domain Name System) is what turns words into numbers. When you type a URL, your computer asks a DNS server "what IP address goes with this name?" and the DNS server answers. Without DNS you''d have to memorize 4-number IP addresses for every site. DNS changes can take minutes to hours to propagate worldwide — which is why "it''s probably DNS" is a running joke whenever something is mysteriously broken.',
 'It''s probably DNS — give it 20 minutes after the cutover before you panic.',
 'When dev family says "DNS hasn''t propagated yet" or "the DNS records are wrong," this is the layer. Knowing the term means you understand why a fresh domain doesn''t work instantly and why so many outages trace back here.',
 ARRAY['sys-https','sys-cdn','sys-server']::text[],
 ARRAY['sys-server']::text[],
 'sys-cdn',
 ARRAY[
   'The protocol that encrypts traffic between client and server',
   'A network device that spreads requests across multiple servers',
   'A cache that stores recent responses near the user'
 ]::text[],
 'It''s probably ___ — give it 20 minutes after the cutover before you panic.',
 'Use ''DNS'' in a sentence about translating a domain name into a server address.',
 'curated', 'curator', '2026-05-04'),

('sys-https', 'HTTPS / TLS', 'H-T-T-P-S, T-L-S', 'systems', 1,
 'The secure version of HTTP — HTTPS uses TLS to encrypt traffic so anyone snooping the network sees gibberish, not your password.',
 'HTTP is plain text — anyone between you and the server can read it. HTTPS wraps that traffic in TLS (Transport Layer Security) encryption, so eavesdroppers see scrambled bytes. TLS also verifies you''re actually talking to the right server (via certificates) so an attacker can''t impersonate the site. Every modern browser refuses to send sensitive data over plain HTTP — HTTPS is the floor.',
 'Don''t ship without HTTPS — even the dev domain has a TLS cert these days.',
 'When dev family says "the cert expired" or "we need HTTPS on that endpoint," this is the protocol. Knowing the term means you understand why every URL starts with https:// and why missing it is a security incident.',
 ARRAY['sys-dns','sys-rest','sys-cdn']::text[],
 ARRAY['sys-server']::text[],
 'sys-dns',
 ARRAY[
   'A system that translates domain names into server IP addresses',
   'A queue protocol used between backend services',
   'A standard for compressing images before delivery'
 ]::text[],
 'Don''t ship without ___ — even the dev domain has a TLS cert these days.',
 'Use ''HTTPS'' in a sentence about encrypting traffic between client and server.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems: auth (3) ─────────────────────────────────────────
('sys-authn', 'authentication (authn)', 'auth-N', 'systems', 1,
 'Proving who you are — username + password, magic link, SSO, fingerprint. Answers the question "are you really who you claim to be?"',
 'Authentication (often shortened to "authn" to distinguish it from authorization) is the WHO part of identity. The user shows up; the system checks the credentials; if they match, the system trusts that this session belongs to that user. Auth methods include passwords, magic links, OAuth, SSO, biometrics, hardware keys. Authn comes BEFORE authorization — first we know who you are, then we decide what you can do.',
 'Authn is fine — the user logged in successfully — but authz is failing on the admin route.',
 'When dev family says "auth is broken" they usually mean authn or authz; knowing the difference is the difference between "they can''t log in" and "they''re logged in but can''t reach this page." Critical for following any auth-related debug session.',
 ARRAY['sys-authz','sys-sso','ent-okta']::text[],
 ARRAY[]::text[],
 'sys-authz',
 ARRAY[
   'Deciding what a logged-in user is allowed to do',
   'Logging into multiple apps with one set of credentials',
   'Encrypting traffic between the client and the server'
 ]::text[],
 '___ is fine — the user logged in successfully — but authz is failing on the admin route.',
 'Use ''authentication'' in a sentence about proving who a user is.',
 'curated', 'curator', '2026-05-04'),

('sys-authz', 'authorization (authz)', 'auth-Z', 'systems', 1,
 'Deciding what you''re allowed to do — read this row? edit that page? delete that user? Answers "is this user allowed to do this?"',
 'Authorization (shortened to "authz") is the WHAT part of identity. The user is already logged in (that''s authn); now the system checks "does this user have permission for this action?" Roles, permissions, RLS policies, ACLs, RBAC — all flavors of authz. Supabase''s row-level security is authz in action. Authn says you''re Alice; authz says Alice can''t see other users'' streaks.',
 'The 403 means it''s an authz problem — we''re logged in fine, just not allowed.',
 'When dev family says "that''s a permissions issue" or "the RLS policy is denying it," this is the layer. Knowing the term — and its difference from authn — means you can debug the right side of an auth bug.',
 ARRAY['sys-authn','sys-sso','ent-okta']::text[],
 ARRAY['sys-authn']::text[],
 null,
 ARRAY[
   'Proving the identity of the user logging in',
   'Logging into multiple apps with a single sign-on',
   'Encrypting the connection so credentials can''t be intercepted'
 ]::text[],
 'The 403 means it''s an ___ problem — we''re logged in fine, just not allowed.',
 'Use ''authorization'' in a sentence about deciding what a logged-in user can do.',
 'curated', 'curator', '2026-05-04'),

('sys-sso', 'SSO (single sign-on)', 'S-S-O', 'systems', 1,
 'Log in once with one set of credentials, get into many apps — the "Sign in with Google" or "Sign in with Okta" pattern.',
 'SSO (single sign-on) lets a user authenticate once with a central identity provider (Google, Okta, Microsoft, Auth0) and then access many separate apps without logging in again. The apps trust the identity provider''s say-so. Inside companies, SSO is how you log in once at your computer and then magically have access to email, Slack, Salesforce, Workday, etc. without typing 30 passwords.',
 'Wire this app up to SSO so people don''t have to remember another password.',
 'Most enterprise work apps run on SSO. When dev family says "is it behind SSO?" or "the SSO provider is down," this is the pattern. Knowing the term means you can talk about identity at the org level, not just per-app.',
 ARRAY['sys-authn','sys-authz','ent-okta']::text[],
 ARRAY['sys-authn']::text[],
 'ent-okta',
 ARRAY[
   'A method that requires a separate password for every internal app',
   'A protocol for encrypting traffic between client and server',
   'A standard for caching API responses near the user'
 ]::text[],
 'Wire this app up to ___ so people don''t have to remember another password.',
 'Use ''SSO'' in a sentence about logging into many apps with one set of credentials.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems: API & interaction patterns (3) ───────────────────
('sys-webhook', 'webhook', null, 'systems', 1,
 'A reverse API call — instead of you polling someone for updates, they POST to a URL you give them whenever something happens.',
 'A webhook is "call me when X happens." You give a service (Stripe, GitHub, Slack) a URL on your server. When the event fires (a payment succeeds, a PR opens, a message is sent), they make an HTTP POST to your URL with the event details. Webhooks let you react in real time without constantly asking "anything new yet?" — the other system pushes to you.',
 'Stripe fires a webhook on every successful charge — we update the subscription row when it lands.',
 'When dev family says "set up a webhook" or "the webhook is failing," this is the pattern. Knowing the term means you understand how integrations between SaaS tools actually wire up under the hood.',
 ARRAY['sys-rest','sys-websocket','sys-event-driven']::text[],
 ARRAY['sys-rest']::text[],
 'sys-event-driven',
 ARRAY[
   'A persistent two-way connection between client and server',
   'A way of querying a database with one specific request shape',
   'A scheduled job that runs at a fixed time every day'
 ]::text[],
 'Stripe fires a ___ on every successful charge — we update the subscription row when it lands.',
 'Use ''webhook'' in a sentence about a service POSTing to your URL when an event happens.',
 'curated', 'curator', '2026-05-04'),

('sys-websocket', 'WebSocket', 'web-socket', 'systems', 1,
 'A persistent two-way connection between client and server — both sides can push messages whenever, no need to keep asking.',
 'WebSocket is the protocol behind real-time apps. The browser opens one long-lived connection and either side can push data through it at any time. That''s how chat apps update instantly, how multiplayer games sync state, how a stock ticker streams prices, how Figma shows you another user''s cursor moving. Compared to REST (where the client has to ask each time), WebSocket is a permanent open line.',
 'The chat needs WebSockets — polling every second is killing the server and still feels laggy.',
 'When dev family says "we''re using WebSockets for that" or "the socket dropped," this is the protocol. Knowing the term means you understand the standard way modern apps do real-time updates.',
 ARRAY['sys-rest','sys-webhook','sys-event-driven']::text[],
 ARRAY['sys-rest']::text[],
 null,
 ARRAY[
   'A pattern where one service POSTs to another whenever an event happens',
   'A query language for asking a backend for exactly the fields you need',
   'A globally distributed cache for static files'
 ]::text[],
 'The chat needs ___ — polling every second is killing the server and still feels laggy.',
 'Use ''WebSocket'' in a sentence about a persistent two-way client-server connection.',
 'curated', 'curator', '2026-05-04'),

('sys-graphql', 'GraphQL', 'graph-Q-L', 'systems', 1,
 'An API style where the client asks for exactly the fields it wants in one request — instead of REST''s many fixed endpoints.',
 'GraphQL is the main alternative to REST. Instead of hitting /users/123 and getting back a fixed payload, the client sends a query saying "give me this user''s name, email, and last 3 streaks" and gets back exactly that shape. One endpoint, many possible queries. Pro: no over-fetching, fewer round trips. Con: caching is harder, server complexity goes up. Used heavily at GitHub, Shopify, Facebook (who invented it).',
 'GitHub''s GraphQL API lets us pull issue, PR, and review data in one round trip instead of three.',
 'When dev family says "is that REST or GraphQL?" or "we wrote a GraphQL query for that," this is the alternative. Knowing the term means you can hold the dominant API-style choice in your head when reading docs.',
 ARRAY['sys-rest','sys-api-gateway','sys-webhook']::text[],
 ARRAY['sys-rest']::text[],
 null,
 ARRAY[
   'An API style with fixed URLs for each resource and standard HTTP verbs',
   'A persistent two-way connection used for real-time updates',
   'A scheduling system for running background jobs at fixed times'
 ]::text[],
 'GitHub''s ___ API lets us pull issue, PR, and review data in one round trip instead of three.',
 'Use ''GraphQL'' in a sentence about an API where the client picks exactly which fields to fetch.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems: async / event-driven (3) ─────────────────────────
('sys-event-driven', 'event-driven', null, 'systems', 1,
 'An architecture where services don''t call each other directly — they emit events and other services react if they care.',
 'In an event-driven system, services publish "things that happened" — user.signed_up, order.placed, file.uploaded — to a shared bus. Other services subscribe to whichever events they care about and react. The publisher doesn''t know or care who''s listening. Decouples teams: you can add a new service that reacts to existing events without changing the publisher. Tools: Kafka, AWS EventBridge, NATS, Redis pub/sub.',
 'Move the email send to be event-driven — let the welcome service subscribe to user.signed_up.',
 'When dev family says "let''s make it event-driven" or "we publish an event for that," this is the shape. Knowing the term means you understand the dominant pattern for loosely coupled microservices.',
 ARRAY['sys-pub-sub','sys-queue','sys-microservice']::text[],
 ARRAY['sys-microservice']::text[],
 'sys-pub-sub',
 ARRAY[
   'An architecture where every service calls every other service directly over HTTP',
   'A monolithic codebase where everything runs in one process',
   'A method of caching responses at the network edge'
 ]::text[],
 'Move the email send to be ___ — let the welcome service subscribe to user.signed_up.',
 'Use ''event-driven'' in a sentence about services reacting to published events instead of calling each other directly.',
 'curated', 'curator', '2026-05-04'),

('sys-pub-sub', 'pub/sub (publish-subscribe)', 'pub-sub', 'systems', 1,
 'The mechanism behind event-driven systems — publishers emit messages on a topic, subscribers listen to topics they care about.',
 'Pub/sub (publish-subscribe) is the messaging pattern: a publisher writes a message tagged with a topic ("orders.created"), and any number of subscribers listening on that topic get a copy. Publishers don''t know subscribers exist; subscribers don''t know publishers exist. They only share the topic name. Tools: Redis pub/sub, Google Pub/Sub, Kafka, NATS, AWS SNS.',
 'Drop a pub/sub topic between the two services so we can add more subscribers later.',
 'When dev family says "we''re using pub/sub for that" or "subscribe to the topic," this is the pattern. Knowing the term means you understand the wiring under event-driven architectures.',
 ARRAY['sys-event-driven','sys-queue','sys-queue-worker']::text[],
 ARRAY['sys-event-driven']::text[],
 'sys-queue',
 ARRAY[
   'A pattern where one service directly invokes another via REST',
   'A scheduling system that runs jobs at fixed times each day',
   'A protocol for encrypting traffic between two servers'
 ]::text[],
 'Drop a ___ topic between the two services so we can add more subscribers later.',
 'Use ''pub/sub'' in a sentence about publishers emitting messages and subscribers listening on topics.',
 'curated', 'curator', '2026-05-04'),

('sys-queue-worker', 'queue worker', null, 'systems', 1,
 'A background process that pulls jobs off a queue and does the actual work — the muscle behind any "we''ll process this in the background" feature.',
 'A queue worker is a long-running process that loops: grab next job from the queue, do the work, mark it done, repeat. You typically run a pool of workers in parallel so jobs process fast. Workers are separate from your web servers — the web server drops a job on the queue and returns instantly; workers chew through the queue at their own pace. Tools: Sidekiq, Celery, BullMQ, AWS SQS + Lambda.',
 'Spin up two more queue workers — the backlog hit 10k jobs overnight.',
 'When dev family says "the worker pool is behind" or "we need to scale workers," this is what they mean. Knowing the term means you understand who actually runs all the "do later" work in an app.',
 ARRAY['sys-queue','sys-cron','sys-pub-sub']::text[],
 ARRAY['sys-queue']::text[],
 'sys-cron',
 ARRAY[
   'A web server that handles incoming HTTP requests',
   'A globally distributed cache for static files',
   'A monitoring service that alerts when an endpoint is slow'
 ]::text[],
 'Spin up two more ___ — the backlog hit 10k jobs overnight.',
 'Use ''queue worker'' in a sentence about a background process that pulls jobs off a queue.',
 'curated', 'curator', '2026-05-04'),

('sys-cron', 'cron / scheduler', 'kron', 'systems', 1,
 'A scheduler that runs a job on a fixed time pattern — every minute, every night at 2am, every Monday at noon.',
 'Cron is the original Unix scheduler — you write a "cron expression" (0 2 * * * means "2am every day") and the system fires your script on that schedule. Modern cloud equivalents: GitHub Actions cron, AWS EventBridge schedules, Vercel Cron, Supabase scheduled Edge Functions. Used for nightly reports, cleanup jobs, sending the daily digest email, snapshotting data.',
 'The streak-decay job runs on cron — 4am Eastern, every day.',
 'When dev family says "throw it on cron" or "the cron job failed," this is the scheduler. Knowing the term means you understand how all the silent "happens every night" work in apps actually gets triggered.',
 ARRAY['sys-queue-worker','sys-queue','sys-monitoring']::text[],
 ARRAY['sys-server']::text[],
 null,
 ARRAY[
   'A worker that pulls jobs off a queue as fast as it can',
   'A pub/sub topic that fanouts events to many subscribers',
   'A REST endpoint that returns the current server time'
 ]::text[],
 'The streak-decay job runs on ___ — 4am Eastern, every day.',
 'Use ''cron'' in a sentence about running a job on a fixed time schedule.',
 'curated', 'curator', '2026-05-04'),

-- ─── systems: reliability / operations (3) ─────────────────────
('sys-monitoring', 'monitoring / observability', null, 'systems', 1,
 'Watching what your app is actually doing in production — logs, metrics, traces, alerts. Catches problems before users do.',
 'Monitoring (also called observability) is the layer that tells you whether the app is healthy. Logs say what happened, metrics say how much/how fast, traces say which path a request took through the system, alerts wake you up when thresholds get crossed. Tools: Datadog, Grafana, Sentry, New Relic, CloudWatch. Without monitoring, you find out about outages from angry users.',
 'Check monitoring before you redeploy — if errors spiked, we need to know what changed.',
 'When dev family says "is it in monitoring?" or "Sentry caught it," this is the layer. Knowing the term means you understand how teams know their app is up — and how they catch the bad stuff fast.',
 ARRAY['sys-sla','sys-slo','sys-server']::text[],
 ARRAY['sys-server']::text[],
 'sys-slo',
 ARRAY[
   'A pattern for caching responses at the network edge',
   'A queue holding background jobs waiting to be processed',
   'A protocol for encrypting traffic between client and server'
 ]::text[],
 'Check ___ before you redeploy — if errors spiked, we need to know what changed.',
 'Use ''monitoring'' in a sentence about watching production health and catching problems fast.',
 'curated', 'curator', '2026-05-04'),

('sys-sla', 'SLA (service-level agreement)', 'S-L-A', 'systems', 1,
 'A contract promise about reliability — "we guarantee 99.9% uptime, or you get a refund." The legal side of "the service works."',
 'An SLA (service-level agreement) is the customer-facing promise: a vendor commits to a specific uptime, response time, or quality bar in writing, and ties money to it (refunds, credits, penalties) if they miss. AWS SLAs, Stripe SLAs, enterprise SaaS contracts all have these. SLAs face OUTWARD — they''re what the buyer is told. SLOs (next entry) are the team''s INTERNAL targets, set tighter so they don''t breach the SLA.',
 'The vendor''s SLA promises 99.9% — they owe us credits for the outage last month.',
 'When dev family says "did we breach SLA?" or "what''s the vendor''s SLA?" this is the contract. Knowing the term means you can follow reliability conversations and understand why some outages cost real money.',
 ARRAY['sys-slo','sys-monitoring','sys-server']::text[],
 ARRAY['sys-monitoring']::text[],
 'sys-slo',
 ARRAY[
   'An internal team target for reliability — usually set tighter than what customers are promised',
   'A scheduled job that runs nightly to back up the database',
   'A queue of customer support tickets waiting for response'
 ]::text[],
 'The vendor''s ___ promises 99.9% — they owe us credits for the outage last month.',
 'Use ''SLA'' in a sentence about a contractual reliability promise to customers.',
 'curated', 'curator', '2026-05-04'),

('sys-slo', 'SLO (service-level objective)', 'S-L-O', 'systems', 1,
 'An internal reliability target — "we aim for 99.95% availability." Set tighter than the SLA so the team has buffer before breaking the customer promise.',
 'An SLO (service-level objective) is the team''s self-imposed target. If the SLA promises 99.9%, the SLO might be 99.95% — that gap is the team''s safety margin. SLOs drive the work: "we''re burning our error budget too fast this quarter, freeze risky deploys." Pair with SLIs (service-level indicators), the actual measurements. SLA is what you tell customers; SLO is how you stay safely above it.',
 'Our SLO for checkout is 99.95% — we''re at 99.92 this month, so freeze the risky launches.',
 'When dev family says "we blew our SLO" or "what''s the SLO on that endpoint?" this is the target. Knowing the term — and its difference from SLA — means you can follow reliability planning conversations.',
 ARRAY['sys-sla','sys-monitoring','sys-server']::text[],
 ARRAY['sys-sla']::text[],
 null,
 ARRAY[
   'The customer-facing reliability promise written into a vendor contract',
   'A monitoring tool that alerts when servers go down',
   'A scheduled job that runs nightly to compress old logs'
 ]::text[],
 'Our ___ for checkout is 99.95% — we''re at 99.92 this month, so freeze the risky launches.',
 'Use ''SLO'' in a sentence about an internal reliability target the team aims for.',
 'curated', 'curator', '2026-05-04')

on conflict (id) do nothing;
