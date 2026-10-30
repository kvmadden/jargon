-- jargon Stage B+1.39 - data/database foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for app data literacy:
-- tables, rows, columns, primary keys, foreign keys, joins, indexes,
-- query plans, transactions, migrations, backfills, normalization,
-- denormalization, data warehouses, and data lakes.
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

('data-table', 'table', null, 'systems', 'coding', 1,
 'A named collection of related database rows.',
 'A table is where a database stores one kind of record. A terms table stores term records. A profiles table stores user profile records. Tables have columns that describe which fields each row can hold.',
 'The terms table stored each vocabulary entry you could learn.',
 'Table is the database-container word. It helps you understand where app information lives before it becomes cards, screens, or reports.',
 ARRAY['data-row','data-column','data-primary-key','sys-table']::text[],
 ARRAY[]::text[],
 'data-row',
 ARRAY[
   'A browser address for a page',
   'A reusable block of code',
   'A server response number'
 ]::text[],
 'The terms ___ stored each vocabulary entry you could learn.',
 'Use ''table'' in a sentence about where related database records live.',
 'curated', 'curator', '2026-05-26'),

('data-row', 'row', null, 'systems', 'coding', 1,
 'One record inside a database table.',
 'A row is one individual record in a table. In a terms table, one row might be the term "webhook." In a user table, one row might be Alice. Rows hold values for the table''s columns.',
 'One row in the terms table represented the CORS lesson.',
 'Row is the one-record word. It helps you distinguish the table as a collection from a single item inside it.',
 ARRAY['data-table','data-column','data-primary-key','sys-row']::text[],
 ARRAY['data-table']::text[],
 'data-column',
 ARRAY[
   'A cross-origin browser rule',
   'A graph connection between nodes',
   'A generated build file'
 ]::text[],
 'One ___ in the terms table represented the CORS lesson.',
 'Use ''row'' in a sentence about one database record.',
 'curated', 'curator', '2026-05-26'),

('data-column', 'column', null, 'systems', 'coding', 1,
 'A named field that rows in a table can store.',
 'A column defines one field across every row in a table. A terms table might have columns for id, term, definition, difficulty, and pronunciation. Each row supplies values for those columns.',
 'The pronunciation column was empty for terms that are said exactly as written.',
 'Column is the field-name word. It helps you understand database shape: what kinds of values each record is allowed to hold.',
 ARRAY['data-table','data-row','data-primary-key','code-object']::text[],
 ARRAY['data-table','data-row']::text[],
 'data-primary-key',
 ARRAY[
   'A logged-in browser session',
   'A branch line in Git',
   'A model output probability'
 ]::text[],
 'The pronunciation ___ was empty for terms that are said exactly as written.',
 'Use ''column'' in a sentence about a named database field.',
 'curated', 'curator', '2026-05-26'),

('data-primary-key', 'primary key', null, 'systems', 'coding', 1,
 'The unique identity field for a row.',
 'A primary key uniquely identifies each row in a table. It might be a UUID, integer, slug, or stable text ID. Other rows can point at it, and the database uses it to know which record is which.',
 'The term ID was the primary key for each vocabulary row.',
 'Primary key is the row-identity word. It helps you understand how databases avoid confusing one record with another.',
 ARRAY['data-foreign-key','data-row','data-table','sys-primary-key']::text[],
 ARRAY['data-table','data-row']::text[],
 'data-foreign-key',
 ARRAY[
   'The main payload of a web request',
   'A function that calls itself',
   'A product plan over time'
 ]::text[],
 'The term ID was the ___ for each vocabulary row.',
 'Use ''primary key'' in a sentence about a unique row identity.',
 'curated', 'curator', '2026-05-26'),

('data-foreign-key', 'foreign key', null, 'systems', 'coding', 2,
 'A field that points to a row in another table.',
 'A foreign key stores a reference to a row in another table. A user progress row might include user_id pointing at the users table and term_id pointing at the terms table. Foreign keys help databases keep relationships valid.',
 'The progress row used a foreign key to point at the term you reviewed.',
 'Foreign key is the relationship-pointer word. It helps you understand how separate tables connect without copying everything into one place.',
 ARRAY['data-primary-key','data-join','data-row','sys-foreign-key']::text[],
 ARRAY['data-primary-key']::text[],
 'data-join',
 ARRAY[
   'A browser security origin',
   'A true-or-false value',
   'A CPU instruction set'
 ]::text[],
 'The progress row used a ___ to point at the term you reviewed.',
 'Use ''foreign key'' in a sentence about one table pointing to another.',
 'curated', 'curator', '2026-05-26'),

('data-join', 'join', null, 'systems', 'coding', 2,
 'A query operation that combines related tables.',
 'A join lets a query combine rows from multiple tables using a relationship such as a foreign key. If progress rows store only term IDs, a join can pull in the term names and definitions at the same time.',
 'The dashboard used a join to show each mastered term beside the user''s progress score.',
 'Join is the combine-related-tables word. It helps you understand how apps build rich screens from normalized data.',
 ARRAY['data-foreign-key','data-primary-key','data-query-plan','sys-join']::text[],
 ARRAY['data-foreign-key']::text[],
 'data-index',
 ARRAY[
   'A redirect response from a server',
   'A background OS service',
   'A model validation set'
 ]::text[],
 'The dashboard used a ___ to show each mastered term beside the user''s progress score.',
 'Use ''join'' in a sentence about combining related database tables.',
 'curated', 'curator', '2026-05-26'),

('data-index', 'index', null, 'systems', 'coding', 2,
 'A structure that helps a database find rows faster.',
 'An index is like a lookup structure the database maintains so it does not have to scan every row for common queries. Indexes speed reads but add cost to writes because the index must be updated too.',
 'The terms table needed an index on slug so lookup stayed fast.',
 'Index is the faster-lookup word. It helps you understand why performance work often starts with how the database finds rows.',
 ARRAY['data-query-plan','data-table','data-column','sys-index']::text[],
 ARRAY['data-table','data-column']::text[],
 'data-query-plan',
 ARRAY[
   'A user story acceptance condition',
   'A tool call made by an AI agent',
   'A server-side rendered page'
 ]::text[],
 'The terms table needed an ___ on slug so lookup stayed fast.',
 'Use ''index'' in a sentence about speeding up database lookups.',
 'curated', 'curator', '2026-05-26'),

('data-query-plan', 'query plan', null, 'systems', 'coding', 2,
 'The database strategy for running a query.',
 'A query plan is the route a database chooses to answer a query. It decides which indexes to use, which tables to scan, what order to join tables, and how to filter rows. Slow queries are often diagnosed by reading the query plan.',
 'The query plan showed the database scanning every row instead of using the index.',
 'Query plan is the database-strategy word. It helps you understand that databases make execution choices, not just magically answer SQL.',
 ARRAY['data-index','data-join','data-transaction','sys-query-plan']::text[],
 ARRAY['data-index','data-join']::text[],
 'data-transaction',
 ARRAY[
   'A browser cookie for login',
   'A pull request ready for review',
   'A service-level objective'
 ]::text[],
 'The ___ showed the database scanning every row instead of using the index.',
 'Use ''query plan'' in a sentence about how a database runs a query.',
 'curated', 'curator', '2026-05-26'),

('data-transaction', 'transaction', null, 'systems', 'coding', 2,
 'A group of database operations that succeed or fail together.',
 'A transaction wraps multiple database operations so they commit as one unit or roll back as one unit. If accepting an invite needs to update several tables, a transaction prevents the system from doing half the work and leaving inconsistent state.',
 'The invite accept flow used a transaction so profile creation and allowlist update stayed together.',
 'Transaction is the all-or-nothing write word. It helps you understand how systems protect data when several changes belong together.',
 ARRAY['data-migration','data-backfill','prod-audit-log','sys-transaction']::text[],
 ARRAY['data-row','data-table']::text[],
 'data-migration',
 ARRAY[
   'A browser route mapping to a page',
   'An AI answer grounded in documents',
   'A graph hierarchy with a root'
 ]::text[],
 'The invite accept flow used a ___ so profile creation and allowlist update stayed together.',
 'Use ''transaction'' in a sentence about database writes that succeed or fail together.',
 'curated', 'curator', '2026-05-26'),

('data-migration', 'migration', null, 'systems', 'coding', 2,
 'A versioned change to database schema or data.',
 'A migration is a recorded database change applied in order. It might add a table, add a column, create an index, insert seed content, or update existing rows. Migrations make database changes reviewable and repeatable.',
 'The new content pack shipped as a migration so the database could apply it in order.',
 'Migration is the database-change-history word. It helps you understand why database work moves through numbered files instead of loose manual edits.',
 ARRAY['data-backfill','data-transaction','flow-commit','sys-migration']::text[],
 ARRAY['data-table','data-column']::text[],
 'data-backfill',
 ARRAY[
   'A browser response header',
   'A reusable function input',
   'A login session cookie'
 ]::text[],
 'The new content pack shipped as a ___ so the database could apply it in order.',
 'Use ''migration'' in a sentence about a versioned database change.',
 'curated', 'curator', '2026-05-26'),

('data-backfill', 'backfill', null, 'systems', 'coding', 2,
 'A one-time update that fills or repairs existing rows.',
 'A backfill updates data that already exists. If a new column is added, a backfill might populate it for old rows. If old records used inconsistent labels, a backfill might normalize them. Backfills need care because they touch historical data.',
 'The pronunciation backfill filled missing say-it hints for old acronym terms.',
 'Backfill is the repair-old-data word. It helps you understand the difference between changing future behavior and fixing existing records.',
 ARRAY['data-migration','data-transaction','data-column','sys-backfill']::text[],
 ARRAY['data-migration']::text[],
 'data-normalization',
 ARRAY[
   'A request sent after another system event',
   'A CPU cache near the processor',
   'A product milestone checkpoint'
 ]::text[],
 'The pronunciation ___ filled missing say-it hints for old acronym terms.',
 'Use ''backfill'' in a sentence about updating existing database rows.',
 'curated', 'curator', '2026-05-26'),

('data-normalization', 'normalization', null, 'systems', 'coding', 3,
 'Organizing data to reduce duplication and drift.',
 'Normalization means structuring data so each fact has one clear home. Instead of copying customer details into every order row, the database stores customers once and lets orders point to them. Normalization reduces inconsistency but can require more joins.',
 'Normalization kept the term definition in one table instead of copying it into every progress row.',
 'Normalization is the one-source-of-truth word. It helps you understand why databases split related information across tables.',
 ARRAY['data-denormalization','data-foreign-key','data-join','prod-system-of-record']::text[],
 ARRAY['data-foreign-key','data-join']::text[],
 'data-denormalization',
 ARRAY[
   'A rendered page prepared on the server',
   'A model score threshold',
   'A shell command interpreter'
 ]::text[],
 '___ kept the term definition in one table instead of copying it into every progress row.',
 'Use ''normalization'' in a sentence about reducing duplicated database facts.',
 'curated', 'curator', '2026-05-26'),

('data-denormalization', 'denormalization', null, 'systems', 'coding', 3,
 'Duplicating or reshaping data to make reads simpler or faster.',
 'Denormalization intentionally duplicates or precomputes data so reads are easier or faster. A dashboard might store a cached count instead of recomputing it from many rows each time. Denormalization can improve performance, but it creates sync risk.',
 'The analytics dashboard used denormalization to store daily mastery totals.',
 'Denormalization is the speed-vs-drift word. It helps you understand why engineers sometimes duplicate data on purpose while still worrying about keeping it correct.',
 ARRAY['data-normalization','data-warehouse','cloud-cache','data-query-plan']::text[],
 ARRAY['data-normalization']::text[],
 'data-warehouse',
 ARRAY[
   'A named browser route',
   'A code module import',
   'A security role bundle'
 ]::text[],
 'The analytics dashboard used ___ to store daily mastery totals.',
 'Use ''denormalization'' in a sentence about duplicating data for easier reads.',
 'curated', 'curator', '2026-05-26'),

('data-warehouse', 'data warehouse', null, 'systems', 'coding', 3,
 'A database organized for analytics instead of app transactions.',
 'A data warehouse is built for analysis across lots of historical data. Product, finance, marketing, support, and operational data may be copied there so teams can run reports without slowing the production app database.',
 'The company copied event data into a data warehouse for weekly retention reports.',
 'Data warehouse is the analytics-database word. It helps you separate the system that runs the app from the system used to study the business.',
 ARRAY['data-lake','data-denormalization','prod-kpi','cloud-metric']::text[],
 ARRAY['data-table','data-denormalization']::text[],
 'data-lake',
 ARRAY[
   'A browser session token',
   'A packet transport protocol',
   'A function parameter value'
 ]::text[],
 'The company copied event data into a ___ for weekly retention reports.',
 'Use ''data warehouse'' in a sentence about analytics-oriented storage.',
 'curated', 'curator', '2026-05-26'),

('data-lake', 'data lake', null, 'systems', 'coding', 3,
 'Storage for large raw datasets in many shapes.',
 'A data lake stores large amounts of raw or lightly processed data, often files, logs, events, exports, images, or semi-structured records. Warehouses usually organize data for querying; lakes keep more raw material for later processing, ML, or analytics.',
 'The team kept raw product events in a data lake before modeling them for analytics.',
 'Data lake is the raw-data-storage word. It helps you understand why some organizations keep huge messy stores separate from clean reporting tables.',
 ARRAY['data-warehouse','ml-training-data','cloud-storage','data-denormalization']::text[],
 ARRAY['data-warehouse']::text[],
 'ml-training-data',
 ARRAY[
   'A single-page app route',
   'A code exception call path',
   'A customer relationship system'
 ]::text[],
 'The team kept raw product events in a ___ before modeling them for analytics.',
 'Use ''data lake'' in a sentence about raw large-scale data storage.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
