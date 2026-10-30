-- jargon Stage B+1.42 - named technology foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 30 coding-domain terms for named languages, runtimes, frameworks,
-- tools, databases, and hosting surfaces the owner sees in Copilot, docs,
-- stack traces, package files, and agent sessions.
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

('lang-javascript', 'JavaScript', 'JAH-vuh-script', 'dev-concepts', 'coding', 1,
 'The programming language that runs in browsers and many web backends.',
 'JavaScript is the main language of the web. Browsers run it to make pages interactive, and Node.js lets teams run JavaScript on servers and local tools too. React, Vite, npm packages, browser events, and many Copilot examples assume JavaScript is the baseline.',
 'The button click handler was written in JavaScript.',
 'JavaScript is the default language underneath most modern web-app conversations. It helps you recognize when a file is behavior code rather than markup, styles, or data.',
 ARRAY['lang-typescript','runtime-nodejs','fw-react','tool-vite']::text[],
 ARRAY['code-function','code-object']::text[],
 'lang-typescript',
 ARRAY[
   'A styling language for page layout',
   'A database query language',
   'A cloud hosting provider'
 ]::text[],
 'The button click handler was written in ___.',
 'Use ''JavaScript'' in a sentence about code that makes a web page interactive.',
 'curated', 'curator', '2026-05-28'),

('lang-typescript', 'TypeScript', 'TYPE-script', 'dev-concepts', 'coding', 1,
 'JavaScript with a type system added so tools can catch shape mistakes earlier.',
 'TypeScript is a language that builds on JavaScript by adding types: declared shapes for values, functions, objects, and component props. The browser does not run TypeScript directly; build tools turn it into JavaScript. TypeScript helps editors, agents, and CI catch mismatches before runtime.',
 'TypeScript caught that the component expected a string, not a number.',
 'TypeScript is everywhere in modern React, Vite, and Node projects. It helps you understand why agents talk about types, typecheck failures, interfaces, and generated database types.',
 ARRAY['lang-javascript','code-type','dev-typecheck','tool-vite']::text[],
 ARRAY['lang-javascript','code-type']::text[],
 'dev-typecheck',
 ARRAY[
   'A browser-only markup language',
   'A container orchestration system',
   'A visual test runner'
 ]::text[],
 '___ caught that the component expected a string, not a number.',
 'Use ''TypeScript'' in a sentence about catching value-shape mistakes before runtime.',
 'curated', 'curator', '2026-05-28'),

('lang-python', 'Python', 'PIE-thon', 'dev-concepts', 'coding', 1,
 'A general-purpose programming language often used for scripts, automation, data, AI, and backend services.',
 'Python is known for readable syntax and a large ecosystem. Teams use it for data science, machine learning, automation scripts, APIs, notebooks, and backend jobs. When a repo has `.py` files, a `requirements.txt`, or a virtual environment, Python is probably involved.',
 'The data cleanup script was written in Python.',
 'Python appears constantly in AI, data, scripting, and backend work. It gives you a clean bucket for many examples that are not JavaScript or shell commands.',
 ARRAY['ml-model','ai-evals','code-function','lang-javascript']::text[],
 ARRAY['code-function','code-variable']::text[],
 'ml-model',
 ARRAY[
   'A CSS framework for utility classes',
   'A browser build tool',
   'A database used for relational rows'
 ]::text[],
 'The data cleanup script was written in ___.',
 'Use ''Python'' in a sentence about automation, data, or AI code.',
 'curated', 'curator', '2026-05-28'),

('lang-rust', 'Rust', null, 'dev-concepts', 'coding', 2,
 'A systems programming language focused on speed and memory safety.',
 'Rust is used when teams want low-level performance without many classic memory bugs. It shows up in command-line tools, infrastructure, browser engines, crypto libraries, and newer backend systems. Rust code is compiled before it runs, and its ownership rules are famous for being strict.',
 'The fast parser was rewritten in Rust.',
 'Rust is a common "serious systems" word in modern engineering talk. It helps you understand why some tools are fast, compiled, and stricter than ordinary scripting code.',
 ARRAY['lang-cpp','hw-memory','os-memory','tool-vite']::text[],
 ARRAY['code-type','os-memory']::text[],
 'lang-cpp',
 ARRAY[
   'A JavaScript UI framework',
   'A cloud preview host',
   'A package manager for Node projects'
 ]::text[],
 'The fast parser was rewritten in ___.',
 'Use ''Rust'' in a sentence about fast compiled systems code.',
 'curated', 'curator', '2026-05-28'),

('lang-c', 'C', 'C', 'dev-concepts', 'coding', 2,
 'A low-level programming language close to operating systems and hardware.',
 'C is one of the foundational languages behind operating systems, embedded software, runtimes, and performance-critical libraries. It gives programmers direct control over memory and machine-level details, which also means fewer safety rails. Many newer languages and tools still compare themselves to C.',
 'The operating-system library exposed a small C API.',
 'C is the ancestor word behind a lot of systems talk. It helps you understand why engineers separate low-level compiled code from app-level code.',
 ARRAY['lang-cpp','lang-rust','os-kernel','hw-instruction-set']::text[],
 ARRAY['os-memory','code-function']::text[],
 'lang-rust',
 ARRAY[
   'A design system for UI components',
   'A browser automation test runner',
   'A managed Postgres platform'
 ]::text[],
 'The operating-system library exposed a small ___ API.',
 'Use ''C'' in a sentence about low-level code or system libraries.',
 'curated', 'curator', '2026-05-28'),

('lang-cpp', 'C++', 'C-plus-plus', 'dev-concepts', 'coding', 2,
 'A compiled systems language that extends C with objects and higher-level features.',
 'C++ is used for performance-heavy software such as game engines, browsers, databases, desktop apps, graphics systems, and trading systems. It gives teams deep control and speed, but the language is large and can be hard to use safely.',
 'The rendering engine had a C++ module for speed.',
 'C++ shows up when performance, graphics, native apps, or old infrastructure are involved. It helps you understand why some codebases feel more complex than web app code.',
 ARRAY['lang-c','lang-rust','hw-gpu','os-memory']::text[],
 ARRAY['lang-c','os-memory']::text[],
 'lang-rust',
 ARRAY[
   'A language used mainly for browser UI behavior',
   'A web framework for React',
   'A data cache stored in memory'
 ]::text[],
 'The rendering engine had a ___ module for speed.',
 'Use ''C++'' in a sentence about high-performance native code.',
 'curated', 'curator', '2026-05-28'),

('lang-csharp', 'C#', 'C-sharp', 'dev-concepts', 'coding', 1,
 'A Microsoft-backed programming language common in enterprise apps, .NET services, and game development.',
 'C# is the main language of the .NET ecosystem. It is common in Windows-heavy companies, backend services, internal enterprise tools, and Unity games. If someone says "dotnet" or mentions a `.cs` file, C# is probably nearby.',
 'The internal claims service was written in C#.',
 'C# matters because many large organizations run Microsoft-centered stacks. It helps you recognize a major enterprise language instead of treating it as just another symbol-heavy file extension.',
 ARRAY['lang-java','prod-erp','arch-service','ent-azure']::text[],
 ARRAY['code-class','arch-service']::text[],
 'lang-java',
 ARRAY[
   'A browser build tool',
   'A data warehouse query language',
   'A CSS utility framework'
 ]::text[],
 'The internal claims service was written in ___.',
 'Use ''C#'' in a sentence about a .NET or Microsoft-backed service.',
 'curated', 'curator', '2026-05-28'),

('lang-java', 'Java', 'JAH-vuh', 'dev-concepts', 'coding', 1,
 'A long-running enterprise programming language used for backend services, Android apps, and large systems.',
 'Java is a compiled language that runs on the Java Virtual Machine. It is common in banks, healthcare, insurance, government, Android, and older enterprise platforms. Java is different from JavaScript despite the similar name.',
 'The batch-processing service was written in Java.',
 'Java is one of the most common enterprise codebase words. It helps you avoid mixing it up with JavaScript and recognize why some systems feel older, larger, and more formal.',
 ARRAY['lang-csharp','lang-kotlin','arch-service','prod-compliance']::text[],
 ARRAY['code-class','arch-service']::text[],
 'lang-kotlin',
 ARRAY[
   'A browser scripting language with a similar name',
   'A local dev server for React apps',
   'A hosted Postgres product'
 ]::text[],
 'The batch-processing service was written in ___.',
 'Use ''Java'' in a sentence about enterprise backend code.',
 'curated', 'curator', '2026-05-28'),

('lang-go', 'Go', 'goh', 'dev-concepts', 'coding', 2,
 'A compiled programming language often used for cloud services, CLIs, and infrastructure tools.',
 'Go, also called Golang, is designed for simple syntax, fast builds, concurrency, and deployable server binaries. It shows up in cloud infrastructure, command-line tools, Kubernetes-related projects, and backend services.',
 'The deployment CLI was written in Go.',
 'Go is a common infrastructure-language word. It helps you understand why many cloud tools feel small, fast, and distributed as one compiled binary.',
 ARRAY['cloud-kubernetes','tool-cli','arch-service','lang-rust']::text[],
 ARRAY['code-function','arch-service']::text[],
 'cloud-kubernetes',
 ARRAY[
   'A markup language for page structure',
   'A React framework for server rendering',
   'A browser security rule'
 ]::text[],
 'The deployment CLI was written in ___.',
 'Use ''Go'' in a sentence about cloud infrastructure or command-line tooling.',
 'curated', 'curator', '2026-05-28'),

('lang-swift', 'Swift', null, 'dev-concepts', 'coding', 1,
 'Apple''s programming language for iOS, macOS, watchOS, and other Apple-platform apps.',
 'Swift is the main modern language for Apple-platform development. It is used with SwiftUI and Apple SDKs to build iPhone, iPad, Mac, watch, and visionOS apps. Older Apple apps may still use Objective-C.',
 'The iPhone prototype was built in Swift.',
 'Swift helps you separate Apple app work from web app work. When someone talks about Xcode, iOS, or SwiftUI, this is the language layer.',
 ARRAY['lang-kotlin','hw-arm','fw-swiftui','code-type']::text[],
 ARRAY['code-function','code-type']::text[],
 'fw-swiftui',
 ARRAY[
   'A language used for Android apps',
   'A JavaScript package manager',
   'A Postgres hosting service'
 ]::text[],
 'The iPhone prototype was built in ___.',
 'Use ''Swift'' in a sentence about an Apple-platform app.',
 'curated', 'curator', '2026-05-28'),

('lang-kotlin', 'Kotlin', 'KOT-lin', 'dev-concepts', 'coding', 1,
 'A programming language common in Android apps and JVM backend services.',
 'Kotlin is a modern language that works well with Java and is the preferred language for many Android apps. Teams also use it for backend services on the JVM. It often appears where Java ecosystems want a cleaner newer syntax.',
 'The Android app screen was written in Kotlin.',
 'Kotlin helps you recognize the Android side of mobile work and the modern-Java side of enterprise backend work.',
 ARRAY['lang-java','lang-swift','arch-service','code-type']::text[],
 ARRAY['lang-java','code-function']::text[],
 'lang-java',
 ARRAY[
   'Apple''s main app language',
   'A browser bundler',
   'A cloud edge host'
 ]::text[],
 'The Android app screen was written in ___.',
 'Use ''Kotlin'' in a sentence about Android or JVM code.',
 'curated', 'curator', '2026-05-28'),

('lang-html', 'HTML', 'H-T-M-L', 'dev-concepts', 'coding', 1,
 'The markup language that gives web pages their structure.',
 'HTML stands for HyperText Markup Language. It describes the structure of a page: headings, paragraphs, links, forms, buttons, images, and sections. HTML is not the styling layer and not the behavior layer; CSS styles it, and JavaScript makes it interactive.',
 'The modal already had the right HTML, but the click handler was broken.',
 'HTML is the page-structure word. It helps you understand what the browser receives before styling, React behavior, or JavaScript state gets involved.',
 ARRAY['lang-css','lang-javascript','fw-react','web-ssr']::text[],
 ARRAY[]::text[],
 'lang-css',
 ARRAY[
   'A language for styling page layout',
   'A runtime for server-side JavaScript',
   'A database for relational tables'
 ]::text[],
 'The modal already had the right ___, but the click handler was broken.',
 'Use ''HTML'' in a sentence about web page structure.',
 'curated', 'curator', '2026-05-28'),

('lang-css', 'CSS', 'C-S-S', 'dev-concepts', 'coding', 1,
 'The stylesheet language that controls how web pages look.',
 'CSS stands for Cascading Style Sheets. It controls layout, spacing, colors, typography, responsive breakpoints, hover states, and visual presentation. HTML says what is on the page; CSS says how it is arranged and styled.',
 'The mobile layout bug was fixed with CSS.',
 'CSS is the visual layer of web work. It helps you separate a design or spacing problem from a React state bug or backend problem.',
 ARRAY['lang-html','fw-tailwind','fw-react','agile-visual-qa']::text[],
 ARRAY['lang-html']::text[],
 'fw-tailwind',
 ARRAY[
   'A language for querying relational databases',
   'A runtime for JavaScript outside the browser',
   'A version-control command'
 ]::text[],
 'The mobile layout bug was fixed with ___.',
 'Use ''CSS'' in a sentence about page styling or layout.',
 'curated', 'curator', '2026-05-28'),

('lang-sql', 'SQL', 'sequel or S-Q-L', 'dev-concepts', 'coding', 1,
 'Structured Query Language, the language used to ask relational databases for data.',
 'SQL stands for Structured Query Language. It is used to select, insert, update, delete, join, filter, and aggregate rows in relational databases such as Postgres. Many app bugs eventually become SQL questions because the app has to read or write stored data.',
 'The dashboard used SQL to join progress rows with term names.',
 'SQL is the database-question language. It helps you understand what changes when an agent moves from reading code to querying real rows.',
 ARRAY['data-postgres','data-join','data-table','sys-sql']::text[],
 ARRAY['data-table','data-row']::text[],
 'data-postgres',
 ARRAY[
   'A language for styling web pages',
   'A framework for React routes',
   'A browser automation test runner'
 ]::text[],
 'The dashboard used ___ to join progress rows with term names.',
 'Use ''SQL'' in a sentence about querying rows from a relational database.',
 'curated', 'curator', '2026-05-28'),

('lang-bash', 'Bash', 'bash', 'dev-concepts', 'coding', 1,
 'A common shell language for terminal commands and scripts.',
 'Bash is both a command shell and a scripting language. It runs many terminal commands, setup scripts, deploy helpers, and automation snippets. When a file ends in `.sh` or a README says to run a command block, Bash or a similar shell is often involved.',
 'The deploy helper was a Bash script.',
 'Bash is the terminal-automation word. It helps you understand why one line in a README can create files, run tests, set variables, or call other tools.',
 ARRAY['cli-bash','os-shell','os-environment-variable','flow-ci']::text[],
 ARRAY['os-shell','cli-terminal']::text[],
 'os-shell',
 ARRAY[
   'A React UI framework',
   'A database cache',
   'A compiled mobile language'
 ]::text[],
 'The deploy helper was a ___ script.',
 'Use ''Bash'' in a sentence about terminal automation.',
 'curated', 'curator', '2026-05-28'),

('runtime-nodejs', 'Node.js', 'node J-S', 'dev-concepts', 'coding', 1,
 'A JavaScript runtime that lets JavaScript run outside the browser.',
 'Node.js is a JavaScript runtime for servers, scripts, CLIs, build tools, and local development. npm, Vite, many test runners, and lots of backend services run on Node.js. If a project has `package.json`, it probably expects Node.js somewhere.',
 'The local dev server ran on Node.js.',
 'Node.js is the reason JavaScript is not only a browser language. It helps you understand why frontend projects still talk about server runtimes, versions, and process errors.',
 ARRAY['lang-javascript','tool-npm','tool-vite','os-process']::text[],
 ARRAY['lang-javascript','os-process']::text[],
 'tool-npm',
 ARRAY[
   'A language for HTML structure',
   'A hosted database product',
   'A cache used for fast key-value lookups'
 ]::text[],
 'The local dev server ran on ___.',
 'Use ''Node.js'' in a sentence about JavaScript running outside the browser.',
 'curated', 'curator', '2026-05-28'),

('tool-npm', 'npm', 'N-P-M', 'dev-concepts', 'coding', 1,
 'The default package manager and package registry for Node.js projects.',
 'npm installs JavaScript packages, runs scripts from `package.json`, and connects projects to the npm registry. Commands like `npm install`, `npm run dev`, and `npm test` are npm commands. It is both a tool on the machine and the name of the package ecosystem.',
 'Run npm install before starting the Vite dev server.',
 'npm is one of the first words you see in almost every web repo. It helps you know whether a command is installing packages, running a script, or using the JavaScript ecosystem.',
 ARRAY['runtime-nodejs','tool-pnpm','dev-package-manager','dev-node-modules']::text[],
 ARRAY['runtime-nodejs','dev-package-manager']::text[],
 'tool-pnpm',
 ARRAY[
   'A browser framework for components',
   'A relational database',
   'A language for systems programming'
 ]::text[],
 'Run ___ install before starting the Vite dev server.',
 'Use ''npm'' in a sentence about installing packages or running package scripts.',
 'curated', 'curator', '2026-05-28'),

('tool-pnpm', 'pnpm', 'P-N-P-M', 'dev-concepts', 'coding', 1,
 'A fast package manager for Node.js projects that stores dependencies efficiently.',
 'pnpm does the same broad job as npm: install packages and run scripts. Its main difference is how it stores dependencies, avoiding many duplicated package copies across projects. Some repos require pnpm because their lockfile and workspace setup are built around it.',
 'The monorepo used pnpm instead of npm.',
 'pnpm helps you understand why one project says `npm install` and another says `pnpm install`. The package manager choice is part of the repo setup, not decoration.',
 ARRAY['tool-npm','runtime-nodejs','dev-lockfile','dev-monorepo']::text[],
 ARRAY['runtime-nodejs','dev-package-manager']::text[],
 'dev-lockfile',
 ARRAY[
   'A language for Android apps',
   'A service that hosts previews',
   'A query language for APIs'
 ]::text[],
 'The monorepo used ___ instead of npm.',
 'Use ''pnpm'' in a sentence about installing JavaScript dependencies.',
 'curated', 'curator', '2026-05-28'),

('tool-vite', 'Vite', 'veet', 'dev-concepts', 'coding', 1,
 'A fast frontend build tool and dev server used by many React apps.',
 'Vite starts a local dev server, handles hot reload, and builds browser-ready assets for production. In this app, Vite is why localhost can show a React app quickly while source files are transformed behind the scenes.',
 'Vite served the app on localhost:5173.',
 'Vite is one of the named tools you see in terminal output constantly. It helps you connect local preview URLs, hot reload, build errors, and frontend tooling.',
 ARRAY['fw-react','lang-typescript','dev-bundler','dev-hot-reload']::text[],
 ARRAY['lang-javascript','dev-bundler']::text[],
 'fw-react',
 ARRAY[
   'A cloud database platform',
   'A browser automation framework',
   'A programming language for mobile apps'
 ]::text[],
 '___ served the app on localhost:5173.',
 'Use ''Vite'' in a sentence about a frontend dev server or build.',
 'curated', 'curator', '2026-05-28'),

('fw-react', 'React', 'REE-act', 'dev-concepts', 'coding', 1,
 'A JavaScript library for building user interfaces from components.',
 'React lets developers build UI as components that render from props and state. It is not the whole app by itself; it usually sits with routing, styling, build tools, data fetching, and backend services. React code often appears in `.tsx` or `.jsx` files.',
 'The sign-in screen is a React component.',
 'React is the main frontend word in this codebase. It helps you understand why people talk about components, props, state, hooks, rendering, and hydration.',
 ARRAY['dev-component','dev-props','dev-state','dev-hook']::text[],
 ARRAY['lang-javascript','dev-component']::text[],
 'fw-nextjs',
 ARRAY[
   'A package manager for Node projects',
   'A database used for relational rows',
   'A low-level systems language'
 ]::text[],
 'The sign-in screen is a ___ component.',
 'Use ''React'' in a sentence about building UI from components.',
 'curated', 'curator', '2026-05-28'),

('fw-nextjs', 'Next.js', 'next J-S', 'dev-concepts', 'coding', 2,
 'A React framework for routing, server rendering, API routes, and production web apps.',
 'Next.js builds on React by adding application structure: file-based routing, server-side rendering, server components, API handlers, static generation, and deployment conventions. It is common when teams want React plus a full web-app framework.',
 'The marketing site used Next.js for server-rendered pages.',
 'Next.js helps you separate React the UI library from a larger framework that decides routing, rendering, and server behavior.',
 ARRAY['fw-react','web-ssr','web-route','cloud-vercel']::text[],
 ARRAY['fw-react','web-route']::text[],
 'web-ssr',
 ARRAY[
   'A language for styling pages',
   'A memory cache for backend data',
   'A package manager command'
 ]::text[],
 'The marketing site used ___ for server-rendered pages.',
 'Use ''Next.js'' in a sentence about a React framework for full web apps.',
 'curated', 'curator', '2026-05-28'),

('fw-vue', 'Vue', 'vyoo', 'dev-concepts', 'coding', 1,
 'A JavaScript framework for building user interfaces and single-page apps.',
 'Vue is another major frontend framework. Like React, it helps teams build interactive interfaces from components, state, and templates. A repo using Vue will look different from a React repo, but the broad job is similar: manage UI behavior in the browser.',
 'The admin dashboard was written in Vue.',
 'Vue gives you another frontend bucket. When docs compare React, Vue, and Svelte, you can hear them as alternative UI frameworks instead of random product names.',
 ARRAY['fw-react','fw-svelte','lang-javascript','web-spa']::text[],
 ARRAY['lang-javascript','dev-component']::text[],
 'fw-svelte',
 ARRAY[
   'A language for querying relational tables',
   'A backend cache',
   'A cloud hosting provider'
 ]::text[],
 'The admin dashboard was written in ___.',
 'Use ''Vue'' in a sentence about a JavaScript UI framework.',
 'curated', 'curator', '2026-05-28'),

('fw-svelte', 'Svelte', 'svelt', 'dev-concepts', 'coding', 2,
 'A frontend framework that compiles components into efficient browser JavaScript.',
 'Svelte is a UI framework that does more work at build time than React or Vue. Instead of shipping a large runtime model, Svelte compiles components into JavaScript that updates the page directly. Teams pick it for concise syntax and fast interactive apps.',
 'The prototype used Svelte for a small interactive widget.',
 'Svelte helps you understand that frontend frameworks can make different tradeoffs even when they all produce browser UI.',
 ARRAY['fw-react','fw-vue','tool-vite','dev-bundler']::text[],
 ARRAY['lang-javascript','dev-component']::text[],
 'tool-vite',
 ARRAY[
   'A database migration style',
   'A Microsoft backend language',
   'A command-line shell'
 ]::text[],
 'The prototype used ___ for a small interactive widget.',
 'Use ''Svelte'' in a sentence about a compiled frontend framework.',
 'curated', 'curator', '2026-05-28'),

('data-postgres', 'Postgres', 'POST-gres', 'dev-concepts', 'coding', 1,
 'A popular relational database used to store structured app data.',
 'Postgres, formally PostgreSQL, stores data in tables and supports SQL, transactions, indexes, constraints, JSON fields, extensions, and strong reliability features. Supabase uses Postgres as its database layer.',
 'The terms table lives in Postgres.',
 'Postgres is the database name you see behind Supabase and many serious apps. It helps you connect rows, migrations, SQL, and policies to a real database engine.',
 ARRAY['lang-sql','data-table','data-index','data-supabase']::text[],
 ARRAY['lang-sql','data-table']::text[],
 'data-supabase',
 ARRAY[
   'A frontend UI library',
   'A browser build tool',
   'A compiled systems language'
 ]::text[],
 'The terms table lives in ___.',
 'Use ''Postgres'' in a sentence about relational app data.',
 'curated', 'curator', '2026-05-28'),

('data-redis', 'Redis', 'RED-iss', 'dev-concepts', 'coding', 2,
 'A fast in-memory data store often used for caching, queues, counters, and short-lived state.',
 'Redis keeps data in memory so reads and writes can be very fast. Teams use it for caches, rate limits, background job queues, locks, pub/sub messages, and session-like data. It is not a replacement for a durable relational database in every case.',
 'The API stored the rate-limit counter in Redis.',
 'Redis is a common backend infrastructure name. It helps you understand why engineers mention caches, queues, and fast temporary state separately from Postgres.',
 ARRAY['cloud-cache','sys-rate-limit','arch-message-bus','data-postgres']::text[],
 ARRAY['cloud-cache','data-postgres']::text[],
 'cloud-cache',
 ARRAY[
   'A React framework',
   'A language for iPhone apps',
   'A package manager for Node projects'
 ]::text[],
 'The API stored the rate-limit counter in ___.',
 'Use ''Redis'' in a sentence about fast cache or queue storage.',
 'curated', 'curator', '2026-05-28'),

('data-supabase', 'Supabase', 'SOO-puh-base', 'dev-concepts', 'coding', 1,
 'A backend platform built around Postgres, authentication, storage, and edge functions.',
 'Supabase gives apps a managed Postgres database, Auth, Storage, Edge Functions, generated client APIs, and dashboard tooling. In this repo, Supabase handles sign-in, term data, progress rows, migrations, and server-side functions.',
 'Supabase Auth sent the magic link.',
 'Supabase is a named platform you see all over this app. It helps you connect Postgres, Auth, Edge Functions, RLS, migrations, and local-vs-cloud setup.',
 ARRAY['data-postgres','sec-sso','sys-edge-function','sys-rls']::text[],
 ARRAY['data-postgres','sec-authentication']::text[],
 'sys-rls',
 ARRAY[
   'A JavaScript package manager',
   'A browser UI framework',
   'A compiled systems language'
 ]::text[],
 '___ Auth sent the magic link.',
 'Use ''Supabase'' in a sentence about backend data, auth, or edge functions.',
 'curated', 'curator', '2026-05-28'),

('cloud-vercel', 'Vercel', 'ver-SELL', 'dev-concepts', 'coding', 1,
 'A hosting platform for frontend apps, previews, serverless functions, and web deployments.',
 'Vercel builds and hosts web apps, especially React and Next.js projects. It creates preview deployments for branches, serves static assets, runs serverless or edge functions, and connects GitHub changes to visible URLs.',
 'Vercel created a preview deployment for the branch.',
 'Vercel is one of the main "see it online" words in this workflow. It helps you understand previews, production domains, aliases, builds, and deployment status.',
 ARRAY['fw-nextjs','ent-preview-deployment','cloud-deploy','tool-vite']::text[],
 ARRAY['cloud-deploy','flow-branch']::text[],
 'ent-preview-deployment',
 ARRAY[
   'A relational database',
   'A language for Android apps',
   'A frontend component library'
 ]::text[],
 '___ created a preview deployment for the branch.',
 'Use ''Vercel'' in a sentence about hosting or preview deployments.',
 'curated', 'curator', '2026-05-28'),

('tool-copilot', 'Copilot', 'CO-pilot', 'dev-concepts', 'coding', 1,
 'An AI coding assistant that suggests, edits, and explains code inside developer tools.',
 'Copilot usually means GitHub Copilot or a similar coding assistant embedded in an editor. It can autocomplete code, explain files, propose changes, and answer questions using surrounding code context. It is helpful, but its suggestions still need review.',
 'Copilot suggested a React hook for the component.',
 'Copilot is one of the places you hears unknown tech names first. Knowing what Copilot is doing helps you separate suggestion, explanation, and verified code.',
 ARRAY['ai-agent','ai-tool-call','fw-react','tool-vscode']::text[],
 ARRAY['ai-llm','code-review']::text[],
 'ai-agent',
 ARRAY[
   'A relational database engine',
   'A CSS stylesheet language',
   'A compiled backend language'
 ]::text[],
 '___ suggested a React hook for the component.',
 'Use ''Copilot'' in a sentence about an AI coding assistant.',
 'curated', 'curator', '2026-05-28'),

('tool-playwright', 'Playwright', 'PLAY-wright', 'dev-concepts', 'coding', 2,
 'A browser automation tool used for end-to-end tests and visual checks.',
 'Playwright can open a browser, click buttons, type into fields, inspect pages, take screenshots, and run tests across browsers. Teams use it to verify real user flows and visual behavior, not only isolated functions.',
 'Playwright opened the mobile preview and checked for overflow.',
 'Playwright is the browser-QA word in this repo. It helps you understand what visual QA and end-to-end testing actually run.',
 ARRAY['qa-e2e-test','agile-visual-qa','dev-test-runner','tool-vitest']::text[],
 ARRAY['qa-e2e-test','web-route']::text[],
 'agile-visual-qa',
 ARRAY[
   'A JavaScript runtime',
   'A database cache',
   'A language for systems programming'
 ]::text[],
 '___ opened the mobile preview and checked for overflow.',
 'Use ''Playwright'' in a sentence about browser automation or visual QA.',
 'curated', 'curator', '2026-05-28'),

('tool-vitest', 'Vitest', 'VITE-test', 'dev-concepts', 'coding', 1,
 'A JavaScript and TypeScript test runner commonly used with Vite projects.',
 'Vitest finds test files, runs assertions, reports failures, and integrates well with Vite. It is usually used for unit tests and component-adjacent tests, while Playwright covers full browser behavior.',
 'Vitest ran the content-integrity test suite.',
 'Vitest is the test-runner name you see in this repo. It helps you understand whether a failure came from test logic, app code, setup, or browser QA.',
 ARRAY['tool-vite','dev-test-runner','qa-unit-test','tool-playwright']::text[],
 ARRAY['dev-test-runner','lang-typescript']::text[],
 'tool-playwright',
 ARRAY[
   'A cloud hosting platform',
   'A relational database',
   'A frontend UI framework'
 ]::text[],
 '___ ran the content-integrity test suite.',
 'Use ''Vitest'' in a sentence about running JavaScript or TypeScript tests.',
 'curated', 'curator', '2026-05-28')

on conflict (id) do nothing;

update terms set pronunciation = 'C-plus-plus' where id = 'lang-cpp';
update terms set pronunciation = 'C-sharp' where id = 'lang-csharp';
update terms set pronunciation = 'H-T-M-L' where id = 'lang-html';
update terms set pronunciation = 'C-S-S' where id = 'lang-css';
update terms set pronunciation = 'sequel or S-Q-L' where id = 'lang-sql';
update terms set pronunciation = 'node J-S' where id = 'runtime-nodejs';
update terms set pronunciation = 'N-P-M' where id = 'tool-npm';
update terms set pronunciation = 'P-N-P-M' where id = 'tool-pnpm';
update terms set pronunciation = 'veet' where id = 'tool-vite';
update terms set pronunciation = 'next J-S' where id = 'fw-nextjs';
