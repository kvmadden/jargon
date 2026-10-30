-- jargon Stage B+1.23 - web request literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 16 coding-domain terms that explain the browser/server boundary:
-- HTTP requests and responses, methods, headers, payloads, JSON, routes,
-- middleware, cookies, sessions, JWTs, CORS, redirects, and origins.
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

('sys-http-request', 'HTTP request', 'H-T-T-P request', 'systems', 'coding', 1,
 'A message a client sends to a server asking for something.',
 'An HTTP request is the browser or app saying "please do this" to a server. It has a method, URL, headers, and sometimes a body. Loading a page, submitting a form, checking an allowlist, and calling an Edge Function are all request moments.',
 'The browser sends an HTTP request to the allowlist function before showing the signed-in app.',
 'Request is the first half of almost every web debug story. If you can name the request, you can ask what URL it hit, what it sent, and what came back.',
 ARRAY['sys-http-response','sys-http-method','sys-http-header','dev-client']::text[],
 ARRAY['dev-client','dev-server']::text[],
 'sys-payload',
 ARRAY[
   'A database row written after login',
   'A generated build file served by Vercel',
   'A GitHub branch waiting for review'
 ]::text[],
 'The browser sends an ___ to the allowlist function before showing the signed-in app.',
 'Use ''HTTP request'' in a sentence about a browser asking a server for something.',
 'curated', 'curator', '2026-05-25'),

('sys-http-response', 'HTTP response', 'H-T-T-P response', 'systems', 'coding', 1,
 'The message a server sends back after it receives a request.',
 'An HTTP response is the server answering the request. It includes a status code, headers, and often a body: HTML, JSON, an image, or an error message. When the frontend says "the API returned 401," it is talking about the response.',
 'The Edge Function returned an HTTP response with a 403 status code and a JSON body.',
 'Response is where the server tells the truth about what happened. It might say yes, no, not found, not allowed, or try again later.',
 ARRAY['sys-http-request','sys-status-code','sys-http-header','sys-json']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-status-code',
 ARRAY[
   'A client-side state update after a click',
   'A route name inside React Router',
   'A dependency installed by npm'
 ]::text[],
 'The Edge Function returned an ___ with a 403 status code and a JSON body.',
 'Use ''HTTP response'' in a sentence about what a server sends back.',
 'curated', 'curator', '2026-05-25'),

('sys-status-code', 'status code', null, 'systems', 'coding', 1,
 'A number in an HTTP response that summarizes what happened.',
 'A status code is the quick numeric verdict in an HTTP response. 200 means success, 301 or 302 means redirect, 400 means the request was bad, 401 means not signed in, 403 means not allowed, 404 means not found, and 500 means the server broke. The body explains more, but the code gives the first read.',
 'The page looked fine, but the API call had a 403 status code, so the user was not allowed.',
 'Status codes turn vague "it failed" reports into a direction. 401 and 403 are different problems.',
 ARRAY['sys-http-response','sys-redirect','sys-authn','sys-authz']::text[],
 ARRAY['sys-http-response']::text[],
 'sys-http-header',
 ARRAY[
   'A package version in a lockfile',
   'A CSS rule that controls spacing',
   'A field inside a React component'
 ]::text[],
 'The page looked fine, but the API call had a 403 ___, so the user was not allowed.',
 'Use ''status code'' in a sentence about reading an HTTP result.',
 'curated', 'curator', '2026-05-25'),

('sys-http-method', 'HTTP method', 'H-T-T-P method', 'systems', 'coding', 1,
 'The verb of an HTTP request, like GET, POST, PUT, PATCH, or DELETE.',
 'An HTTP method tells the server what kind of action the request wants. GET usually reads data. POST creates or submits something. PUT and PATCH update. DELETE removes. Good APIs use methods so the same endpoint can be understood by its action, not just its URL.',
 'Use POST for the gift invite request because it sends data and creates work on the server.',
 'Methods help you read API code without guessing. GET and POST are not decorative words; they change what the server is supposed to do.',
 ARRAY['sys-http-request','dev-endpoint','sys-idempotent']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-idempotent',
 ARRAY[
   'The numeric result of a server response',
   'A cookie stored by the browser',
   'A branch name used for a preview'
 ]::text[],
 'Use ___ for the gift invite request because it sends data and creates work on the server.',
 'Use ''HTTP method'' in a sentence about GET or POST on an API request.',
 'curated', 'curator', '2026-05-25'),

('sys-http-header', 'HTTP header', 'H-T-T-P header', 'systems', 'coding', 1,
 'Metadata attached to a request or response.',
 'An HTTP header is extra information sent alongside the main request or response body. Headers can say what format the client accepts, which origin made the request, what auth token is present, whether a response can be cached, or what cookie should be set.',
 'The request header includes the bearer token, so the Edge Function can identify the user.',
 'Headers are where invisible web behavior lives: auth, caching, CORS, content type, and cookies all depend on them.',
 ARRAY['sys-http-request','sys-http-response','sys-jwt','sys-cors']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-cors',
 ARRAY[
   'A visible title at the top of a page',
   'A React hook that stores state',
   'A generated screenshot for QA'
 ]::text[],
 'The request ___ includes the bearer token, so the Edge Function can identify the user.',
 'Use ''HTTP header'' in a sentence about metadata sent with a web request.',
 'curated', 'curator', '2026-05-25'),

('sys-payload', 'payload', null, 'systems', 'coding', 1,
 'The main data carried inside a request, response, event, or token.',
 'A payload is the useful contents being transported. In an API request it might be a JSON object. In a webhook it is the event data. In a JWT it is the claims. The envelope is how the data travels; the payload is what the receiver actually needs to read.',
 'The invite payload includes the recipient email and the profile draft.',
 'Payload is a wonderfully compact word for "the data inside the thing." It shows up in APIs, webhooks, tokens, queues, and logs.',
 ARRAY['sys-json','sys-http-request','sys-http-response','sys-jwt']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-json',
 ARRAY[
   'The URL where a request is sent',
   'The status number returned by a server',
   'The package folder created by npm'
 ]::text[],
 'The invite ___ includes the recipient email and the profile draft.',
 'Use ''payload'' in a sentence about the data carried by a request or event.',
 'curated', 'curator', '2026-05-25'),

('sys-json', 'JSON', 'jay-sawn', 'systems', 'coding', 1,
 'A text format for structured data that apps and APIs can exchange.',
 'JSON is a simple way to write structured data using objects, arrays, strings, numbers, booleans, and null. Most web APIs send and receive JSON because it is easy for JavaScript to parse and easy enough for humans to read. It is data shape, not prose.',
 'The Edge Function returns JSON with `allowed: true` when the user can enter.',
 'JSON is the default language of web app plumbing. If you recognizes it, API responses stop looking like secret code.',
 ARRAY['sys-payload','sys-http-response','ai-structured-output']::text[],
 ARRAY['sys-payload']::text[],
 'ai-structured-output',
 ARRAY[
   'A style sheet language for visual layout',
   'A database engine for relational queries',
   'A command that installs dependencies'
 ]::text[],
 'The Edge Function returns ___ with `allowed: true` when the user can enter.',
 'Use ''JSON'' in a sentence about structured data sent by an API.',
 'curated', 'curator', '2026-05-25'),

('sys-query-param', 'query parameter', null, 'systems', 'coding', 1,
 'A key-value value added after `?` in a URL.',
 'A query parameter carries small bits of information in the URL after a question mark, like `?type=match` or `?invite=abc`. Multiple params are joined with `&`. They are useful for filters, modes, tracking, and shareable state, but they are visible in the URL and should not hold secrets.',
 'The dev quiz route uses a query parameter to choose which card type to show.',
 'Query params are everywhere in previews and debugging. They explain why adding a tiny suffix to a URL can change the screen.',
 ARRAY['sys-route','dev-endpoint','sys-http-request']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-route',
 ARRAY[
   'A header sent with an auth token',
   'A cookie saved by the browser',
   'A build file produced by Vite'
 ]::text[],
 'The dev quiz route uses a ___ to choose which card type to show.',
 'Use ''query parameter'' in a sentence about a value after `?` in a URL.',
 'curated', 'curator', '2026-05-25'),

('sys-route', 'route', null, 'systems', 'coding', 1,
 'A URL path that an app or server knows how to handle.',
 'A route maps a path like `/home`, `/term/:id`, or `/api/cron/ingest-terms` to code that should run. Frontend routes choose screens. Backend routes choose handlers. If a route is missing, the app may show a 404 even though the server is alive.',
 'The `/spotted` route opens the screen where pasted text gets scanned for terms.',
 'Route is the bridge between a URL and a piece of app behavior. It makes navigation bugs easier to talk about.',
 ARRAY['sys-query-param','dev-endpoint','dev-frontend','dev-backend']::text[],
 ARRAY['dev-frontend','dev-backend']::text[],
 'sys-middleware',
 ARRAY[
   'A dependency version saved by npm',
   'A token claim inside a JWT',
   'A test fixture for fake data'
 ]::text[],
 'The `/spotted` ___ opens the screen where pasted text gets scanned for terms.',
 'Use ''route'' in a sentence about a URL path handled by an app.',
 'curated', 'curator', '2026-05-25'),

('sys-middleware', 'middleware', null, 'systems', 'coding', 2,
 'Code that runs between a request arriving and the final handler responding.',
 'Middleware sits in the middle of the request path. It can check auth, add headers, log a request, rewrite a URL, block traffic, or attach user info before the route handler runs. Middleware is powerful because one small layer can affect many routes.',
 'Middleware checks the session before protected routes render.',
 'When one rule affects every page, middleware is often why. It is where cross-cutting web behavior hides.',
 ARRAY['sys-route','sys-http-request','sys-http-header','sys-session']::text[],
 ARRAY['sys-route','sys-http-request']::text[],
 'sys-cors',
 ARRAY[
   'A component that renders a button',
   'A status code returned by an API',
   'A package version update'
 ]::text[],
 '___ checks the session before protected routes render.',
 'Use ''middleware'' in a sentence about code that runs before route handlers.',
 'curated', 'curator', '2026-05-25'),

('sys-cookie', 'cookie', null, 'systems', 'coding', 1,
 'A small value the browser stores for a site and sends with later requests.',
 'A cookie is a browser-side storage mechanism tied to a site. Servers use cookies to remember sessions, preferences, or tracking IDs. Because cookies are automatically sent back to matching sites, they are useful for login but need careful security settings.',
 'The browser sends the session cookie with the request so the server can recognize the user.',
 'Cookies explain how the browser can stay signed in after a page refresh. They are small, powerful, and often involved in auth bugs.',
 ARRAY['sys-session','sys-http-header','sys-origin','sys-cors']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-session',
 ARRAY[
   'A local folder of installed packages',
   'A database migration file',
   'A generated build artifact'
 ]::text[],
 'The browser sends the session ___ with the request so the server can recognize the user.',
 'Use ''cookie'' in a sentence about browser storage sent with requests.',
 'curated', 'curator', '2026-05-25'),

('sys-session', 'session', null, 'systems', 'coding', 1,
 'The server or app state that remembers a signed-in user across requests.',
 'A session is the ongoing relationship between a user and an app after login. The browser may hold a cookie or token, and the server or auth provider uses it to know who the next request belongs to. Sessions can expire, refresh, or be revoked.',
 'The session exists, so the app can show you the home screen without asking for another magic link.',
 'Session is the clean word for "the app still knows it is me." It sits underneath magic links, OAuth, cookies, and auth redirects.',
 ARRAY['sys-cookie','sys-jwt','sys-authn','sys-authz']::text[],
 ARRAY['sys-authn']::text[],
 'sys-jwt',
 ARRAY[
   'A React prop passed from parent to child',
   'A package version range in semver',
   'A URL path handled by a router'
 ]::text[],
 'The ___ exists, so the app can show you the home screen without asking for another magic link.',
 'Use ''session'' in a sentence about staying signed in across requests.',
 'curated', 'curator', '2026-05-25'),

('sys-jwt', 'JWT', 'J-W-T', 'systems', 'coding', 2,
 'A signed token that carries identity or permission claims.',
 'JWT stands for JSON Web Token. It is a compact signed string with claims inside, often used to prove who a user is when calling an API. The signature lets the server detect tampering. A JWT is not automatically safe just because it is encoded; it still needs correct expiry, storage, and verification.',
 'The Edge Function reads the JWT to find the signed-in user id.',
 'JWTs appear in auth logs, Edge Functions, Supabase docs, and API debugging. Knowing the term makes auth plumbing less mystical.',
 ARRAY['sys-session','sys-http-header','sys-authn','sys-authz']::text[],
 ARRAY['sys-session','sys-json']::text[],
 'sys-rls',
 ARRAY[
   'A redirect from one URL to another',
   'A browser cache entry for an asset',
   'A route parameter in React Router'
 ]::text[],
 'The Edge Function reads the ___ to find the signed-in user id.',
 'Use ''JWT'' in a sentence about a signed auth token.',
 'curated', 'curator', '2026-05-25'),

('sys-cors', 'CORS', 'cores', 'systems', 'coding', 2,
 'Browser security rules that control which origins can call which servers.',
 'CORS stands for Cross-Origin Resource Sharing. Browsers use it to stop a page from one origin from freely reading responses from another origin unless the server allows it. CORS errors often mean the server response is missing the right access-control headers for the site that made the request.',
 'The function works in curl, but the browser blocks it with CORS because the preview origin is not allowed.',
 'CORS is one of the classic "works from a script, fails in the browser" problems. It is not random; the browser is enforcing an origin rule.',
 ARRAY['sys-origin','sys-http-header','sys-http-request','ent-preview-deployment']::text[],
 ARRAY['sys-origin','sys-http-header']::text[],
 'sys-origin',
 ARRAY[
   'A cache rule that keeps stale assets',
   'A JWT claim that stores user identity',
   'A package install folder'
 ]::text[],
 'The function works in curl, but the browser blocks it with ___ because the preview origin is not allowed.',
 'Use ''CORS'' in a sentence about browser cross-origin request rules.',
 'curated', 'curator', '2026-05-25'),

('sys-redirect', 'redirect', null, 'systems', 'coding', 1,
 'Sending a browser or client from one URL to another.',
 'A redirect is a response that tells the client to go somewhere else. Login flows use redirects constantly: leave the app for OAuth, come back to a callback URL, then move to the home route. Redirect bugs can look like loops, blank screens, or landing on the wrong page.',
 'After Google sign-in, Supabase redirects the browser back to the app callback URL.',
 'Redirects are the choreography behind auth. Knowing the word helps you follow why the app leaves one URL and returns to another.',
 ARRAY['sys-status-code','sys-route','sys-origin','sys-session']::text[],
 ARRAY['sys-http-response','sys-route']::text[],
 'sys-cors',
 ARRAY[
   'A payload sent inside a POST body',
   'A local dependency folder',
   'A linter rule for React hooks'
 ]::text[],
 'After Google sign-in, Supabase ___ the browser back to the app callback URL.',
 'Use ''redirect'' in a sentence about sending a browser to another URL.',
 'curated', 'curator', '2026-05-25'),

('sys-origin', 'origin', null, 'systems', 'coding', 2,
 'The scheme, host, and port that define where a web page or request comes from.',
 'In browser security, an origin is the combination of protocol, domain, and port: `https://example.com`, `http://localhost:5173`, and `https://example.com:8443` are different origins. CORS, cookies, and redirect allowlists often depend on origin matching exactly.',
 'The preview origin must be in the allowlist before the browser can call the Edge Function.',
 'Origin is why a URL that looks almost the same can behave differently. One missing port or protocol can break auth, CORS, or cookies.',
 ARRAY['sys-cors','sys-cookie','sys-redirect','ent-preview-deployment']::text[],
 ARRAY['sys-http-request']::text[],
 'sys-cors',
 ARRAY[
   'The default Git remote named origin',
   'A build artifact generated by Vite',
   'A package version range'
 ]::text[],
 'The preview ___ must be in the allowlist before the browser can call the Edge Function.',
 'Use ''origin'' in a sentence about browser security matching protocol, host, and port.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
