import { plainPunctuation } from './lesson-text';

export interface ConversationGuide {
  termId: string;
  plainExplanation: string;
  technicalExplanation: string;
  sayBack: string;
  commonConfusion: string;
}

export interface ConversationGuideTerm {
  id: string;
  term: string;
  one_line_definition: string;
  long_definition: string;
  why_it_matters?: string | null;
  multiple_choice_distractors?: readonly string[] | null;
}

export const CONVERSATION_GUIDES: ConversationGuide[] = [
  {
    termId: 'ai-rag',
    plainExplanation:
      'Use this when the answer should come from real documents instead of the model trying to remember. The system finds the relevant source material first, then asks the model to answer with that material nearby.',
    technicalExplanation:
      'RAG retrieves relevant chunks from a knowledge base, often through embeddings and a vector store, then injects those chunks into the prompt before generation.',
    sayBack:
      'RAG means the AI looks up trusted material first, then answers from that evidence.',
    commonConfusion:
      'Do not mix RAG with fine-tuning. RAG supplies facts at answer time; fine-tuning changes model behavior through training examples.',
  },
  {
    termId: 'ai-fine-tuning',
    plainExplanation:
      'Use this when the model already knows the general task, but you want it to behave in a more specific pattern every time. You are teaching style, format, or task habits through examples.',
    technicalExplanation:
      'Fine-tuning updates model weights on a curated dataset so the model internalizes a repeated behavior instead of receiving the same examples in every prompt.',
    sayBack:
      'Fine-tuning changes the model with examples, so the behavior is more baked in.',
    commonConfusion:
      'Do not use fine-tuning as the first answer to missing facts. If the facts change often, RAG is usually the cleaner move.',
  },
  {
    termId: 'ai-embedding',
    plainExplanation:
      'An embedding turns meaning into numbers so software can compare ideas even when the words are different. It is why searching for one phrase can find a related phrase.',
    technicalExplanation:
      'An embedding is a dense vector representation. Similar pieces of text land near each other in vector space, which enables semantic search and RAG retrieval.',
    sayBack:
      'An embedding is a numeric meaning-shape that lets software compare similar ideas.',
    commonConfusion:
      'An embedding is not the original document. It is a numeric representation used for comparison, usually stored beside the source text.',
  },
  {
    termId: 'ai-vector-store',
    plainExplanation:
      'A vector store is where embeddings live so the app can search by meaning. It is the shelf the system checks when it needs related document chunks.',
    technicalExplanation:
      'A vector store indexes embedding vectors and supports nearest-neighbor search, often with metadata filters, so retrieval can find semantically similar chunks quickly.',
    sayBack:
      'A vector store keeps embeddings searchable by meaning, not just exact words.',
    commonConfusion:
      'Do not call every database a vector store. A normal database stores records; a vector store is optimized for similarity search.',
  },
  {
    termId: 'ai-agent',
    plainExplanation:
      'An agent is an AI system that does steps, checks results, and keeps going toward a goal. It is more than a chat answer because it can act through the surrounding software.',
    technicalExplanation:
      'An agent combines a model, instructions, state, tool calls, and an execution loop so it can plan, act, observe results, and continue until a stop condition.',
    sayBack:
      'An agent is AI plus an action loop, not just a model writing text.',
    commonConfusion:
      'Do not treat agent as a magic quality. The important parts are the loop, the available actions, the checks, and the stop conditions.',
  },
  {
    termId: 'ai-tool-call',
    plainExplanation:
      'A tool call is the moment the AI asks the software around it to do something real, like read a file, search documents, run a command, or fetch data.',
    technicalExplanation:
      'A tool call is a structured request from the model to the runtime, usually with a tool name and typed arguments, followed by a result returned to the model.',
    sayBack:
      'A tool call is the model asking the runtime to perform a specific action.',
    commonConfusion:
      'Do not confuse a tool call with the model thinking. The model requests the action, but the runtime or external service performs it.',
  },
  {
    termId: 'ai-hallucination',
    plainExplanation:
      'A hallucination is when the model gives an answer that sounds confident but is not actually true. The danger is that the wording can feel convincing.',
    technicalExplanation:
      'A hallucination is ungrounded or false generated content, often caused by the model predicting plausible text without enough source evidence or constraints.',
    sayBack:
      'A hallucination is confident AI output that is not grounded in reality.',
    commonConfusion:
      'Do not call every mistake a hallucination. A parsing bug or bad retrieval result may be a system issue, not invented model content.',
  },
  {
    termId: 'ai-grounding',
    plainExplanation:
      'Grounding means tying an answer to evidence the system can point at. The model is less likely to drift because it has real source material in front of it.',
    technicalExplanation:
      'Grounding connects generation to trusted sources, retrieved documents, tool results, citations, or verified context so output is constrained by evidence.',
    sayBack:
      'Grounding gives the model evidence to answer from instead of memory alone.',
    commonConfusion:
      'Grounding is not the same as perfect truth. It improves the answer path, but the system still needs checks and good sources.',
  },
  {
    termId: 'ai-structured-output',
    plainExplanation:
      'Structured output means the answer has to fit a predictable shape. It is useful when software, not just a person, needs to read the result next.',
    technicalExplanation:
      'Structured output constrains model responses to JSON, a schema, or typed fields so downstream code can parse and validate the result deterministically.',
    sayBack:
      'Structured output makes AI answers boring enough for code to use safely.',
    commonConfusion:
      'Do not confuse structured output with a nicer-looking answer. The point is parseability and validation, not presentation polish.',
  },
  {
    termId: 'ai-evals',
    plainExplanation:
      'Evals are repeatable checks for whether an AI change got better or worse. They keep the team from judging a model or prompt only by a few nice examples.',
    technicalExplanation:
      'Evals are evaluation datasets, assertions, graders, or human review loops that measure model, prompt, retrieval, or agent behavior across cases.',
    sayBack:
      'Evals are the tests that tell you whether the AI behavior actually improved.',
    commonConfusion:
      'Do not treat a demo as an eval. A demo shows one path; evals repeatedly measure a defined set of cases.',
  },
  {
    termId: 'ai-guardrails',
    plainExplanation:
      'Guardrails are rules and checks around an AI system. They reduce risky behavior by limiting what the system can say, do, accept, or send forward.',
    technicalExplanation:
      'Guardrails can include input filters, output validators, policy checks, approval gates, tool-call constraints, and escalation paths around the model.',
    sayBack:
      'Guardrails are boundaries and checks around AI behavior, especially when actions matter.',
    commonConfusion:
      'Guardrails do not make the model harmless by themselves. They are one safety layer, and they need evals and monitoring too.',
  },
  {
    termId: 'ml-training-data',
    plainExplanation:
      'Training data is the set of examples a model learns from. If the examples are weak, biased, stale, or mislabeled, the model learns those problems too.',
    technicalExplanation:
      'Training data is the input corpus used to fit model parameters, including examples, labels, features, and distribution choices that shape model behavior.',
    sayBack:
      'Training data is the example set that teaches the model its pattern.',
    commonConfusion:
      'Do not confuse training data with test data. Training data teaches; test data checks whether the learning generalizes.',
  },
  {
    termId: 'ml-model',
    plainExplanation:
      'A model is the learned thing that takes an input and produces an output. People often speak about it like the brain of the system.',
    technicalExplanation:
      'A model is a learned function with parameters that maps inputs to predictions, classifications, generations, or other outputs during inference.',
    sayBack:
      'A model is the learned function that turns input into an answer.',
    commonConfusion:
      'Do not mix up model with app. The app may include UI, storage, prompts, and retrieval; the model is only one part.',
  },
  {
    termId: 'ml-inference',
    plainExplanation:
      'Inference is using a trained model to get an answer on new input. Training is the learning phase; inference is the use-it-now phase.',
    technicalExplanation:
      'Inference runs a trained model forward on fresh input to produce a prediction, classification, embedding, or generated response.',
    sayBack:
      'Inference is what happens when a trained model is actually used.',
    commonConfusion:
      'Do not call every AI call training. Most app requests are inference; the model is being used, not taught from scratch.',
  },
  {
    termId: 'ml-overfitting',
    plainExplanation:
      'Overfitting means the model learned the practice examples too closely and fails when reality changes. It memorized the quiz instead of learning the subject.',
    technicalExplanation:
      'Overfitting occurs when a model has low training error but poor validation or test performance because it captured noise instead of general patterns.',
    sayBack:
      'Overfitting is when a model memorizes training examples and gets worse on new cases.',
    commonConfusion:
      'Do not confuse overfitting with simply being inaccurate. The key sign is doing well on training data and poorly elsewhere.',
  },
  {
    termId: 'arch-api',
    plainExplanation:
      'An API is the agreed way one piece of software asks another piece for something. It is the menu of allowed requests and expected answers.',
    technicalExplanation:
      'An API is a contract between software boundaries, defining operations, inputs, outputs, errors, authentication, and version behavior.',
    sayBack:
      'An API is the contract for how software pieces talk to each other.',
    commonConfusion:
      'Do not use API and endpoint as exact synonyms. An endpoint is one address or operation; an API can include many endpoints.',
  },
  {
    termId: 'arch-interface',
    plainExplanation:
      'An interface is a boundary with expected behavior. It lets one part use another part without knowing every detail inside it.',
    technicalExplanation:
      'An interface defines the methods, inputs, outputs, or shape one module exposes so implementation details can change behind the boundary.',
    sayBack:
      'An interface says what a thing promises, not how it does the work inside.',
    commonConfusion:
      'Do not think interface only means visual screen. In software, it often means a code or system contract.',
  },
  {
    termId: 'arch-service',
    plainExplanation:
      'A service is a running piece of software responsible for a job, like sending email, storing files, or checking authorization.',
    technicalExplanation:
      'A service is a deployable or separately owned unit that exposes capabilities through APIs, queues, events, or internal calls.',
    sayBack:
      'A service is a software unit with a job and a boundary around it.',
    commonConfusion:
      'Do not call every function a service. A service usually has ownership, runtime, boundaries, and operational behavior.',
  },
  {
    termId: 'arch-monolith',
    plainExplanation:
      'A monolith is one application where many parts are built and shipped together. That can be simple and strong until the shared shape gets too hard to move.',
    technicalExplanation:
      'A monolith keeps multiple capabilities in one deployable unit, sharing code, data access, runtime, and release cadence.',
    sayBack:
      'A monolith is one big deployable app that holds many responsibilities together.',
    commonConfusion:
      'Do not assume monolith means bad. For small teams and tight product loops, a monolith can be the right tradeoff.',
  },
  {
    termId: 'arch-microservice',
    plainExplanation:
      'A microservice splits one big application into smaller services with separate responsibilities. The gain is independence; the cost is coordination.',
    technicalExplanation:
      'A microservice is a small independently deployable service with its own boundary, API, data ownership, and operational lifecycle.',
    sayBack:
      'A microservice is a small service that can change and deploy more independently.',
    commonConfusion:
      'Do not treat microservices as automatic maturity. They add network calls, observability needs, data consistency problems, and deployment overhead.',
  },
  {
    termId: 'arch-eventual-consistency',
    plainExplanation:
      'Eventual consistency means different parts may disagree for a short time, but they should settle to the same answer after updates finish moving around.',
    technicalExplanation:
      'Eventual consistency allows temporary divergence across replicas or services while asynchronous propagation, retries, or event processing catch up.',
    sayBack:
      'Eventual consistency means the system may lag briefly before every part agrees.',
    commonConfusion:
      'Do not confuse eventual consistency with broken data. It is an intentional tradeoff, but only if the system really converges.',
  },
  {
    termId: 'web-request',
    plainExplanation:
      'A request is one message asking a server for something. Opening a page, submitting a form, or asking for profile data all start with a request.',
    technicalExplanation:
      'An HTTP request includes a method, URL, headers, optional body, credentials, and metadata the server uses to decide what response to return.',
    sayBack:
      'A request is the browser or client asking the server to do or return something.',
    commonConfusion:
      'Do not mix request and response. The request goes out; the response comes back.',
  },
  {
    termId: 'web-response',
    plainExplanation:
      'A response is what the server sends back after a request. It may contain data, an error, a redirect, or instructions for the browser.',
    technicalExplanation:
      'An HTTP response includes a status code, headers, and optional body returned by the server after handling a request.',
    sayBack:
      'A response is the server answer that comes back after a request.',
    commonConfusion:
      'Do not assume every response is success. A response can be a useful error, redirect, or permission denial.',
  },
  {
    termId: 'web-status-code',
    plainExplanation:
      'A status code is the quick number that tells whether a web request worked, failed, redirected, or was not allowed.',
    technicalExplanation:
      'An HTTP status code is a three-digit response marker such as 200, 301, 401, 403, 404, or 500 that classifies the result.',
    sayBack:
      'A status code is the server result number for a web request.',
    commonConfusion:
      'Do not treat all errors the same. 401 means identity problem, 403 means permission problem, and 500 means server problem.',
  },
  {
    termId: 'web-cors',
    plainExplanation:
      'CORS is a browser safety rule about which websites are allowed to call which servers. It often appears when local preview URLs talk to APIs.',
    technicalExplanation:
      'CORS stands for Cross-Origin Resource Sharing. It uses request and response headers to decide whether browser JavaScript can read a cross-origin response.',
    sayBack:
      'CORS is the browser checking whether this page may read that server response.',
    commonConfusion:
      'Do not call every API failure CORS. If curl works but the browser blocks the response, then CORS becomes more likely.',
  },
  {
    termId: 'data-primary-key',
    plainExplanation:
      'A primary key is the unique identity for one row. It keeps the database from confusing one record with another.',
    technicalExplanation:
      'A primary key is a unique non-null column or column set used to identify rows and support references from other tables.',
    sayBack:
      'A primary key is the row identity the database can rely on.',
    commonConfusion:
      'Do not confuse a primary key with a visible name. Names can change or repeat; primary keys are meant to stay unique.',
  },
  {
    termId: 'data-foreign-key',
    plainExplanation:
      'A foreign key is how one row points to another row. It lets separate tables stay connected without copying all the same information.',
    technicalExplanation:
      'A foreign key stores a reference to another table primary key, letting the database enforce relationships and prevent invalid links.',
    sayBack:
      'A foreign key is a database pointer from one row to another table row.',
    commonConfusion:
      'Do not confuse foreign key with join. The foreign key stores the relationship; a join uses relationships to combine data in a query.',
  },
  {
    termId: 'data-join',
    plainExplanation:
      'A join combines related rows from different tables so the app can show richer information in one result.',
    technicalExplanation:
      'A join is a query operation that combines rows from two or more tables using keys or matching conditions.',
    sayBack:
      'A join is how a query brings related tables together.',
    commonConfusion:
      'Do not confuse joining data with copying data. A join reads related rows together; it does not permanently merge the tables.',
  },
  {
    termId: 'data-index',
    plainExplanation:
      'An index helps a database find rows faster, like a lookup guide. It can speed reads but adds work when data changes.',
    technicalExplanation:
      'An index is an auxiliary data structure, often a B-tree or similar structure, that improves lookup, filtering, and sorting performance.',
    sayBack:
      'An index is a database shortcut for finding rows faster.',
    commonConfusion:
      'Do not add indexes blindly. They speed some reads, but they use space and can slow writes.',
  },
  {
    termId: 'os-process',
    plainExplanation:
      'A process is a running program. If a dev server is still using a port, there is usually a process still alive somewhere.',
    technicalExplanation:
      'A process is an OS-managed execution unit with its own memory space, environment, file handles, permissions, and process ID.',
    sayBack:
      'A process is the OS unit for a program that is currently running.',
    commonConfusion:
      'Do not confuse process with thread. A process owns memory and resources; a thread is a path of execution inside a process.',
  },
  {
    termId: 'os-thread',
    plainExplanation:
      'A thread is one path of work inside a running program. Multiple threads can let one program do several things without being several separate programs.',
    technicalExplanation:
      'A thread is a schedulable execution path inside a process, sharing the process memory while carrying its own stack and execution state.',
    sayBack:
      'A thread is one stream of execution inside a process.',
    commonConfusion:
      'Do not treat threads as separate apps. Threads share process memory, which is why coordination bugs can happen.',
  },
  {
    termId: 'os-memory',
    plainExplanation:
      'Memory is the working space a running program uses right now. It is different from storage, which keeps files after the program closes.',
    technicalExplanation:
      'OS memory management allocates virtual memory to processes, maps it to physical RAM or swap, and enforces isolation between processes.',
    sayBack:
      'Memory is active working space for running programs, not long-term storage.',
    commonConfusion:
      'Do not confuse memory with disk space. Running out of memory can crash an app even when the drive has plenty of room.',
  },
  {
    termId: 'sec-oauth',
    plainExplanation:
      'OAuth lets an app use a trusted provider like Google for sign-in or limited access without handling the user password directly.',
    technicalExplanation:
      'OAuth is a delegated authorization protocol involving redirects, clients, scopes, tokens, callbacks, and an identity or authorization provider.',
    sayBack:
      'OAuth is delegated access or sign-in through a trusted provider, without handing over the password.',
    commonConfusion:
      'Do not say OAuth is the same as SSO. OAuth is a protocol pattern; SSO is the user experience of one login reaching many apps.',
  },
  {
    termId: 'sec-sso',
    plainExplanation:
      'SSO means one trusted login opens access to many apps. It is common in companies because identity is managed in one central place.',
    technicalExplanation:
      'SSO stands for single sign-on and is often implemented with OAuth, OIDC, or SAML through an identity provider such as Okta or Microsoft Entra.',
    sayBack:
      'SSO is one trusted identity provider signing a person into multiple apps.',
    commonConfusion:
      'Do not confuse SSO with MFA. SSO says where identity is managed; MFA says the login needs more than one proof.',
  },
  {
    termId: 'flow-rebase',
    plainExplanation:
      'Rebase moves your branch so it starts from a newer point in history. It helps replay your work on top of the latest shared work.',
    technicalExplanation:
      'Rebase rewrites commits by replaying them onto a new base commit, often to keep a branch current before merge or review.',
    sayBack:
      'Rebase means replay this branch on top of a newer starting point.',
    commonConfusion:
      'Do not confuse rebase with merge. Merge combines histories with a merge commit; rebase rewrites your branch history.',
  },
  {
    termId: 'flow-merge',
    plainExplanation:
      'Merge brings work from one branch into another. It is the point where separate work becomes shared work.',
    technicalExplanation:
      'Merge integrates changes from one branch into another, either by creating a merge commit or using a fast-forward when history allows.',
    sayBack:
      'Merge means bring the changes from that branch into this branch.',
    commonConfusion:
      'Do not confuse merge with deploy. Merge changes source history; deploy puts a built version into an environment.',
  },
  {
    termId: 'qa-smoke-test',
    plainExplanation:
      'A smoke test is the quick check that the main thing is alive before doing deeper review. It catches obvious breakage early.',
    technicalExplanation:
      'A smoke test is a shallow validation pass over critical paths after build, deploy, or setup, before deeper regression or exploratory QA.',
    sayBack:
      'A smoke test is the quick first check that the build is not obviously broken.',
    commonConfusion:
      'Do not treat a smoke test as complete QA. It only earns confidence to keep testing.',
  },
  {
    termId: 'qa-regression-test',
    plainExplanation:
      'A regression test checks that something which used to work still works after a change. It protects old wins from new edits.',
    technicalExplanation:
      'A regression test exercises previously working behavior, often tied to a fixed bug or important workflow, to catch accidental breakage.',
    sayBack:
      'A regression test makes sure a change did not break behavior that already worked.',
    commonConfusion:
      'Do not confuse regression testing with only testing old code. New changes can create regressions in existing behavior.',
  },
  {
    termId: 'prod-kpi',
    plainExplanation:
      'A KPI is a number the team watches because it says whether an important outcome is moving. It should connect to a real goal.',
    technicalExplanation:
      'KPI stands for key performance indicator: a tracked metric chosen to represent progress against a business, product, or operational objective.',
    sayBack:
      'A KPI is the key number people watch to judge whether an outcome is improving.',
    commonConfusion:
      'Do not call every metric a KPI. A KPI should be important enough to guide decisions.',
  },
  {
    termId: 'math-big-o',
    plainExplanation:
      'Big O describes how work grows as the input gets bigger. It is about the shape of scaling, not the exact seconds on one machine.',
    technicalExplanation:
      'Big O notation describes asymptotic time or space complexity, such as O(1), O(log n), O(n), O(n log n), or O(n squared).',
    sayBack:
      'Big O tells the growth shape of an algorithm as the input gets larger.',
    commonConfusion:
      'Do not use Big O as a stopwatch. Constant factors and hardware matter, but Big O explains scaling pressure.',
  },
];

// Shown without em dashes or semicolons (Kevin, 2026-11-03), see plainPunctuation.
const CONVERSATION_GUIDE_BY_TERM_ID: Record<string, ConversationGuide> = Object.fromEntries(
  CONVERSATION_GUIDES.map((guide) => [
    guide.termId,
    {
      ...guide,
      plainExplanation: plainPunctuation(guide.plainExplanation),
      technicalExplanation: plainPunctuation(guide.technicalExplanation),
      sayBack: plainPunctuation(guide.sayBack),
      commonConfusion: plainPunctuation(guide.commonConfusion),
    },
  ] as const),
);

export const CONVERSATION_GUIDE_IDS: ReadonlySet<string> = new Set(
  CONVERSATION_GUIDES.map((guide) => guide.termId),
);

export function conversationGuideForTermId(termId: string): ConversationGuide | null {
  return CONVERSATION_GUIDE_BY_TERM_ID[termId] ?? null;
}

const INITIALISM_REPLACEMENTS: Record<string, string> = {
  ai: 'AI',
  ml: 'ML',
  llm: 'LLM',
  llms: 'LLMs',
  api: 'API',
  apis: 'APIs',
  json: 'JSON',
  sql: 'SQL',
  http: 'HTTP',
  url: 'URL',
  urls: 'URLs',
  dns: 'DNS',
  tcp: 'TCP',
  udp: 'UDP',
  vpn: 'VPN',
  tls: 'TLS',
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  ssd: 'SSD',
  pcie: 'PCIe',
  rls: 'RLS',
  ci: 'CI',
  pr: 'PR',
  prs: 'PRs',
  qa: 'QA',
  e2e: 'E2E',
  sso: 'SSO',
  mfa: 'MFA',
  rbac: 'RBAC',
  oauth: 'OAuth',
  rag: 'RAG',
  kpi: 'KPI',
  okr: 'OKR',
  crm: 'CRM',
  erp: 'ERP',
  sla: 'SLA',
  slo: 'SLO',
  mttr: 'MTTR',
  cdn: 'CDN',
  cors: 'CORS',
  jwt: 'JWT',
  mcp: 'MCP',
  cli: 'CLI',
  sdk: 'SDK',
  rest: 'REST',
  db: 'DB',
  os: 'OS',
};

const INITIALISM_RE = new RegExp(
  `\\b(${Object.keys(INITIALISM_REPLACEMENTS).join('|')})\\b`,
  'gi',
);

function normalizeInitialisms(text: string): string {
  return text.replace(INITIALISM_RE, (match) => {
    return INITIALISM_REPLACEMENTS[match.toLowerCase()] ?? match;
  });
}

function ensureSentence(text: string, fallback: string): string {
  const cleaned = normalizeInitialisms((text || fallback).trim().replace(/\s+/g, ' '));
  if (!cleaned) return fallback;
  const capitalized = cleaned.replace(/^([a-z])/, (letter) => letter.toUpperCase());
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function stripFinalPunctuation(text: string): string {
  return text.replace(/[.!?]+$/, '');
}

function displayTerm(term: string): string {
  return normalizeInitialisms(term.trim() || 'this term');
}

export function conversationGuideForTerm(term: ConversationGuideTerm): ConversationGuide {
  const curated = conversationGuideForTermId(term.id);
  if (curated) return curated;

  const name = displayTerm(term.term);
  const oneLine = ensureSentence(
    term.one_line_definition,
    `${name} is a technical concept worth naming precisely.`,
  );
  const longDefinition = ensureSentence(term.long_definition, oneLine);
  const whyItMatters = term.why_it_matters
    ? ensureSentence(term.why_it_matters, '')
    : '';
  const firstDistractor = term.multiple_choice_distractors?.find((distractor) => {
    return distractor.trim().length > 0 && distractor.toLowerCase() !== term.term.toLowerCase();
  });
  const contrast = firstDistractor ? displayTerm(firstDistractor) : 'a nearby term';
  const oneLineFragment = stripFinalPunctuation(oneLine);

  return {
    termId: term.id,
    plainExplanation: `${oneLine} Use this when someone is naming the specific idea, not just gesturing at technology in general.`,
    technicalExplanation: whyItMatters
      ? `Technically, ${longDefinition} The practical signal is this: ${whyItMatters}`
      : `Technically, ${longDefinition} The practical signal is whether this idea changes how a system is designed, debugged, shipped, or explained.`,
    sayBack: `I would say "${name}" when I mean this: ${oneLineFragment}.`,
    commonConfusion: `Do not mix ${name} with ${contrast}. ${name} points to this specific idea: ${oneLineFragment}.`,
  };
}
