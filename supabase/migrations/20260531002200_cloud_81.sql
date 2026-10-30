-- jargon Stage B+1.41 - OS/security completion literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 7 final atlas concepts for operating-system and security basics:
-- paths, OS permissions, memory, heaps, garbage collection, schedulers,
-- and SSO.
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

('os-path', 'path', null, 'systems', 'coding', 1,
 'The text address that tells the OS where a file or folder lives.',
 'A path points to a location in the filesystem. It can be absolute, starting from the root of the machine, or relative, starting from the current working folder. Paths explain why the same command can work in one folder and fail in another.',
 'The script failed because the path pointed at the old build folder.',
 'Path is the file-location word. It helps you understand terminal commands, missing files, imports, generated assets, and why changing directories changes what a command can see.',
 ARRAY['os-filesystem','os-shell','dev-build-artifact','flow-localhost']::text[],
 ARRAY['os-filesystem']::text[],
 'os-permission',
 ARRAY[
   'A browser URL route handled by React',
   'A database field that uniquely identifies a row',
   'A model output forced into JSON'
 ]::text[],
 'The script failed because the ___ pointed at the old build folder.',
 'Use ''path'' in a sentence about where a file or folder lives.',
 'curated', 'curator', '2026-05-26'),

('os-permission', 'OS permission', null, 'systems', 'coding', 1,
 'An operating-system rule that decides who can read, write, or execute a file or resource.',
 'OS permissions are access rules enforced by the operating system. A file might be readable but not writable, a script might need execute permission, and a process might be blocked from writing outside an allowed folder. These permissions are lower-level than app roles or product settings.',
 'The deploy script existed, but the OS permission did not let it execute.',
 'OS permission is the local-machine access word. It helps you separate "the app says no" from "the operating system blocked the file or process."',
 ARRAY['os-path','os-filesystem','sec-permission','os-process']::text[],
 ARRAY['os-filesystem']::text[],
 'sec-permission',
 ARRAY[
   'A role bundle inside an admin dashboard',
   'A DNS record that points a domain name',
   'A test that checks a user journey'
 ]::text[],
 'The deploy script existed, but the ___ did not let it execute.',
 'Use ''OS permission'' in a sentence about file or process access on a machine.',
 'curated', 'curator', '2026-05-26'),

('os-memory', 'memory', null, 'systems', 'coding', 1,
 'The working space a running program uses while it is active.',
 'Memory is the fast working space a process uses for code, data, stacks, heaps, caches, and temporary values. RAM is the hardware that provides much of that space; OS memory management decides how running programs get it and what happens when they use too much.',
 'The browser tab used too much memory and the OS killed the process.',
 'Memory is the resource behind slow machines, crashed dev servers, and performance bugs. It helps you hear when a problem is about working space, not storage.',
 ARRAY['hw-ram','os-process','os-heap','os-kernel']::text[],
 ARRAY['hw-ram','os-process']::text[],
 'os-heap',
 ARRAY[
   'A permanent file saved on an SSD',
   'A request header sent by a browser',
   'A role used for authorization'
 ]::text[],
 'The browser tab used too much ___ and the OS killed the process.',
 'Use ''memory'' in a sentence about the working space a running program uses.',
 'curated', 'curator', '2026-05-26'),

('os-heap', 'heap', null, 'systems', 'coding', 2,
 'The part of process memory used for data created while a program runs.',
 'The heap is a region of memory where a program stores dynamically created objects and values that need to live beyond one function call. Languages manage heap memory differently: some require manual freeing, while others use garbage collection.',
 'The image editor crashed after large previews filled the heap.',
 'Heap is the memory-allocation word that shows up in performance reports and crash logs. It helps you understand why "used too much memory" can have a specific shape.',
 ARRAY['os-memory','os-garbage-collection','code-object','os-process']::text[],
 ARRAY['os-memory']::text[],
 'os-garbage-collection',
 ARRAY[
   'The OS choice of which thread gets CPU time next',
   'The file address used by the shell',
   'A login flow shared across many apps'
 ]::text[],
 'The image editor crashed after large previews filled the ___.',
 'Use ''heap'' in a sentence about dynamically allocated process memory.',
 'curated', 'curator', '2026-05-26'),

('os-garbage-collection', 'garbage collection', null, 'systems', 'coding', 2,
 'Runtime cleanup that frees heap memory no longer reachable by the program.',
 'Garbage collection is automatic memory cleanup. The runtime tracks which objects can still be reached by the program, then frees heap memory that is no longer reachable. It reduces manual memory bugs, but collection pauses and memory pressure can still affect performance.',
 'The app stuttered when garbage collection paused to clean up unused objects.',
 'Garbage collection explains why some languages feel easier to write but still need memory awareness. It helps you follow performance conversations without jumping straight to hardware.',
 ARRAY['os-heap','os-memory','code-object','dev-performance']::text[],
 ARRAY['os-heap']::text[],
 'os-memory',
 ARRAY[
   'A process waiting on a lock forever',
   'A file path from the project root',
   'A cloud service that runs without a server'
 ]::text[],
 'The app stuttered when ___ paused to clean up unused objects.',
 'Use ''garbage collection'' in a sentence about automatic memory cleanup.',
 'curated', 'curator', '2026-05-26'),

('os-scheduler', 'scheduler', null, 'systems', 'coding', 2,
 'The OS component that decides which process or thread gets CPU time next.',
 'The scheduler is the operating-system traffic controller for CPU time. Many processes and threads want to run, but CPU cores are limited. The scheduler pauses and resumes work so the machine can feel like it is doing many things at once.',
 'The scheduler gave the test runner CPU time while the browser waited on network I/O.',
 'Scheduler is the fairness-and-time-sharing word. It helps you understand why background work, CPU spikes, and responsiveness are OS concerns, not only app-code concerns.',
 ARRAY['os-kernel','os-process','os-thread','hw-cpu']::text[],
 ARRAY['os-kernel','os-process','os-thread']::text[],
 'os-deadlock',
 ARRAY[
   'A database operation that combines two tables',
   'A browser value sent with every request',
   'A prompt pattern that retrieves documents'
 ]::text[],
 'The ___ gave the test runner CPU time while the browser waited on network I/O.',
 'Use ''scheduler'' in a sentence about the OS deciding what runs next.',
 'curated', 'curator', '2026-05-26'),

('sec-sso', 'SSO', 'S-S-O', 'systems', 'coding', 2,
 'Single sign-on, where one trusted identity provider lets users access many apps.',
 'SSO stands for single sign-on. With SSO, a user signs in through a trusted identity provider, and multiple apps rely on that provider instead of each app managing a separate password. SSO often sits beside OAuth, SAML, MFA, roles, and audit logs.',
 'The company used SSO so employees could access the dashboard with their work identity.',
 'SSO is the enterprise-login word. It helps you understand why Google, Okta, Microsoft Entra, and company identity systems show up in app access conversations.',
 ARRAY['sec-oauth','sec-mfa','sec-role','prod-sso']::text[],
 ARRAY['sec-oauth']::text[],
 'prod-sso',
 ARRAY[
   'A file permission controlled by the OS',
   'A cleanup pass for unused heap objects',
   'A cache near the CPU'
 ]::text[],
 'The company used ___ so employees could access the dashboard with their work identity.',
 'Use ''SSO'' in a sentence about one identity provider signing users into many apps.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;

update terms
set pronunciation = 'S-S-O'
where id = 'sec-sso'
  and pronunciation is distinct from 'S-S-O';
