-- jargon Stage B+1.38 - web/API foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 coding-domain terms for browser/server application behavior:
-- URLs, domains, routes, requests, responses, status codes, headers,
-- bodies, cookies, sessions, CORS, origins, webhooks, single-page apps,
-- and server-side rendering.
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

('web-url', 'URL', 'U-R-L', 'systems', 'coding', 1,
 'Uniform Resource Locator: the address that tells a browser where to go.',
 'URL stands for Uniform Resource Locator. A URL is the full address for a web resource: protocol, domain, path, and sometimes query parameters or a fragment. In https://example.com/terms?mode=plain, the URL tells the browser exactly which place to request.',
 'Sam pasted the preview URL into Chrome to inspect the latest branch.',
 'URL is the web-address word. It helps you separate the full address from the domain name, route, and query parameters inside it.',
 ARRAY['web-domain','web-route','sys-query-param','net-dns']::text[],
 ARRAY[]::text[],
 'web-domain',
 ARRAY[
   'A browser-stored login value sent with requests',
   'A response number such as 404',
   'A database strategy for running a query'
 ]::text[],
 'Sam pasted the preview ___ into Chrome to inspect the latest branch.',
 'Use ''URL'' in a sentence about a browser address.',
 'curated', 'curator', '2026-05-26'),

('web-domain', 'domain name', null, 'systems', 'coding', 1,
 'The human-readable site name that points to an internet address.',
 'A domain name is the readable name in a URL, such as example.com. DNS translates the domain into an IP address so computers know where to send the request. Domains can point at production sites, preview environments, docs, dashboards, and APIs.',
 'The production domain stayed stable while the preview URL changed for each branch.',
 'Domain name is the site-name word. It helps you understand what stays recognizable even when paths, query strings, and deployment URLs change.',
 ARRAY['web-url','net-dns','net-ip-address','cloud-environment']::text[],
 ARRAY['web-url']::text[],
 'net-dns',
 ARRAY[
   'A value passed into a function call',
   'A generated file from a build',
   'A tree node in a hierarchy'
 ]::text[],
 'The production ___ stayed stable while the preview URL changed for each branch.',
 'Use ''domain name'' in a sentence about the readable name of a site.',
 'curated', 'curator', '2026-05-26'),

('web-route', 'route', null, 'systems', 'coding', 1,
 'The path that maps a URL to a screen or handler.',
 'A route is the part of a web app that decides what should handle a path. /home might render the home screen. /api/invite might run a server handler. Routes are how a URL turns into app behavior.',
 'The /atlas route rendered the concept map without requiring sign-in.',
 'Route is the path-to-behavior word. It helps you understand how one app can have many screens and API handlers under the same domain.',
 ARRAY['web-url','web-request','web-response','sys-middleware']::text[],
 ARRAY['web-url']::text[],
 'web-request',
 ARRAY[
   'A unique row identity in a database',
   'A CPU cache near the processor',
   'A product goal with measurable results'
 ]::text[],
 'The /atlas ___ rendered the concept map without requiring sign-in.',
 'Use ''route'' in a sentence about a URL path mapping to app behavior.',
 'curated', 'curator', '2026-05-26'),

('web-request', 'request', null, 'systems', 'coding', 1,
 'The message a client sends to ask a server for something.',
 'A request is what the browser or app sends when it wants data, a page, an image, a login check, or an action. It usually includes a method, URL, headers, and sometimes a body. The server reads the request and sends a response.',
 'The sign-in screen sent a request to check whether the email was allowlisted.',
 'Request is the ask-the-server word. It helps you understand what starts almost every browser/server interaction.',
 ARRAY['web-response','web-header','web-body','web-route']::text[],
 ARRAY['web-url','web-route']::text[],
 'web-response',
 ARRAY[
   'A stored official business record',
   'A branch replayed onto a new base',
   'A model training example'
 ]::text[],
 'The sign-in screen sent a ___ to check whether the email was allowlisted.',
 'Use ''request'' in a sentence about a browser asking a server for something.',
 'curated', 'curator', '2026-05-26'),

('web-response', 'response', null, 'systems', 'coding', 1,
 'The server answer sent back to a client request.',
 'A response is what the server sends back after reading a request. It includes a status code, headers, and usually a body with HTML, JSON, text, or an error. The browser uses the response to decide what to show or do next.',
 'The API response included the user profile and current mastery totals.',
 'Response is the server-answer word. It helps you understand the second half of every request/response exchange.',
 ARRAY['web-request','web-status-code','web-header','web-body']::text[],
 ARRAY['web-request']::text[],
 'web-status-code',
 ARRAY[
   'A named input a function expects',
   'A set of product work in a backlog',
   'A router forwarding network packets'
 ]::text[],
 'The API ___ included the user profile and current mastery totals.',
 'Use ''response'' in a sentence about what a server sends back.',
 'curated', 'curator', '2026-05-26'),

('web-status-code', 'status code', 'H-T-T-P status code', 'systems', 'coding', 1,
 'The numeric summary of how an HTTP request turned out.',
 'HTTP stands for Hypertext Transfer Protocol. A status code is the number in an HTTP response that summarizes the result. 200 usually means success, 301 or 302 means redirect, 401 means unauthenticated, 403 means forbidden, 404 means not found, and 500 means the server failed.',
 'The preview returned a 404 status code because the route did not exist.',
 'Status code is the compact-result word. It helps you read network panels, deploy logs, and error reports quickly.',
 ARRAY['web-response','web-request','web-route','web-redirect']::text[],
 ARRAY['web-response']::text[],
 'web-header',
 ARRAY[
   'A browser-stored cookie value',
   'A database query plan',
   'A graph connection between nodes'
 ]::text[],
 'The preview returned a 404 ___ because the route did not exist.',
 'Use ''status code'' in a sentence about how an HTTP request turned out.',
 'curated', 'curator', '2026-05-26'),

('web-header', 'header', null, 'systems', 'coding', 1,
 'Metadata sent with a request or response.',
 'A header is extra information attached to a request or response. Headers can carry content type, authorization, cookies, cache rules, origins, accepted formats, and redirect details. They shape how the message should be interpreted without being the main body.',
 'The request header carried the authorization token.',
 'Header is the web-metadata word. It helps you understand where login tokens, content types, cache rules, and CORS details often live.',
 ARRAY['web-request','web-response','web-cookie','web-cors']::text[],
 ARRAY['web-request','web-response']::text[],
 'web-body',
 ARRAY[
   'A function calling itself',
   'A product milestone date',
   'A GPU memory pathway'
 ]::text[],
 'The request ___ carried the authorization token.',
 'Use ''header'' in a sentence about metadata on a web request or response.',
 'curated', 'curator', '2026-05-26'),

('web-body', 'body', null, 'systems', 'coding', 1,
 'The main data payload in a request or response.',
 'The body is the main content of a web message. In a request, it might be form input or JSON. In a response, it might be the page HTML, an error object, or returned data. Headers describe the message; the body carries the main payload.',
 'The request body contained the profile fields from onboarding.',
 'Body is the main-content word. It helps you separate metadata from the actual data being sent.',
 ARRAY['web-request','web-response','web-header','sys-json']::text[],
 ARRAY['web-request']::text[],
 'web-cookie',
 ARRAY[
   'A status number in the response',
   'A named code module',
   'A reliable transport protocol'
 ]::text[],
 'The request ___ contained the profile fields from onboarding.',
 'Use ''body'' in a sentence about the main payload of a web message.',
 'curated', 'curator', '2026-05-26'),

('web-cookie', 'cookie', null, 'systems', 'coding', 1,
 'A small browser-stored value sent with later requests.',
 'A cookie is a small value a site can store in the browser. Cookies can help remember sessions, preferences, experiments, or tracking IDs. Because cookies are automatically sent with matching requests, they matter for login, privacy, and security.',
 'The browser sent a cookie so the server recognized the user''s session.',
 'Cookie is the browser-memory word. It helps you understand why login can survive a page refresh and why privacy tools care about tracking.',
 ARRAY['web-session','web-header','web-origin','sec-authentication']::text[],
 ARRAY['web-request','web-header']::text[],
 'web-session',
 ARRAY[
   'A queue of product work',
   'A database operation that succeeds or fails together',
   'A function input name'
 ]::text[],
 'The browser sent a ___ so the server recognized the user''s session.',
 'Use ''cookie'' in a sentence about browser-stored values sent with requests.',
 'curated', 'curator', '2026-05-26'),

('web-session', 'session', null, 'systems', 'coding', 1,
 'Server-recognized login state for a user over time.',
 'A session lets the server recognize a user across multiple requests instead of treating every page load as brand new. A session might be represented by a cookie, a token, or a server-side record. Sign-in flows usually create sessions.',
 'The session kept you signed in after the magic-link redirect.',
 'Session is the ongoing-login word. It helps you understand how the app remembers who you are without asking you to sign in on every click.',
 ARRAY['web-cookie','sec-authentication','sys-jwt','web-origin']::text[],
 ARRAY['web-cookie','sec-authentication']::text[],
 'web-cors',
 ARRAY[
   'A generated build artifact',
   'A packet forwarded by a router',
   'A graph of connected concepts'
 ]::text[],
 'The ___ kept you signed in after the magic-link redirect.',
 'Use ''session'' in a sentence about keeping a user recognized over time.',
 'curated', 'curator', '2026-05-26'),

('web-cors', 'CORS', 'cores', 'systems', 'coding', 2,
 'Cross-Origin Resource Sharing: browser rules for which origins may call which servers.',
 'CORS stands for Cross-Origin Resource Sharing. CORS is a browser security system that decides whether a page from one origin is allowed to read a response from another origin. Servers opt into cross-origin access with specific headers.',
 'The local app hit a CORS error because the API had not allowed the preview origin.',
 'CORS is the browser-boundary word. It helps you understand why a request can work in a server script but fail from the browser.',
 ARRAY['web-origin','web-header','web-request','sec-attack-surface']::text[],
 ARRAY['web-origin','web-header']::text[],
 'web-origin',
 ARRAY[
   'A customer account system',
   'A branch merge conflict',
   'A model validation split'
 ]::text[],
 'The local app hit a ___ error because the API had not allowed the preview origin.',
 'Use ''CORS'' in a sentence about browser cross-origin access rules.',
 'curated', 'curator', '2026-05-26'),

('web-origin', 'origin', null, 'systems', 'coding', 2,
 'The protocol, host, and port that define a browser security boundary.',
 'An origin is the combination of protocol, host, and port. https://example.com and http://example.com are different origins because the protocol differs. localhost:5173 and localhost:5174 are different origins because the port differs. Browsers use origins for cookies, CORS, storage, and security boundaries.',
 'The preview and production sites had different origins even though they ran the same app.',
 'Origin is the browser-boundary word. It helps you understand why "same app" does not always mean "same security context."',
 ARRAY['web-cors','web-cookie','web-url','flow-port']::text[],
 ARRAY['web-url']::text[],
 'web-cors',
 ARRAY[
   'A unique key for database rows',
   'A reusable block of code',
   'A recovery target after incidents'
 ]::text[],
 'The preview and production sites had different ___s even though they ran the same app.',
 'Use ''origin'' in a sentence about protocol, host, and port as a browser boundary.',
 'curated', 'curator', '2026-05-26'),

('web-webhook', 'webhook', null, 'systems', 'coding', 2,
 'An HTTP callback sent when something happens elsewhere.',
 'A webhook is an event notification sent over HTTP from one system to another. Instead of polling for changes, one app posts to another app when something happens: a payment succeeds, a build finishes, an invite is accepted, or a form is submitted.',
 'The deploy service sent a webhook after the preview build finished.',
 'Webhook is the event-callback word. It helps you understand integrations that push updates automatically instead of waiting to be asked.',
 ARRAY['web-request','web-response','arch-event-driven','cloud-alert']::text[],
 ARRAY['web-request']::text[],
 'arch-event-driven',
 ARRAY[
   'A browser cookie for login state',
   'A page rendered on the server',
   'A true-or-false value'
 ]::text[],
 'The deploy service sent a ___ after the preview build finished.',
 'Use ''webhook'' in a sentence about one system notifying another over HTTP.',
 'curated', 'curator', '2026-05-26'),

('web-spa', 'single-page app', 'S-P-A', 'systems', 'coding', 2,
 'A web app that changes screens without full page reloads.',
 'SPA stands for single-page app. In a SPA, the browser loads the application shell and JavaScript handles navigation between screens. The URL can still change, but the browser often avoids a full document reload for every route.',
 'The lesson app behaves like a single-page app when you moves from home to a term detail screen.',
 'Single-page app is the client-navigation word. It helps you understand why web apps can feel app-like instead of like old page-by-page websites.',
 ARRAY['web-route','web-url','web-ssr','dev-component']::text[],
 ARRAY['web-route','web-url']::text[],
 'web-ssr',
 ARRAY[
   'A customer support metric',
   'A one-way password fingerprint',
   'A query strategy chosen by a database'
 ]::text[],
 'The lesson app behaves like a ___ when you moves from home to a term detail screen.',
 'Use ''single-page app'' in a sentence about browser-side navigation.',
 'curated', 'curator', '2026-05-26'),

('web-ssr', 'server-side rendering', 'S-S-R', 'systems', 'coding', 2,
 'Rendering page HTML on the server before the browser runs JavaScript.',
 'SSR stands for server-side rendering. With SSR, the server prepares HTML for a page before it reaches the browser. This can help first load, previews, search indexing, and sharing links. Client-side JavaScript can still take over afterward.',
 'The marketing page used server-side rendering so the first view appeared quickly.',
 'Server-side rendering is the server-first-page word. It helps you understand why some pages are prepared before the browser app fully wakes up.',
 ARRAY['web-spa','web-response','cloud-edge','dev-hydration']::text[],
 ARRAY['web-response','web-route']::text[],
 'dev-hydration',
 ARRAY[
   'A browser security rule for origins',
   'A transaction that rolls back writes',
   'A recurring background daemon'
 ]::text[],
 'The marketing page used ___ so the first view appeared quickly.',
 'Use ''server-side rendering'' in a sentence about HTML prepared on the server.',
 'curated', 'curator', '2026-05-26')

on conflict (id) do nothing;
