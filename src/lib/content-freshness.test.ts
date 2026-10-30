import { describe, expect, it } from 'vitest';
import {
  AI_PLATFORM_SOURCE_RECORDS,
  FEEDBACK_DRAFT_INTENTS,
  JARGON_FEEDBACK_LOOP,
  freshnessStatus,
  freshnessSummary,
  sourceRecordsByCategory,
} from './content-freshness';

const REQUIRED_SOURCE_IDS = [
  'src-openai-platform',
  'src-chatgpt-codex',
  'src-anthropic-claude',
  'src-claude-code',
  'src-google-gemini-api',
  'src-google-vertex-ai',
  'src-microsoft-foundry',
  'src-copilot-studio',
  'src-amazon-bedrock',
  'src-hugging-face',
  'src-mistral-ai',
  'src-cohere',
  'src-meta-llama',
  'src-xai-grok',
  'src-perplexity',
  'src-github-copilot',
  'src-cursor',
  'src-windsurf',
  'src-replit-agent',
  'src-devin',
  'src-lovable',
  'src-ollama',
  'src-lm-studio',
  'src-vercel-ai-sdk',
  'src-vercel-ai-gateway',
  'src-langchain-langgraph',
  'src-llamaindex',
] as const;

describe('content freshness', () => {
  it('keeps source-backed AI platform records for volatile product names', () => {
    const ids = AI_PLATFORM_SOURCE_RECORDS.map((record) => record.id);

    for (const id of REQUIRED_SOURCE_IDS) {
      expect(ids, `${id} missing`).toContain(id);
    }

    for (const record of AI_PLATFORM_SOURCE_RECORDS) {
      expect(record.displayName.trim(), `${record.id} needs a display name`).not.toHaveLength(0);
      expect(record.officialSourceUrl, `${record.id} should point to official docs`).toMatch(/^https:\/\//);
      expect(record.reviewedOn, `${record.id} should carry an exact review date`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      expect(record.reviewCadenceDays, `${record.id} should have a review cadence`).toBeGreaterThan(0);
      expect(record.conceptIds.length, `${record.id} should map back to atlas concepts`).toBeGreaterThan(0);
    }
  });

  it('groups source records by how Kevin will encounter the name', () => {
    const byCategory = sourceRecordsByCategory();

    expect(byCategory['model-lab'].map((record) => record.displayName)).toContain('Anthropic Claude');
    expect(byCategory['cloud-ai'].map((record) => record.displayName)).toContain('Microsoft Foundry');
    expect(byCategory['coding-agent'].map((record) => record.displayName)).toContain('Claude Code');
    expect(byCategory['app-builder'].map((record) => record.displayName)).toContain('Lovable');
    expect(byCategory['local-ai'].map((record) => record.displayName)).toContain('Ollama');
    expect(byCategory.framework.map((record) => record.displayName)).toContain('Vercel AI SDK');
  });

  it('marks source records as fresh, review-soon, or stale from the cadence', () => {
    const openai = AI_PLATFORM_SOURCE_RECORDS.find(
      (record) => record.id === 'src-openai-platform',
    );
    expect(openai).toBeTruthy();

    expect(freshnessStatus(openai!, '2026-06-10')).toBe('fresh');
    expect(freshnessStatus(openai!, '2026-06-23')).toBe('review-soon');
    expect(freshnessStatus(openai!, '2026-07-05')).toBe('stale');
  });

  it('summarizes the freshness queue without React recomputing it', () => {
    const summary = freshnessSummary('2026-07-05');

    expect(summary.total).toBe(AI_PLATFORM_SOURCE_RECORDS.length);
    expect(summary.stale).toBeGreaterThan(0);
    expect(summary.byCategory['coding-agent']).toBeGreaterThanOrEqual(5);
    expect(summary.nextReview.length).toBeGreaterThan(0);
    expect(summary.nextReview[0].reviewDueOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('solo feedback loop', () => {
  it('models Jargon feedback as Kevin-first notes, not assigned-user feedback', () => {
    expect(JARGON_FEEDBACK_LOOP.primaryReporter).toBe('Kevin');
    expect(JARGON_FEEDBACK_LOOP.feedbackSource).toBe('solo learning sessions');
    expect(JARGON_FEEDBACK_LOOP.aiRole).toContain('draft');
    expect(JARGON_FEEDBACK_LOOP.humanRole).toContain('approve');
    expect(JARGON_FEEDBACK_LOOP.nonGoal).toContain('assigned users');
  });

  it('turns feedback categories into reviewable AI draft intents', () => {
    expect(FEEDBACK_DRAFT_INTENTS.outdated).toBe('mark-stale-and-check-official-sources');
    expect(FEEDBACK_DRAFT_INTENTS.acronym).toBe('add-expansion-and-say-it-hint');
    expect(FEEDBACK_DRAFT_INTENTS.pronunciation).toBe('add-or-fix-say-it-hint');
    expect(FEEDBACK_DRAFT_INTENTS.missing).toBe('draft-new-term-or-neighbor');
  });

  it('handles invalid inputs and dates safely', () => {
    expect(freshnessStatus(null as any)).toBe('stale');
    expect(sourceRecordsByCategory(null as any)).toBeDefined();
    expect(freshnessStatus(AI_PLATFORM_SOURCE_RECORDS[0], 'invalid-date')).toBe('stale');
  });
});
