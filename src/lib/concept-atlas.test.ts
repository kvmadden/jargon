import { describe, expect, it } from 'vitest';
import {
  CONCEPT_ATLAS,
  allAtlasConcepts,
  atlasLaneById,
  conceptAtlasSummary,
} from './concept-atlas';

const REQUIRED_LANES = [
  'ai-llms-agents',
  'machine-learning-data-science',
  'coding-programming',
  'languages-runtimes-frameworks',
  'software-architecture',
  'web-apps-apis',
  'data-databases',
  'cloud-devops',
  'operating-systems',
  'hardware-computing',
  'networking-internet',
  'security-privacy',
  'systems-engineering',
  'qa-reliability',
  'dev-workflow-tools',
  'github-terminal-automation',
  'microsoft-365-dataverse',
  'azure-cloud-identity',
  'copilot-claude-agent-tools',
  'ai-platforms-and-model-labs',
  'ai-coding-agents-and-app-builders',
  'content-freshness-and-feedback',
  'excel-bi-fabric-analytics',
  'product-enterprise',
  'math-logic-computation',
] as const;

const REQUIRED_PRONUNCIATIONS = [
  ['ai-llm', 'LLM', 'L-L-M'],
  ['ai-rag', 'RAG', 'rag'],
  ['ai-structured-output', 'JSON', 'jay-sawn'],
  ['arch-api', 'API', 'A-P-I'],
  ['web-url', 'URL', 'U-R-L'],
  ['web-status-code', 'HTTP', 'H-T-T-P'],
  ['web-cors', 'CORS', 'cores'],
  ['cloud-cdn', 'CDN', 'C-D-N'],
  ['hw-cpu', 'CPU', 'C-P-U'],
  ['hw-gpu', 'GPU', 'G-P-U'],
  ['hw-ram', 'RAM', 'ram'],
  ['hw-ssd', 'SSD', 'S-S-D'],
  ['hw-pcie', 'PCIe', 'P-C-I-E'],
  ['hw-bios-uefi', 'BIOS/UEFI', 'BYE-oss / U-E-F-I'],
  ['hw-arm', 'ARM', 'arm'],
  ['net-ip-address', 'IP', 'I-P'],
  ['net-dns', 'DNS', 'D-N-S'],
  ['net-tcp', 'TCP', 'T-C-P'],
  ['net-udp', 'UDP', 'U-D-P'],
  ['net-vpn', 'VPN', 'V-P-N'],
  ['net-tls', 'TLS', 'T-L-S'],
  ['sec-rbac', 'RBAC', 'R-back'],
  ['sec-oauth', 'OAuth', 'oh-auth'],
  ['sec-sso', 'SSO', 'S-S-O'],
  ['sec-mfa', 'MFA', 'M-F-A'],
  ['se-fmea', 'FMEA', 'F-M-E-A'],
  ['qa-e2e-test', 'E2E', 'E-to-E'],
  ['qa-sla', 'SLA', 'S-L-A'],
  ['qa-slo', 'SLO', 'S-L-O'],
  ['qa-mttr', 'MTTR', 'M-T-T-R'],
  ['flow-pull-request', 'PR', 'P-R'],
  ['flow-ci', 'CI', 'C-I'],
  ['prod-kpi', 'KPI', 'K-P-I'],
  ['prod-okr', 'OKR', 'O-K-R'],
  ['prod-crm', 'CRM', 'C-R-M'],
  ['prod-erp', 'ERP', 'E-R-P'],
  ['prod-sso', 'SSO', 'S-S-O'],
  ['math-big-o', 'Big O', 'big oh'],
  ['lang-cpp', 'C++', 'C-plus-plus'],
  ['lang-csharp', 'C#', 'C-sharp'],
  ['lang-html', 'HTML', 'H-T-M-L'],
  ['lang-css', 'CSS', 'C-S-S'],
  ['lang-sql', 'SQL', 'sequel or S-Q-L'],
  ['runtime-nodejs', 'Node.js', 'node J-S'],
  ['tool-npm', 'npm', 'N-P-M'],
  ['tool-pnpm', 'pnpm', 'P-N-P-M'],
  ['fw-nextjs', 'Next.js', 'next J-S'],
  ['ms365-tenant', 'Microsoft 365', 'Microsoft three-sixty-five'],
  ['ms365-entra', 'ID', 'EN-truh I-D'],
  ['az-rbac', 'RBAC', 'R-back'],
  ['gh-actions', 'GitHub Actions', 'GitHub Actions'],
  ['cc-mcp', 'MCP', 'M-C-P'],
  ['cc-sdk', 'SDK', 'S-D-K'],
  ['aip-api-key', 'API', 'A-P-I key'],
  ['aip-sdk', 'SDK', 'S-D-K'],
  ['aip-aws-bedrock', 'AWS', 'A-W-S Bedrock'],
  ['aica-ide', 'IDE', 'I-D-E'],
  ['freshness-llms-txt', 'llms.txt', 'L-L-M-S dot text'],
  ['ent-powerbi', 'Power BI', 'POW-er B-I'],
  ['bi-dax', 'DAX', 'D-A-X'],
  ['fabric-onelake', 'OneLake', 'one lake'],
  ['fabric-dataflow-gen2', 'Dataflow Gen2', 'dataflow gen two'],
  ['fabric-direct-lake', 'Direct Lake', 'direct lake'],
] as const;

const REQUIRED_ATLAS_EXPANSIONS = [
  ['ai-llm', 'large language model'],
  ['ai-rag', 'retrieval-augmented generation'],
  ['ai-structured-output', 'JavaScript Object Notation'],
  ['arch-api', 'Application Programming Interface'],
  ['web-url', 'Uniform Resource Locator'],
  ['web-status-code', 'Hypertext Transfer Protocol'],
  ['web-cors', 'Cross-Origin Resource Sharing'],
  ['cloud-cdn', 'content delivery network'],
  ['hw-cpu', 'central processing unit'],
  ['hw-gpu', 'graphics processing unit'],
  ['hw-ram', 'random-access memory'],
  ['hw-ssd', 'solid-state drive'],
  ['hw-pcie', 'Peripheral Component Interconnect Express'],
  ['hw-bios-uefi', 'Basic Input/Output System'],
  ['hw-bios-uefi', 'Unified Extensible Firmware Interface'],
  ['hw-arm', 'Advanced RISC Machines'],
  ['net-ip-address', 'Internet Protocol'],
  ['net-dns', 'Domain Name System'],
  ['net-tcp', 'Transmission Control Protocol'],
  ['net-udp', 'User Datagram Protocol'],
  ['net-vpn', 'virtual private network'],
  ['net-tls', 'Transport Layer Security'],
  ['sec-rbac', 'role-based access control'],
  ['sec-oauth', 'Open Authorization'],
  ['sec-sso', 'single sign-on'],
  ['sec-mfa', 'multi-factor authentication'],
  ['se-fmea', 'failure mode and effects analysis'],
  ['qa-e2e-test', 'end-to-end'],
  ['qa-sla', 'service-level agreement'],
  ['qa-slo', 'service-level objective'],
  ['qa-mttr', 'mean time to recovery'],
  ['flow-pull-request', 'pull request'],
  ['flow-ci', 'Continuous Integration'],
  ['prod-kpi', 'key performance indicator'],
  ['prod-okr', 'objectives and key results'],
  ['prod-crm', 'customer relationship management'],
  ['prod-erp', 'enterprise resource planning'],
  ['prod-sso', 'single sign-on'],
  ['lang-html', 'HyperText Markup Language'],
  ['lang-css', 'Cascading Style Sheets'],
  ['lang-sql', 'Structured Query Language'],
  ['runtime-nodejs', 'JavaScript runtime'],
  ['ms365-tenant', 'Microsoft 365'],
  ['ms365-entra', 'Microsoft Entra ID'],
  ['az-resource-manager', 'Azure Resource Manager'],
  ['az-rbac', 'role-based access control'],
  ['cc-mcp', 'Model Context Protocol'],
  ['cc-sdk', 'Software Development Kit'],
  ['aip-api-key', 'Application Programming Interface'],
  ['aip-sdk', 'Software Development Kit'],
  ['aica-ide', 'integrated development environment'],
  ['freshness-rag', 'retrieval-augmented generation'],
  ['freshness-llms-txt', 'large language model'],
  ['bi-dax', 'Data Analysis Expressions'],
  ['excel-power-query', 'Power Query'],
  ['bi-rls', 'row-level security'],
  ['fabric-microsoft-fabric', 'Microsoft Fabric'],
] as const;

const SEEDED_COMPUTING_FOUNDATION_IDS = [
  'hw-cpu',
  'hw-gpu',
  'hw-core',
  'hw-clock-speed',
  'hw-cache',
  'hw-ram',
  'hw-ssd',
  'hw-bus',
  'hw-pcie',
  'hw-motherboard',
  'hw-firmware',
  'hw-bios-uefi',
  'hw-instruction-set',
  'hw-arm',
  'hw-soc',
  'os-process',
  'os-thread',
  'os-kernel',
  'os-system-call',
  'os-filesystem',
  'os-shell',
  'os-environment-variable',
  'os-daemon',
  'os-deadlock',
] as const;

const SEEDED_NETWORKING_FOUNDATION_IDS = [
  'net-ip-address',
  'net-dns',
  'net-port',
  'net-socket',
  'net-tcp',
  'net-udp',
  'net-packet',
  'net-router',
  'net-gateway',
  'net-latency',
  'net-bandwidth',
  'net-throughput',
  'net-vpn',
  'net-tls',
  'net-certificate',
] as const;

const SEEDED_SECURITY_FOUNDATION_IDS = [
  'sec-permission',
  'sec-role',
  'sec-rbac',
  'sec-oauth',
  'sec-mfa',
  'sec-encryption',
  'sec-hash',
  'sec-secret',
  'sec-threat-model',
  'sec-attack-surface',
  'sec-vulnerability',
  'sec-zero-trust',
] as const;

const SEEDED_OS_SECURITY_COMPLETION_IDS = [
  'os-path',
  'os-permission',
  'os-memory',
  'os-heap',
  'os-garbage-collection',
  'os-scheduler',
  'sec-sso',
] as const;

const SEEDED_MACHINE_LEARNING_FOUNDATION_IDS = [
  'ml-training-data',
  'ml-label',
  'ml-feature',
  'ml-model',
  'ml-inference',
  'ml-classification',
  'ml-regression',
  'ml-overfitting',
  'ml-generalization',
  'ml-validation-set',
  'ml-test-set',
  'ml-precision',
  'ml-recall',
  'ml-gradient-descent',
  'ml-loss-function',
] as const;

const SEEDED_SOFTWARE_ARCHITECTURE_FOUNDATION_IDS = [
  'arch-api',
  'arch-interface',
  'arch-abstraction',
  'arch-service',
  'arch-monolith',
  'arch-microservice',
  'arch-coupling',
  'arch-cohesion',
  'arch-dependency-injection',
  'arch-event-driven',
  'arch-message-bus',
  'arch-idempotency-key',
  'arch-consistency',
  'arch-eventual-consistency',
  'arch-service-boundary',
] as const;

const SEEDED_CLOUD_DEVOPS_FOUNDATION_IDS = [
  'cloud-deploy',
  'cloud-environment',
  'cloud-container',
  'cloud-image',
  'cloud-kubernetes',
  'cloud-serverless',
  'cloud-edge',
  'cloud-cdn',
  'cloud-cache',
  'cloud-load-balancer',
  'cloud-autoscaling',
  'cloud-observability',
  'cloud-log',
  'cloud-metric',
  'cloud-alert',
] as const;

const SEEDED_SYSTEMS_ENGINEERING_FOUNDATION_IDS = [
  'se-requirement',
  'se-constraint',
  'se-tradeoff',
  'se-interface-control',
  'se-system-boundary',
  'se-stakeholder',
  'se-use-case',
  'se-verification',
  'se-validation',
  'se-traceability',
  'se-fmea',
  'se-hazard-analysis',
  'se-control-loop',
  'se-feedback',
  'se-lifecycle',
] as const;

const SEEDED_QA_RELIABILITY_FOUNDATION_IDS = [
  'qa-unit-test',
  'qa-integration-test',
  'qa-e2e-test',
  'qa-smoke-test',
  'qa-regression-test',
  'qa-flaky-test',
  'qa-test-coverage',
  'qa-fixture',
  'qa-mock',
  'qa-sla',
  'qa-slo',
  'qa-error-budget',
  'qa-mttr',
  'qa-postmortem',
  'qa-root-cause',
] as const;

const SEEDED_DEVELOPER_WORKFLOW_FOUNDATION_IDS = [
  'flow-repository',
  'flow-branch',
  'flow-commit',
  'flow-diff',
  'flow-pull-request',
  'flow-code-review',
  'flow-rebase',
  'flow-merge',
  'flow-conflict',
  'flow-ci',
  'flow-build',
  'flow-artifact',
  'flow-localhost',
  'flow-port',
  'flow-debugger',
] as const;

const SEEDED_PRODUCT_ENTERPRISE_FOUNDATION_IDS = [
  'prod-roadmap',
  'prod-milestone',
  'prod-backlog',
  'prod-ticket',
  'prod-epic',
  'prod-story',
  'prod-acceptance-criteria',
  'prod-kpi',
  'prod-okr',
  'prod-crm',
  'prod-erp',
  'prod-system-of-record',
  'prod-sso',
  'prod-audit-log',
  'prod-compliance',
] as const;

const SEEDED_MATH_LOGIC_COMPUTATION_FOUNDATION_IDS = [
  'math-boolean',
  'math-set',
  'math-graph',
  'math-node',
  'math-edge',
  'math-tree',
  'math-complexity',
  'math-big-o',
  'math-probability',
  'math-distribution',
  'math-entropy',
  'math-optimization',
  'math-constraint',
  'math-state-machine',
  'math-turing-complete',
] as const;

const SEEDED_CODING_PROGRAMMING_FOUNDATION_IDS = [
  'code-variable',
  'code-function',
  'code-parameter',
  'code-argument',
  'code-type',
  'code-object',
  'code-array',
  'code-loop',
  'code-conditional',
  'code-exception',
  'code-stack-trace',
  'code-module',
  'code-import',
  'code-recursion',
  'code-algorithm',
] as const;

const SEEDED_LANGUAGE_RUNTIME_FRAMEWORK_IDS = [
  'lang-javascript',
  'lang-typescript',
  'lang-python',
  'lang-rust',
  'lang-c',
  'lang-cpp',
  'lang-csharp',
  'lang-java',
  'lang-go',
  'lang-swift',
  'lang-kotlin',
  'lang-html',
  'lang-css',
  'lang-sql',
  'lang-bash',
  'runtime-nodejs',
  'tool-npm',
  'tool-pnpm',
  'tool-vite',
  'fw-react',
  'fw-nextjs',
  'fw-vue',
  'fw-svelte',
  'data-postgres',
  'data-redis',
  'data-supabase',
  'cloud-vercel',
  'tool-copilot',
  'tool-playwright',
  'tool-vitest',
] as const;

const SEEDED_PLATFORM_OPERATING_SYSTEM_IDS = [
  'cli-terminal',
  'cli-bash',
  'cli-cd',
  'cli-ls',
  'cli-grep',
  'cli-pipe',
  'cli-sudo',
  'cli-cat',
  'cli-mv',
  'cli-rm',
  'cli-manpage',
  'git-commit',
  'git-push',
  'git-pr',
  'git-branch',
  'git-merge',
  'git-pull',
  'git-fetch',
  'git-clone',
  'git-fork',
  'git-diff',
  'git-stash',
  'git-log',
  'git-rebase',
  'git-conflict',
  'git-remote',
  'git-origin',
  'git-head',
  'git-tag',
  'git-checkout',
  'gh-actions',
  'gh-workflow',
  'gh-runner',
  'ms365-tenant',
  'ms365-admin-center',
  'ms365-license',
  'ms365-group',
  'ms365-sharepoint-site',
  'ms365-entra',
  'pp-environment',
  'pp-power-apps',
  'pp-power-automate',
  'pp-connector',
  'dv-dataverse',
  'dv-table',
  'dv-column',
  'dv-solution',
  'az-subscription',
  'az-resource-group',
  'az-resource-manager',
  'az-key-vault',
  'az-managed-identity',
  'az-rbac',
  'copilot-studio',
  'copilot-agent',
  'copilot-topic',
  'copilot-action',
  'copilot-knowledge-source',
  'copilot-connector',
  'cc-subagent',
  'cc-tool-use',
  'cc-task-tool',
  'cc-mcp',
  'cc-mcp-server',
  'cc-mcp-client',
  'cc-skill',
  'cc-hook',
  'cc-plugin',
  'cc-permission-mode',
  'cc-plan-mode',
  'cc-permissions',
  'cc-claude-md',
  'cc-memory',
  'cc-system-prompt',
  'cc-bash-tool',
  'cc-file-tools',
  'cc-search-tools',
  'cc-web-tools',
  'cc-todowrite',
  'cc-askuserquestion',
  'cc-settings-json',
  'cc-background-task',
  'cc-sdk',
  'cc-token',
  'cc-context-window',
  'cc-caching',
] as const;

const SEEDED_ANALYTICS_FABRIC_IDS = [
  'excel-workbook',
  'excel-worksheet',
  'excel-cell',
  'excel-range',
  'excel-table',
  'excel-formula',
  'excel-function',
  'excel-pivot-table',
  'excel-power-query',
  'excel-power-pivot',
  'ent-powerbi',
  'bi-report',
  'bi-dashboard',
  'bi-workspace',
  'bi-semantic-model',
  'bi-measure',
  'bi-dax',
  'bi-calculated-column',
  'bi-slicer',
  'bi-refresh',
  'bi-gateway',
  'bi-rls',
  'fabric-microsoft-fabric',
  'fabric-onelake',
  'fabric-lakehouse',
  'fabric-warehouse',
  'fabric-notebook',
  'fabric-data-pipeline',
  'fabric-dataflow-gen2',
  'fabric-direct-lake',
  'sys-api-gateway',
  'sys-websocket',
  'sys-graphql',
] as const;

const SEEDED_WEB_APP_API_FOUNDATION_IDS = [
  'web-url',
  'web-domain',
  'web-route',
  'web-request',
  'web-response',
  'web-status-code',
  'web-header',
  'web-body',
  'web-cookie',
  'web-session',
  'web-cors',
  'web-origin',
  'web-webhook',
  'web-spa',
  'web-ssr',
] as const;

const SEEDED_DATA_DATABASE_FOUNDATION_IDS = [
  'data-table',
  'data-row',
  'data-column',
  'data-primary-key',
  'data-foreign-key',
  'data-join',
  'data-index',
  'data-query-plan',
  'data-transaction',
  'data-migration',
  'data-backfill',
  'data-normalization',
  'data-denormalization',
  'data-warehouse',
  'data-lake',
] as const;

const SEEDED_AI_AGENT_FOUNDATION_IDS = [
  'ai-agent',
  'ai-tool-call',
  'ai-function-calling',
  'ai-rag',
  'ai-embedding',
  'ai-vector-store',
  'ai-hallucination',
  'ai-grounding',
  'ai-structured-output',
  'ai-evals',
  'ai-guardrails',
] as const;

describe('concept atlas', () => {
  it('casts a wide technical net across the major lanes Kevin asked for', () => {
    expect(CONCEPT_ATLAS.length).toBeGreaterThanOrEqual(22);
    expect(allAtlasConcepts.length).toBeGreaterThanOrEqual(600);

    for (const laneId of REQUIRED_LANES) {
      const lane = atlasLaneById(laneId);
      expect(lane, `${laneId} missing`).toBeTruthy();
      expect(lane?.concepts.length, `${laneId} is too thin`).toBeGreaterThanOrEqual(12);
    }
  });

  it('keeps concept ids unique and stable-looking', () => {
    const ids = allAtlasConcepts.map((concept) => concept.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('gives every concept enough plainspoken context to become lesson content later', () => {
    for (const concept of allAtlasConcepts) {
      expect(concept.term.trim(), `${concept.id} missing term`).not.toHaveLength(0);
      expect(concept.plainMeaning.trim().length, `${concept.id} needs meaning`).toBeGreaterThan(16);
      expect(concept.whyKevinCares.trim().length, `${concept.id} needs why`).toBeGreaterThan(24);
      expect(['seeded', 'candidate', 'priority-core', 'needs-curation']).toContain(concept.status);
      expect(concept.laneId.trim(), `${concept.id} missing lane id`).not.toHaveLength(0);
    }
  });

  it('keeps initialisms and acronyms visibly cased and teaches how to say them', () => {
    for (const [id, visibleText, pronunciation] of REQUIRED_PRONUNCIATIONS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(
        `${concept?.term} ${concept?.plainMeaning}`,
        `${id} should show ${visibleText} with correct casing`,
      ).toContain(visibleText);
      expect(concept?.pronunciation, `${id} needs pronunciation`).toBe(pronunciation);
    }
  });

  it('spells out acronym and initialism meanings in the atlas', () => {
    for (const [id, expansion] of REQUIRED_ATLAS_EXPANSIONS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);
      const visibleText = `${concept?.term} ${concept?.plainMeaning}`.toLowerCase();

      expect(concept, `${id} missing`).toBeTruthy();
      expect(visibleText, `${id} should explain "${expansion}"`).toContain(
        expansion.toLowerCase(),
      );
    }
  });

  it('uses proper casing in lane labels when the label contains an initialism', () => {
    expect(atlasLaneById('ai-llms-agents')?.title).toBe('AI, LLMs, and agents');
    expect(atlasLaneById('qa-reliability')?.title).toBe('QA and reliability');
    expect(atlasLaneById('ai-platforms-and-model-labs')?.title).toBe(
      'AI platforms and model labs',
    );
  });

  it('adds current AI platforms, coding agents, and freshness terms as source-backed candidates', () => {
    const requiredIds = [
      'aip-openai-platform',
      'aip-chatgpt',
      'aip-codex',
      'aip-anthropic-claude',
      'aip-claude-code',
      'aip-google-gemini',
      'aip-vertex-ai',
      'aip-microsoft-foundry',
      'aip-copilot-studio',
      'aip-aws-bedrock',
      'aip-hugging-face',
      'aip-mistral-ai',
      'aip-cohere',
      'aip-meta-llama',
      'aip-xai-grok',
      'aip-perplexity',
      'aica-github-copilot',
      'aica-cursor',
      'aica-windsurf',
      'aica-replit-agent',
      'aica-devin',
      'aica-lovable',
      'aica-ollama',
      'aica-lm-studio',
      'freshness-official-docs',
      'freshness-source-ledger',
      'freshness-solo-feedback',
      'freshness-ai-draft',
      'freshness-human-approval',
      'freshness-review-cadence',
    ] as const;

    for (const id of requiredIds) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);
      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should start as a candidate`).toBe('candidate');
    }
  });

  it('marks promoted hardware and operating-system lessons as seeded', () => {
    for (const id of SEEDED_COMPUTING_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted networking lessons as seeded', () => {
    for (const id of SEEDED_NETWORKING_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted security lessons as seeded', () => {
    for (const id of SEEDED_SECURITY_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted OS/security completion lessons as seeded', () => {
    for (const id of SEEDED_OS_SECURITY_COMPLETION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted machine learning lessons as seeded', () => {
    for (const id of SEEDED_MACHINE_LEARNING_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted software architecture lessons as seeded', () => {
    for (const id of SEEDED_SOFTWARE_ARCHITECTURE_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted cloud/devops lessons as seeded', () => {
    for (const id of SEEDED_CLOUD_DEVOPS_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted systems-engineering lessons as seeded', () => {
    for (const id of SEEDED_SYSTEMS_ENGINEERING_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted QA/reliability lessons as seeded', () => {
    for (const id of SEEDED_QA_RELIABILITY_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted developer-workflow lessons as seeded', () => {
    for (const id of SEEDED_DEVELOPER_WORKFLOW_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted product/enterprise lessons as seeded', () => {
    for (const id of SEEDED_PRODUCT_ENTERPRISE_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted math/logic/computation lessons as seeded', () => {
    for (const id of SEEDED_MATH_LOGIC_COMPUTATION_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted coding/programming lessons as seeded', () => {
    for (const id of SEEDED_CODING_PROGRAMMING_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted languages, runtimes, frameworks, and daily tools as seeded', () => {
    for (const id of SEEDED_LANGUAGE_RUNTIME_FRAMEWORK_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted platform operating-system terms as seeded', () => {
    for (const id of SEEDED_PLATFORM_OPERATING_SYSTEM_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted Excel, BI, Fabric, and API style terms as seeded', () => {
    for (const id of SEEDED_ANALYTICS_FABRIC_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted web/API lessons as seeded', () => {
    for (const id of SEEDED_WEB_APP_API_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted data/database lessons as seeded', () => {
    for (const id of SEEDED_DATA_DATABASE_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('marks promoted AI agent lessons as seeded', () => {
    for (const id of SEEDED_AI_AGENT_FOUNDATION_IDS) {
      const concept = allAtlasConcepts.find((candidate) => candidate.id === id);

      expect(concept, `${id} missing`).toBeTruthy();
      expect(concept?.status, `${id} should be seeded after promotion`).toBe('seeded');
    }
  });

  it('summarizes the map for the route without recomputing in React', () => {
    const summary = conceptAtlasSummary();

    expect(summary.totalLanes).toBe(CONCEPT_ATLAS.length);
    expect(summary.totalConcepts).toBe(allAtlasConcepts.length);
    expect(summary.statusCounts.seeded).toBeGreaterThanOrEqual(385);
    expect(summary.statusCounts.candidate ?? 0).toBeGreaterThanOrEqual(210);
    expect(summary.statusCounts.seeded + summary.statusCounts.candidate).toBe(
      allAtlasConcepts.length,
    );
    expect(summary.statusCounts['priority-core'] ?? 0).toBe(0);
    expect(summary.statusCounts['needs-curation'] ?? 0).toBe(0);
  });
});
