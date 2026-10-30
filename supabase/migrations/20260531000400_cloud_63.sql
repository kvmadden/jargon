-- jargon Stage B+1.24 - data modeling literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 16 coding-domain terms that explain relational data shape,
-- safe writes, and maintenance work: tables, rows, columns, keys, joins,
-- transactions, constraints, nulls, enums, timestamps, pagination, cursors,
-- upserts, seed data, and backfills.
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

('sys-table', 'table', null, 'systems', 'coding', 1,
 'A named collection of related rows in a relational database.',
 'A table is where one kind of database record lives: users, terms, invites, reports, progress rows. Each table has columns that define what fields a row can hold. If the database is the app memory, tables are the labeled drawers inside it.',
 'The terms table stores the vocabulary entries the lesson engine can choose from.',
 'Table is the first noun in most database conversations. Once you can picture the table, rows and columns stop feeling abstract.',
 ARRAY['sys-row','sys-column','sys-schema','sys-database']::text[],
 ARRAY['sys-database','sys-sql']::text[],
 'sys-schema',
 ARRAY[
   'A temporary browser session after login',
   'A generated file created by a build',
   'A package installed by npm'
 ]::text[],
 'The terms ___ stores the vocabulary entries the lesson engine can choose from.',
 'Use ''table'' in a sentence about a named set of related database records.',
 'curated', 'curator', '2026-05-25'),

('sys-row', 'row', null, 'systems', 'coding', 1,
 'One record inside a database table.',
 'A row is a single item in a table. In a users table, one row might be Alice. In a terms table, one row might be "lockfile." Rows are what queries return, policies protect, migrations update, and backfills repair.',
 'The allowlist check reads one row for the signed-in email.',
 'Row is how database talk becomes concrete. Instead of "the database knows," you can ask "which row did it read?"',
 ARRAY['sys-table','sys-column','sys-primary-key','sys-rls']::text[],
 ARRAY['sys-table']::text[],
 'sys-primary-key',
 ARRAY[
   'A field definition shared by every record',
   'A browser cookie sent with requests',
   'A route that opens a React screen'
 ]::text[],
 'The allowlist check reads one ___ for the signed-in email.',
 'Use ''row'' in a sentence about one record in a database table.',
 'curated', 'curator', '2026-05-25'),

('sys-column', 'column', null, 'systems', 'coding', 1,
 'A named field that every row in a table can store.',
 'A column defines one piece of data for rows in a table: email, created_at, user_id, status, term_id. Columns also have types and rules. Adding a column is a schema change, which is why it belongs in a migration.',
 'Add a dismissed_at column so each user can hide the weekly panel once.',
 'Columns are the shape of the data. If a value has nowhere to live, the app needs a column or a different model.',
 ARRAY['sys-table','sys-row','sys-schema','sys-migration']::text[],
 ARRAY['sys-table']::text[],
 'sys-constraint',
 ARRAY[
   'One complete record in a table',
   'A signed token sent with a request',
   'A tool that bundles JavaScript'
 ]::text[],
 'Add a ___ so each user can hide the weekly panel once.',
 'Use ''column'' in a sentence about a field stored on database rows.',
 'curated', 'curator', '2026-05-25'),

('sys-primary-key', 'primary key', null, 'systems', 'coding', 1,
 'The field that uniquely identifies each row in a table.',
 'A primary key is the database row ID. It might be an integer, UUID, email, or a combination of fields. The database uses it to tell one row from every other row and to let other tables point at it reliably.',
 'The terms table uses the term id as the primary key.',
 'Primary keys explain why records need stable identities. Without one, updates and links become guesswork.',
 ARRAY['sys-row','sys-foreign-key','sys-constraint','sys-schema']::text[],
 ARRAY['sys-table','sys-row']::text[],
 'sys-foreign-key',
 ARRAY[
   'A field that stores optional display text',
   'A query filter in a URL',
   'A cache entry for a static asset'
 ]::text[],
 'The terms table uses the term id as the ___.',
 'Use ''primary key'' in a sentence about uniquely identifying a database row.',
 'curated', 'curator', '2026-05-25'),

('sys-foreign-key', 'foreign key', null, 'systems', 'coding', 2,
 'A field that points from one table to a row in another table.',
 'A foreign key is how relational databases connect records. A progress row can hold a user_id that points to the users table and a term_id that points to the terms table. The database can enforce that the referenced row actually exists.',
 'The progress table has a foreign key to the term the user practiced.',
 'Foreign keys are the rails that keep related data from drifting apart. They turn "these rows belong together" into a database rule.',
 ARRAY['sys-primary-key','sys-join','sys-constraint','sys-table']::text[],
 ARRAY['sys-primary-key']::text[],
 'sys-join',
 ARRAY[
   'A unique value that identifies this same row',
   'A browser token used for auth',
   'A migration script that changes a schema'
 ]::text[],
 'The progress table has a ___ to the term the user practiced.',
 'Use ''foreign key'' in a sentence about linking one table to another.',
 'curated', 'curator', '2026-05-25'),

('sys-join', 'join', null, 'systems', 'coding', 2,
 'A query operation that combines related rows from multiple tables.',
 'A join lets a SQL query pull data from more than one table at once. If one table stores progress and another stores terms, a join can return the progress plus the term name in one result. Joins are why relational data can stay normalized without making every screen fetch everything separately.',
 'Join progress to terms so the mastered screen can show the word beside the score.',
 'Join is the word behind "show this record with its related details." It is also where many slow database queries start.',
 ARRAY['sys-foreign-key','sys-sql','sys-index','sys-query-param']::text[],
 ARRAY['sys-sql','sys-foreign-key']::text[],
 'sys-index',
 ARRAY[
   'A command that installs package dependencies',
   'A response header used for CORS',
   'A value stored in a React component'
 ]::text[],
 '___ progress to terms so the mastered screen can show the word beside the score.',
 'Use ''join'' in a sentence about combining related database tables.',
 'curated', 'curator', '2026-05-25'),

('sys-transaction', 'transaction', null, 'systems', 'coding', 2,
 'A group of database operations that succeed or fail together.',
 'A transaction wraps several database steps into one all-or-nothing unit. If every step succeeds, the transaction commits. If one step fails, the database rolls back the whole group. This is how gift accept, profile creation, and audit logs can stay consistent when multiple writes need to happen together.',
 'Wrap the invite accept writes in a transaction so a partial failure does not leave half-created data.',
 'Transactions are the database version of not leaving work half-done. They matter whenever one user action writes to more than one place.',
 ARRAY['sys-rollback','sys-idempotent','sys-upsert','sys-constraint']::text[],
 ARRAY['sys-database','sys-row']::text[],
 'sys-upsert',
 ARRAY[
   'A UI state value that changes on click',
   'A cache rule for browser assets',
   'A package version saved in a lockfile'
 ]::text[],
 'Wrap the invite accept writes in a ___ so a partial failure does not leave half-created data.',
 'Use ''transaction'' in a sentence about database writes that succeed or fail together.',
 'curated', 'curator', '2026-05-25'),

('sys-constraint', 'constraint', null, 'systems', 'coding', 2,
 'A database rule that rejects data that does not fit.',
 'A constraint is a rule the database enforces: a column cannot be null, an email must be unique, a foreign key must point to a real row, or a status must be one of a known set. Constraints catch bad data even when app code misses something.',
 'Add a unique constraint so the same email cannot be allowlisted twice.',
 'Constraints are guardrails at the data layer. They make correctness survive bugs, retries, and multiple clients.',
 ARRAY['sys-column','sys-primary-key','sys-foreign-key','sys-enum']::text[],
 ARRAY['sys-schema','sys-column']::text[],
 'sys-transaction',
 ARRAY[
   'A test fixture used to fake a user',
   'A request header sent by the browser',
   'A screenshot used for visual QA'
 ]::text[],
 'Add a unique ___ so the same email cannot be allowlisted twice.',
 'Use ''constraint'' in a sentence about a database rule that rejects invalid data.',
 'curated', 'curator', '2026-05-25'),

('sys-null', 'null', null, 'systems', 'coding', 1,
 'A database or programming value that means no value is present.',
 'Null is not zero, false, or an empty string. It means the value is missing or not set. A nullable column allows null; a not-null column rejects it. Null bugs happen when code assumes a value exists and then meets nothing.',
 'The profile can leave heritage as null until the user chooses to fill it in.',
 'Null is tiny but important. It is the difference between "none yet" and "the user typed an empty answer."',
 ARRAY['sys-column','sys-constraint','dev-typecheck']::text[],
 ARRAY['sys-column']::text[],
 'sys-constraint',
 ARRAY[
   'A unique identifier for a row',
   'A redirect to another URL',
   'A JSON object returned by an API'
 ]::text[],
 'The profile can leave heritage as ___ until the user chooses to fill it in.',
 'Use ''null'' in a sentence about a missing database value.',
 'curated', 'curator', '2026-05-25'),

('sys-enum', 'enum', 'EE-num', 'systems', 'coding', 2,
 'A field whose value must be one option from a fixed list.',
 'An enum is a controlled list of allowed values. A status might be draft, active, paused, or archived. Enums are useful when free-form text would create drift: "in progress," "In Progress," and "working" all meaning the same thing.',
 'Use an enum for invite status so the app only stores known states.',
 'Enums keep product states legible. They are a quiet way to stop messy vocabulary from becoming messy data.',
 ARRAY['sys-constraint','sys-column','sys-schema']::text[],
 ARRAY['sys-column','sys-constraint']::text[],
 'sys-schema',
 ARRAY[
   'A timestamp for when a row changed',
   'A table link to another row',
   'A browser cookie for login'
 ]::text[],
 'Use an ___ for invite status so the app only stores known states.',
 'Use ''enum'' in a sentence about a field with a fixed list of allowed values.',
 'curated', 'curator', '2026-05-25'),

('sys-timestamp', 'timestamp', null, 'systems', 'coding', 1,
 'A stored date and time for when something happened.',
 'A timestamp records time in a structured way: created_at, updated_at, dismissed_at, accepted_at. Good timestamps make audits, ordering, stale-data checks, and user-facing histories possible. Time zones still matter, but the database needs a precise value first.',
 'The dismissed_at timestamp tells the app when you last closed the weekly panel.',
 'Timestamps are how software remembers when. Without them, debugging becomes folklore.',
 ARRAY['sys-row','sys-column','sys-backfill','sys-pagination']::text[],
 ARRAY['sys-column']::text[],
 'sys-pagination',
 ARRAY[
   'A unique key for one row',
   'A browser security boundary',
   'A tool that formats code'
 ]::text[],
 'The dismissed_at ___ tells the app when you last closed the weekly panel.',
 'Use ''timestamp'' in a sentence about storing when something happened.',
 'curated', 'curator', '2026-05-25'),

('sys-pagination', 'pagination', null, 'systems', 'coding', 2,
 'Splitting a large result set into smaller pages.',
 'Pagination is how an app avoids loading every row at once. Instead of fetching 10,000 records, it asks for the first 50, then the next 50. Pagination can use page numbers, offsets, or cursors. It keeps screens fast and APIs sane.',
 'Add pagination before the mastered list grows too large to load at once.',
 'Pagination is the polite way to handle lots of data. It protects the user, the browser, and the database from one giant fetch.',
 ARRAY['sys-cursor','sys-query-param','sys-index','sys-timestamp']::text[],
 ARRAY['sys-query-param','sys-row']::text[],
 'sys-cursor',
 ARRAY[
   'A database rule that rejects invalid values',
   'A signed token used for auth',
   'A transaction that rolls back writes'
 ]::text[],
 'Add ___ before the mastered list grows too large to load at once.',
 'Use ''pagination'' in a sentence about loading records in smaller chunks.',
 'curated', 'curator', '2026-05-25'),

('sys-cursor', 'cursor', null, 'systems', 'coding', 2,
 'A marker that tells an API where to continue fetching the next page.',
 'A cursor is a bookmark for pagination. Instead of saying "give me page 3," the client says "continue after this last item." Cursor pagination is more stable when new rows are being added while someone is browsing, because it follows the data position rather than a fragile page number.',
 'Use the last seen timestamp as a cursor when loading more spotted matches.',
 'Cursors explain many modern API patterns. They make "load more" reliable when the underlying list keeps changing.',
 ARRAY['sys-pagination','sys-timestamp','sys-query-param']::text[],
 ARRAY['sys-pagination']::text[],
 'sys-index',
 ARRAY[
   'A fixed list of allowed status values',
   'A file that pins dependency versions',
   'A route path handled by React'
 ]::text[],
 'Use the last seen timestamp as a ___ when loading more spotted matches.',
 'Use ''cursor'' in a sentence about continuing a paginated API request.',
 'curated', 'curator', '2026-05-25'),

('sys-upsert', 'upsert', null, 'systems', 'coding', 2,
 'A database write that inserts a row if it does not exist, or updates it if it does.',
 'Upsert is insert plus update. It is useful when code wants one row per user, email, or key and does not know whether that row already exists. Good upserts need clear conflict rules so retries do not create duplicates.',
 'Upsert the profile so a returning user updates the existing row instead of creating another one.',
 'Upsert is one of the main words behind safe repeatable writes. It pairs naturally with idempotency.',
 ARRAY['sys-idempotent','sys-primary-key','sys-transaction','sys-constraint']::text[],
 ARRAY['sys-primary-key','sys-idempotent']::text[],
 'sys-transaction',
 ARRAY[
   'A query that combines tables',
   'A timestamp for when a row changed',
   'A value that means no data is present'
 ]::text[],
 '___ the profile so a returning user updates the existing row instead of creating another one.',
 'Use ''upsert'' in a sentence about insert-or-update database writes.',
 'curated', 'curator', '2026-05-25'),

('sys-seed-data', 'seed data', null, 'systems', 'coding', 1,
 'Starter data loaded into a database so the app has something real to use.',
 'Seed data is the baseline content a database starts with: starter terms, admin users, demo records, default settings. In this repo, the local seed mirrors curated cloud migrations so local resets still have the learning content.',
 'Add the new vocabulary to seed data so local play matches the cloud migration.',
 'Seed data is how an empty database becomes a usable app. It is also how tests avoid depending on whatever happens to be live.',
 ARRAY['sys-migration','dev-fixture','sys-table','sys-backfill']::text[],
 ARRAY['sys-table']::text[],
 'sys-backfill',
 ARRAY[
   'A browser cookie saved after login',
   'A request header sent to an API',
   'A Git commit waiting in a PR'
 ]::text[],
 'Add the new vocabulary to ___ so local play matches the cloud migration.',
 'Use ''seed data'' in a sentence about starter database content.',
 'curated', 'curator', '2026-05-25'),

('sys-backfill', 'backfill', null, 'systems', 'coding', 2,
 'A one-time data update that fills a new field or repairs old records.',
 'A backfill updates existing data after the schema or rules change. If a new column is added, a backfill might compute values for old rows. Backfills should be scoped, reversible when possible, and watched carefully because they touch data that already exists.',
 'Backfill dismissed_at for old rows only after the new column is deployed.',
 'Backfill is the word for bringing yesterday''s data up to today''s shape. It is useful and risky for exactly the same reason.',
 ARRAY['sys-migration','sys-column','sys-timestamp','sys-seed-data']::text[],
 ARRAY['sys-migration','sys-column']::text[],
 'sys-transaction',
 ARRAY[
   'A query that reads one page of results',
   'A browser redirect after OAuth',
   'A component that owns local state'
 ]::text[],
 '___ dismissed_at for old rows only after the new column is deployed.',
 'Use ''backfill'' in a sentence about updating existing rows after a schema change.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
