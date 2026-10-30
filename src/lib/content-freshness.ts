export type SourceCategory =
  | 'model-lab'
  | 'cloud-ai'
  | 'assistant'
  | 'coding-agent'
  | 'app-builder'
  | 'local-ai'
  | 'framework';

export type FreshnessStatus = 'fresh' | 'review-soon' | 'stale';

export interface SourceRecord {
  id: string;
  displayName: string;
  category: SourceCategory;
  officialSourceUrl: string;
  reviewedOn: string;
  reviewCadenceDays: number;
  conceptIds: string[];
  whyItMoves: string;
}

export const SOURCE_REVIEWED_ON = '2026-05-30';

export const AI_PLATFORM_SOURCE_RECORDS: SourceRecord[] = [
  {
    id: 'src-openai-platform',
    displayName: 'OpenAI Platform',
    category: 'cloud-ai',
    officialSourceUrl: 'https://developers.openai.com/api/docs/guides/agents',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-openai-platform', 'aip-responses-api', 'aip-agents-sdk'],
    whyItMoves: 'model names, agent surfaces, SDKs, and API patterns change quickly.',
  },
  {
    id: 'src-chatgpt-codex',
    displayName: 'ChatGPT and Codex',
    category: 'assistant',
    officialSourceUrl: 'https://developers.openai.com/codex',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-chatgpt', 'aip-codex'],
    whyItMoves: 'assistant surfaces, coding workflows, and product names are active.',
  },
  {
    id: 'src-anthropic-claude',
    displayName: 'Anthropic Claude',
    category: 'model-lab',
    officialSourceUrl: 'https://platform.claude.com/docs/en/home',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-anthropic-claude', 'aip-claude-api'],
    whyItMoves: 'Claude model names, managed agents, and API capabilities keep moving.',
  },
  {
    id: 'src-claude-code',
    displayName: 'Claude Code',
    category: 'coding-agent',
    officialSourceUrl: 'https://code.claude.com/docs/en/overview',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-claude-code', 'aica-terminal-agent'],
    whyItMoves: 'coding-agent surfaces, installers, IDE support, and permissions change often.',
  },
  {
    id: 'src-google-gemini-api',
    displayName: 'Google Gemini API',
    category: 'model-lab',
    officialSourceUrl: 'https://ai.google.dev/gemini-api/docs',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-google-gemini', 'aip-google-ai-studio'],
    whyItMoves: 'Gemini model names, media models, tools, and API entrypoints move quickly.',
  },
  {
    id: 'src-google-vertex-ai',
    displayName: 'Google Vertex AI',
    category: 'cloud-ai',
    officialSourceUrl: 'https://docs.cloud.google.com/vertex-ai/generative-ai/docs',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['aip-vertex-ai', 'aip-model-garden'],
    whyItMoves: 'cloud model catalogs, partner models, and deployment options shift.',
  },
  {
    id: 'src-microsoft-foundry',
    displayName: 'Microsoft Foundry',
    category: 'cloud-ai',
    officialSourceUrl: 'https://learn.microsoft.com/en-us/azure/foundry/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-microsoft-foundry', 'aip-model-garden'],
    whyItMoves: 'Microsoft AI naming, agent services, and Azure product boundaries are active.',
  },
  {
    id: 'src-copilot-studio',
    displayName: 'Copilot Studio',
    category: 'app-builder',
    officialSourceUrl: 'https://learn.microsoft.com/en-us/microsoft-copilot-studio/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-copilot-studio', 'aip-microsoft-365-copilot'],
    whyItMoves: 'Copilot agent, action, MCP, evaluation, and publishing language changes often.',
  },
  {
    id: 'src-amazon-bedrock',
    displayName: 'Amazon Bedrock',
    category: 'cloud-ai',
    officialSourceUrl: 'https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['aip-aws-bedrock', 'aip-inference-provider'],
    whyItMoves: 'provider rosters, supported models, and AWS service capabilities update often.',
  },
  {
    id: 'src-hugging-face',
    displayName: 'Hugging Face',
    category: 'cloud-ai',
    officialSourceUrl: 'https://huggingface.co/docs',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['aip-hugging-face', 'aip-inference-provider', 'aip-open-weight-model'],
    whyItMoves: 'model hosting, datasets, Spaces, inference providers, and ML libraries evolve.',
  },
  {
    id: 'src-mistral-ai',
    displayName: 'Mistral AI',
    category: 'model-lab',
    officialSourceUrl: 'https://docs.mistral.ai/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-mistral-ai', 'aip-mistral-vibe'],
    whyItMoves: 'Mistral model names, Studio, Vibe, and agent features are active.',
  },
  {
    id: 'src-cohere',
    displayName: 'Cohere',
    category: 'model-lab',
    officialSourceUrl: 'https://docs.cohere.com/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['aip-cohere', 'aip-reranker'],
    whyItMoves: 'chat, embed, rerank, and enterprise AI docs are versioned surfaces.',
  },
  {
    id: 'src-meta-llama',
    displayName: 'Meta Llama',
    category: 'model-lab',
    officialSourceUrl: 'https://ai.meta.com/llama/get-started/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['aip-meta-llama', 'aip-open-weight-model'],
    whyItMoves: 'Llama model generations and access routes change across Meta and partners.',
  },
  {
    id: 'src-xai-grok',
    displayName: 'xAI Grok',
    category: 'model-lab',
    officialSourceUrl: 'https://docs.x.ai/overview',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-xai-grok', 'aip-model-family'],
    whyItMoves: 'Grok model names, tool support, image, video, and voice APIs are active.',
  },
  {
    id: 'src-perplexity',
    displayName: 'Perplexity',
    category: 'assistant',
    officialSourceUrl: 'https://docs.perplexity.ai/docs/getting-started/overview',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-perplexity', 'aip-embedding-api'],
    whyItMoves: 'real-time search, Sonar, embeddings, and agent APIs change frequently.',
  },
  {
    id: 'src-github-copilot',
    displayName: 'GitHub Copilot',
    category: 'coding-agent',
    officialSourceUrl: 'https://docs.github.com/en/copilot',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aica-github-copilot', 'aica-pair-programmer'],
    whyItMoves: 'coding assistant, review, agent, and governance features keep expanding.',
  },
  {
    id: 'src-cursor',
    displayName: 'Cursor',
    category: 'coding-agent',
    officialSourceUrl: 'https://cursor.com/docs',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aica-cursor', 'aica-ide'],
    whyItMoves: 'editor-agent features, rules, MCP, and CLI behavior move quickly.',
  },
  {
    id: 'src-windsurf',
    displayName: 'Windsurf',
    category: 'coding-agent',
    officialSourceUrl: 'https://docs.windsurf.com/windsurf/getting-started',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aica-windsurf', 'aica-cascade'],
    whyItMoves: 'Cascade, agent command center, MCP, memories, and deploy features are active.',
  },
  {
    id: 'src-replit-agent',
    displayName: 'Replit Agent',
    category: 'app-builder',
    officialSourceUrl: 'https://docs.replit.com/references/agent/overview',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aica-replit-agent', 'aica-app-builder'],
    whyItMoves: 'agent modes, artifacts, app testing, deployment, and data features change.',
  },
  {
    id: 'src-devin',
    displayName: 'Devin',
    category: 'coding-agent',
    officialSourceUrl: 'https://docs.devin.ai/get-started/devin-intro',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aica-devin', 'aica-terminal-agent'],
    whyItMoves: 'autonomous coding-agent workflows are early and change quickly.',
  },
  {
    id: 'src-lovable',
    displayName: 'Lovable',
    category: 'app-builder',
    officialSourceUrl: 'https://docs.lovable.dev/introduction/welcome',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aica-lovable', 'aica-prompt-to-app'],
    whyItMoves: 'prompt-to-app, GitHub sync, deploy, governance, and app-builder language evolves.',
  },
  {
    id: 'src-ollama',
    displayName: 'Ollama',
    category: 'local-ai',
    officialSourceUrl: 'https://docs.ollama.com/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['aica-ollama', 'aica-local-model'],
    whyItMoves: 'local model support, cloud models, tool calling, and integrations shift.',
  },
  {
    id: 'src-lm-studio',
    displayName: 'LM Studio',
    category: 'local-ai',
    officialSourceUrl: 'https://lmstudio.ai/docs/app',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['aica-lm-studio', 'aica-local-model'],
    whyItMoves: 'local-model app surfaces and OpenAI-compatible server behavior evolve.',
  },
  {
    id: 'src-vercel-ai-sdk',
    displayName: 'Vercel AI SDK',
    category: 'framework',
    officialSourceUrl: 'https://ai-sdk.dev/docs/introduction',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aica-model-provider-switching', 'aip-sdk'],
    whyItMoves: 'providers, agent APIs, UI hooks, and major versions move with the ecosystem.',
  },
  {
    id: 'src-vercel-ai-gateway',
    displayName: 'Vercel AI Gateway',
    category: 'framework',
    officialSourceUrl: 'https://vercel.com/docs/ai-gateway',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 30,
    conceptIds: ['aip-provider', 'aip-inference-provider'],
    whyItMoves: 'model routing, provider support, fallbacks, and gateway behavior are active.',
  },
  {
    id: 'src-langchain-langgraph',
    displayName: 'LangChain and LangGraph',
    category: 'framework',
    officialSourceUrl: 'https://docs.langchain.com/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['freshness-rag', 'aip-provider'],
    whyItMoves: 'agent orchestration, retrieval, tracing, and deployment docs change often.',
  },
  {
    id: 'src-llamaindex',
    displayName: 'LlamaIndex',
    category: 'framework',
    officialSourceUrl: 'https://developers.llamaindex.ai/python/framework/',
    reviewedOn: SOURCE_REVIEWED_ON,
    reviewCadenceDays: 45,
    conceptIds: ['freshness-rag', 'freshness-source-ledger'],
    whyItMoves: 'RAG indexing, data connectors, agents, and framework APIs are active.',
  },
];

export type FeedbackCategory =
  | 'wrong'
  | 'confusing'
  | 'outdated'
  | 'missing'
  | 'acronym'
  | 'pronunciation'
  | 'source'
  | 'analogy';

export const FEEDBACK_DRAFT_INTENTS: Record<FeedbackCategory, string> = {
  wrong: 'draft-correction-with-source-check',
  confusing: 'rewrite-at-lower-knowledge-level',
  outdated: 'mark-stale-and-check-official-sources',
  missing: 'draft-new-term-or-neighbor',
  acronym: 'add-expansion-and-say-it-hint',
  pronunciation: 'add-or-fix-say-it-hint',
  source: 'attach-or-replace-official-source',
  analogy: 'regenerate-analogy-or-write-plain',
};

export const JARGON_FEEDBACK_LOOP = {
  primaryReporter: 'Kevin',
  feedbackSource: 'solo learning sessions',
  aiRole: 'review Kevin notes, group recurring gaps, draft source-backed content patches, and flag stale concepts.',
  humanRole: 'approve, reject, or redirect the AI draft before content changes become durable.',
  nonGoal: 'assigned users submitting a team feedback queue.',
  categories: Object.keys(FEEDBACK_DRAFT_INTENTS) as FeedbackCategory[],
} as const;

export function sourceRecordsByCategory(
  records: SourceRecord[] = AI_PLATFORM_SOURCE_RECORDS,
): Record<SourceCategory, SourceRecord[]> {
  const initial: Record<SourceCategory, SourceRecord[]> = {
    'model-lab': [],
    'cloud-ai': [],
    assistant: [],
    'coding-agent': [],
    'app-builder': [],
    'local-ai': [],
    framework: [],
  };

  const safeRecords = Array.isArray(records) ? records : [];

  return safeRecords.reduce<Record<SourceCategory, SourceRecord[]>>(
    (acc, record) => {
      if (record && record.category && acc[record.category]) {
        acc[record.category].push(record);
      }
      return acc;
    },
    initial,
  );
}

export function freshnessStatus(record: SourceRecord, today = isoToday()): FreshnessStatus {
  if (!record || typeof record.reviewedOn !== 'string' || typeof record.reviewCadenceDays !== 'number') {
    return 'stale';
  }
  const safeToday = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : isoToday();
  const elapsed = daysBetween(record.reviewedOn, safeToday);
  if (elapsed > record.reviewCadenceDays) return 'stale';
  if (elapsed >= Math.max(0, record.reviewCadenceDays - 7)) return 'review-soon';
  return 'fresh';
}

export function freshnessSummary(today = isoToday()) {
  const byCategory = sourceRecordsByCategory();
  const statuses = AI_PLATFORM_SOURCE_RECORDS.map((record) => ({
    ...record,
    status: freshnessStatus(record, today),
    reviewDueOn: addDays(record.reviewedOn, record.reviewCadenceDays),
  }));

  return {
    total: statuses.length,
    fresh: statuses.filter((record) => record.status === 'fresh').length,
    reviewSoon: statuses.filter((record) => record.status === 'review-soon').length,
    stale: statuses.filter((record) => record.status === 'stale').length,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([category, records]) => [category, records.length]),
    ) as Record<SourceCategory, number>,
    nextReview: statuses
      .slice()
      .sort((a, b) => a.reviewDueOn.localeCompare(b.reviewDueOn))
      .slice(0, 5),
  };
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(startIso: string, endIso: string) {
  if (!startIso || !endIso || typeof startIso !== 'string' || typeof endIso !== 'string') return 0;
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.floor((end - start) / 86_400_000);
}

function addDays(startIso: string, days: number) {
  const safeDays = isNaN(days) || typeof days !== 'number' ? 0 : Math.round(days);
  if (!startIso || typeof startIso !== 'string') return isoToday();
  const start = Date.parse(`${startIso}T00:00:00Z`);
  if (isNaN(start)) return isoToday();
  const timestamp = start + safeDays * 86_400_000;
  return new Date(timestamp).toISOString().slice(0, 10);
}
