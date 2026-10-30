-- jargon Stage B+1.31 - cloud/devops foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for practical cloud and operations literacy:
-- deploys, environments, containers, images, Kubernetes, serverless, edge
-- runtimes, CDN, cache, load balancers, autoscaling, observability, logs,
-- metrics, and alerts.
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

('cloud-deploy', 'deploy', null, 'systems', 'coding', 1,
 'Putting a version of software into an environment where it can run.',
 'A deploy takes code that has been built and puts it somewhere runnable: preview, staging, production, an edge function, a server, or a container service. A deploy is not just saving files; it changes which version a real runtime can execute.',
 'The team waited for the preview deploy before doing visual QA.',
 'Deploy is the basic shipping verb. It helps you separate writing code from getting that code onto a live or reviewable runtime.',
 ARRAY['flow-build','flow-artifact','cloud-environment','flow-ci']::text[],
 ARRAY['flow-build','flow-commit']::text[],
 'cloud-environment',
 ARRAY[
   'A database column that stores one value',
   'A model score used during training',
   'A browser setting for third-party cookies'
 ]::text[],
 'The team waited for the preview ___ before doing visual QA.',
 'Use ''deploy'' in a sentence about putting a version of software into a runtime.',
 'curated', 'curator', '2026-05-26'),

('cloud-environment', 'environment', null, 'systems', 'coding', 1,
 'A separate runtime such as local, preview, staging, or production.',
 'An environment is one place where the app runs with its own URL, configuration, database, secrets, and safety expectations. Local is for development, preview is for review, staging is production-like testing, and production is what real users see.',
 'The bug only happened in the preview environment because the production secret was not available there.',
 'Environment is the word that prevents "it works for me" from sounding mystical. It helps you ask which runtime, which data, and which configuration are being discussed.',
 ARRAY['cloud-deploy','os-environment-variable','sec-secret','flow-localhost']::text[],
 ARRAY['cloud-deploy','os-environment-variable']::text[],
 'cloud-serverless',
 ARRAY[
   'A single code commit in Git history',
   'A type rule for a function argument',
   'A text token read by a language model'
 ]::text[],
 'The bug only happened in the preview ___ because the production secret was not available there.',
 'Use ''environment'' in a sentence about local, preview, staging, or production runtimes.',
 'curated', 'curator', '2026-05-26'),

('cloud-container', 'container', null, 'systems', 'coding', 2,
 'A packaged runtime with app code and its dependencies isolated together.',
 'A container bundles an application with the files, libraries, and runtime it needs so it can run consistently on different machines. Containers are usually built from images and run as isolated processes with controlled access to the host.',
 'The API ran in a container so the same build worked on laptops and in the cloud.',
 'Container is the packaging word behind Docker and much of modern deployment. It helps you understand why teams ship a runtime shape, not just source code.',
 ARRAY['cloud-image','cloud-kubernetes','os-process','cloud-deploy']::text[],
 ARRAY['os-process','flow-build']::text[],
 'cloud-image',
 ARRAY[
   'A database query that combines tables',
   'A browser cookie sent with requests',
   'A metric threshold that sends a notification'
 ]::text[],
 'The API ran in a ___ so the same build worked on laptops and in the cloud.',
 'Use ''container'' in a sentence about packaging code with its runtime dependencies.',
 'curated', 'curator', '2026-05-26'),

('cloud-image', 'image', null, 'systems', 'coding', 2,
 'The template used to start a container.',
 'A container image is an immutable template containing the application, runtime, libraries, and startup instructions. Running containers are created from images. If the image changes, the next deploy starts a new container from the new template.',
 'The deploy built a new image before starting fresh containers.',
 'Image is the object teams pass around in container workflows. It helps you hear the difference between the template and the running container created from it.',
 ARRAY['cloud-container','flow-artifact','cloud-deploy']::text[],
 ARRAY['cloud-container']::text[],
 'cloud-kubernetes',
 ARRAY[
   'A PNG loaded by a web page',
   'A row-level database policy',
   'A sampling setting for a model'
 ]::text[],
 'The deploy built a new ___ before starting fresh containers.',
 'Use ''image'' in a sentence about the template used to start a container.',
 'curated', 'curator', '2026-05-26'),

('cloud-kubernetes', 'Kubernetes', null, 'systems', 'coding', 3,
 'A system for running and coordinating containers across machines.',
 'Kubernetes manages containers across a cluster of machines. It schedules work, restarts failed containers, rolls out new versions, exposes services, and keeps desired state aligned with actual state. It is powerful, but it adds operational complexity.',
 'Kubernetes restarted the failed container and kept the API available.',
 'Kubernetes is a major infrastructure word. It helps you understand why container operations can sound like their own discipline instead of a simple upload step.',
 ARRAY['cloud-container','cloud-image','cloud-load-balancer','cloud-autoscaling']::text[],
 ARRAY['cloud-container','cloud-image']::text[],
 'cloud-autoscaling',
 ARRAY[
   'A JavaScript test runner',
   'A database migration format',
   'A browser security header'
 ]::text[],
 '___ restarted the failed container and kept the API available.',
 'Use ''Kubernetes'' in a sentence about coordinating containers across machines.',
 'curated', 'curator', '2026-05-26'),

('cloud-serverless', 'serverless', null, 'systems', 'coding', 2,
 'Running code on demand without managing long-lived servers directly.',
 'Serverless does not mean there are no servers. It means the cloud provider manages the servers and starts your code when events or requests arrive. Functions, edge handlers, and scheduled jobs often use this model.',
 'The image resize job moved to a serverless function because it only runs when uploads arrive.',
 'Serverless is the hidden-server word. It helps you understand how code can run without the team managing a traditional always-on server.',
 ARRAY['cloud-edge','cloud-deploy','sys-http-request','cloud-environment']::text[],
 ARRAY['cloud-deploy','sys-http-request']::text[],
 'cloud-edge',
 ARRAY[
   'A monolith split into many services',
   'A database index for faster lookups',
   'A GPU used for model inference'
 ]::text[],
 'The image resize job moved to a ___ function because it only runs when uploads arrive.',
 'Use ''serverless'' in a sentence about code that runs on demand without managing a server.',
 'curated', 'curator', '2026-05-26'),

('cloud-edge', 'edge runtime', null, 'systems', 'coding', 2,
 'Code running geographically closer to users.',
 'An edge runtime runs code at locations closer to the user instead of sending every request to one far-away region. Edge code can reduce latency for lightweight work, but it often has stricter runtime limits than a full server environment.',
 'The redirect logic moved to the edge runtime so users did not wait on the main region.',
 'Edge runtime is the near-the-user word. It helps you understand why some code paths are fast but limited compared with a normal backend server.',
 ARRAY['cloud-cdn','net-latency','cloud-serverless','sys-http-request']::text[],
 ARRAY['net-latency','cloud-serverless']::text[],
 'cloud-cdn',
 ARRAY[
   'A local database cursor',
   'A typed object field',
   'A model validation split'
 ]::text[],
 'The redirect logic moved to the ___ so users did not wait on the main region.',
 'Use ''edge runtime'' in a sentence about running code closer to users.',
 'curated', 'curator', '2026-05-26'),

('cloud-cdn', 'CDN', 'C-D-N', 'systems', 'coding', 1,
 'Content delivery network: a network that caches assets near users.',
 'CDN stands for content delivery network. A CDN stores copies of static assets such as images, JavaScript, CSS, downloads, and sometimes cached responses in many geographic locations. Users fetch from a nearby edge location instead of the origin server every time.',
 'The product screenshots loaded faster after the site served them through a CDN.',
 'CDN is one of the most common performance words. It helps you connect speed, caching, geography, and why a file may not update instantly everywhere.',
 ARRAY['cloud-cache','cloud-edge','net-latency','net-bandwidth']::text[],
 ARRAY['net-latency','sys-http-request']::text[],
 'cloud-cache',
 ARRAY[
   'A database key that links two tables',
   'A container template for starting a service',
   'A model trained for classification'
 ]::text[],
 'The product screenshots loaded faster after the site served them through a ___.',
 'Use ''CDN'' in a sentence about serving cached assets near users.',
 'curated', 'curator', '2026-05-26'),

('cloud-cache', 'cache', null, 'systems', 'coding', 1,
 'Stored results reused to avoid doing the same work again.',
 'A cache keeps a copy of something expensive to compute or fetch so the next request can be faster. Caches can live in the browser, CDN, server memory, database layer, or a service such as Redis. The hard part is invalidation: knowing when the cached answer is stale.',
 'The dashboard used a cache so it did not recompute every chart on every refresh.',
 'Cache explains many speed wins and stale-data bugs. It helps you ask whether the app is reading truth or a saved copy of truth.',
 ARRAY['sys-cache-invalidation','cloud-cdn','arch-eventual-consistency','net-latency']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-cache-invalidation',
 ARRAY[
   'A permanent database schema change',
   'A pull request review state',
   'A CPU instruction family'
 ]::text[],
 'The dashboard used a ___ so it did not recompute every chart on every refresh.',
 'Use ''cache'' in a sentence about reusing stored results for speed.',
 'curated', 'curator', '2026-05-26'),

('cloud-load-balancer', 'load balancer', null, 'systems', 'coding', 2,
 'A traffic router that spreads requests across healthy servers.',
 'A load balancer receives incoming traffic and sends each request to one of several healthy backends. It can use health checks, routing rules, and capacity signals so one server is not overloaded and failed servers stop receiving traffic.',
 'The load balancer stopped sending requests to the unhealthy instance.',
 'Load balancer is the traffic-control word. It helps you understand how one URL can sit in front of many servers.',
 ARRAY['cloud-autoscaling','cloud-kubernetes','net-router','cloud-observability']::text[],
 ARRAY['net-router','cloud-environment']::text[],
 'cloud-autoscaling',
 ARRAY[
   'A database table that stores audit rows',
   'A browser rule for cross-origin requests',
   'A function argument with a default value'
 ]::text[],
 'The ___ stopped sending requests to the unhealthy instance.',
 'Use ''load balancer'' in a sentence about spreading traffic across healthy servers.',
 'curated', 'curator', '2026-05-26'),

('cloud-autoscaling', 'autoscaling', null, 'systems', 'coding', 2,
 'Adding or removing compute capacity based on demand.',
 'Autoscaling changes the number of running instances, containers, or workers when demand changes. It usually reacts to metrics such as CPU, memory, queue depth, or request volume. It helps absorb spikes without permanently paying for peak capacity.',
 'Autoscaling added workers when the queue started backing up.',
 'Autoscaling is the capacity word. It helps you connect traffic spikes, cost, latency, and why systems sometimes need time to warm up.',
 ARRAY['cloud-metric','cloud-load-balancer','cloud-kubernetes','net-throughput']::text[],
 ARRAY['cloud-metric','cloud-container']::text[],
 'cloud-metric',
 ARRAY[
   'A type checker fixing invalid code',
   'A database join across two tables',
   'A manual code review comment'
 ]::text[],
 '___ added workers when the queue started backing up.',
 'Use ''autoscaling'' in a sentence about adding or removing runtime capacity.',
 'curated', 'curator', '2026-05-26'),

('cloud-observability', 'observability', null, 'systems', 'coding', 2,
 'The ability to understand system health from logs, metrics, and traces.',
 'Observability is how teams understand what a system is doing from the outside. Logs show events, metrics show numbers over time, traces show request paths, and dashboards or alerts help operators see failures before users report them.',
 'The incident was easier to diagnose after the team added observability around the checkout flow.',
 'Observability is the "can we see what happened?" word. It helps you understand why teams add logs and metrics before they feel strictly necessary.',
 ARRAY['cloud-log','cloud-metric','cloud-alert','qa-mttr']::text[],
 ARRAY['cloud-log','cloud-metric']::text[],
 'cloud-alert',
 ARRAY[
   'A browser storage value',
   'A database normalization rule',
   'A model prompt style'
 ]::text[],
 'The incident was easier to diagnose after the team added ___ around the checkout flow.',
 'Use ''observability'' in a sentence about understanding system behavior from evidence.',
 'curated', 'curator', '2026-05-26'),

('cloud-log', 'log', null, 'systems', 'coding', 1,
 'A recorded event or message emitted by software.',
 'A log is a timestamped record that software writes while running: request received, job started, payment failed, retry scheduled, user authenticated. Logs are useful when they include enough context to explain what happened without exposing secrets.',
 'The error log showed the webhook payload was missing a required field.',
 'Log is the first evidence word in debugging. It helps you ask what the system recorded instead of guessing from the UI alone.',
 ARRAY['cloud-observability','cloud-alert','qa-root-cause','sys-http-request']::text[],
 ARRAY['cloud-observability']::text[],
 'cloud-metric',
 ARRAY[
   'A database table relationship',
   'A generated build artifact',
   'A GPU memory limit'
 ]::text[],
 'The error ___ showed the webhook payload was missing a required field.',
 'Use ''log'' in a sentence about a recorded event from running software.',
 'curated', 'curator', '2026-05-26'),

('cloud-metric', 'metric', null, 'systems', 'coding', 1,
 'A numeric measurement tracked over time.',
 'A metric is a number collected repeatedly so teams can see trends, thresholds, and changes. Common metrics include request rate, error rate, latency, CPU, memory, queue depth, and sign-up conversions.',
 'The latency metric jumped after the deploy.',
 'Metric is the measurement word. It helps you separate one anecdote from a tracked signal across time.',
 ARRAY['cloud-observability','cloud-alert','net-latency','prod-kpi']::text[],
 ARRAY['cloud-observability']::text[],
 'cloud-alert',
 ARRAY[
   'A source file imported by code',
   'A browser redirect URL',
   'A database migration comment'
 ]::text[],
 'The latency ___ jumped after the deploy.',
 'Use ''metric'' in a sentence about a number tracked over time.',
 'curated', 'curator', '2026-05-26'),

('cloud-alert', 'alert', null, 'systems', 'coding', 1,
 'A notification that a threshold or failure condition happened.',
 'An alert is a notification sent when a system crosses a threshold or detects a failure condition. Good alerts point to something actionable. Bad alerts create noise and teach people to ignore them.',
 'The alert fired when the checkout error rate stayed above five percent for ten minutes.',
 'Alert is the "wake someone up" word. It helps you distinguish a dashboard someone checks from a signal that demands action.',
 ARRAY['cloud-metric','cloud-observability','qa-mttr','qa-postmortem']::text[],
 ARRAY['cloud-metric','cloud-observability']::text[],
 'qa-postmortem',
 ARRAY[
   'A CSS rule applied on hover',
   'A database row identity',
   'A prompt example inside context'
 ]::text[],
 'The ___ fired when the checkout error rate stayed above five percent for ten minutes.',
 'Use ''alert'' in a sentence about a notification triggered by a failure signal.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
