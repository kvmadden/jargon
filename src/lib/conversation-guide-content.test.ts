import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_GUIDE_IDS,
  CONVERSATION_GUIDES,
  conversationGuideForTerm,
  conversationGuideForTermId,
} from './conversation-guide-content';
import { allAtlasConcepts } from './concept-atlas';

const FOUNDATION_GUIDE_IDS = [
  'ai-rag',
  'ai-fine-tuning',
  'ai-embedding',
  'ai-vector-store',
  'ai-agent',
  'ai-tool-call',
  'ai-hallucination',
  'ai-grounding',
  'ai-structured-output',
  'ai-evals',
  'ai-guardrails',
  'ml-training-data',
  'ml-model',
  'ml-inference',
  'ml-overfitting',
  'arch-api',
  'arch-interface',
  'arch-service',
  'arch-monolith',
  'arch-microservice',
  'arch-eventual-consistency',
  'web-request',
  'web-response',
  'web-status-code',
  'web-cors',
  'data-primary-key',
  'data-foreign-key',
  'data-join',
  'data-index',
  'os-process',
  'os-thread',
  'os-memory',
  'sec-oauth',
  'sec-sso',
  'flow-rebase',
  'flow-merge',
  'qa-smoke-test',
  'qa-regression-test',
  'prod-kpi',
  'math-big-o',
] as const;

const LOWERCASE_VISIBLE_INITIALISM_RE =
  /\b(ai|ml|llm|llms|api|apis|json|sql|http|url|urls|dns|tcp|udp|vpn|tls|cpu|gpu|ram|ssd|pcie|rls|ci|pr|prs|qa|e2e|sso|mfa|rbac|oauth|rag|kpi|okr|crm|erp|sla|slo|mttr|cdn|cors|jwt|mcp|cli|sdk|rest|db|os)\b/;

describe('conversation guide content', () => {
  it('covers the first foundation deepening pass', () => {
    for (const termId of FOUNDATION_GUIDE_IDS) {
      expect(CONVERSATION_GUIDE_IDS.has(termId), `${termId} missing guide`).toBe(true);
      expect(conversationGuideForTermId(termId)?.termId).toBe(termId);
    }
  });

  it('keeps each guide useful at plain and technical explanation levels', () => {
    for (const guide of CONVERSATION_GUIDES) {
      expect(guide.termId, 'missing term id').toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(guide.plainExplanation.trim().length, `${guide.termId} needs plain explanation`).toBeGreaterThan(70);
      expect(guide.technicalExplanation.trim().length, `${guide.termId} needs technical explanation`).toBeGreaterThan(70);
      expect(guide.sayBack.trim().length, `${guide.termId} needs say-back line`).toBeGreaterThan(35);
      expect(guide.commonConfusion.trim().length, `${guide.termId} needs confusion note`).toBeGreaterThan(55);
    }
  });

  it('keeps acronym and initialism casing readable in guide copy', () => {
    for (const guide of CONVERSATION_GUIDES) {
      const copy = [
        guide.plainExplanation,
        guide.technicalExplanation,
        guide.sayBack,
        guide.commonConfusion,
      ].join(' ');

      expect(copy, `${guide.termId} lowercases an acronym`).not.toMatch(
        LOWERCASE_VISIBLE_INITIALISM_RE,
      );
    }
  });

  it('builds a baseline guide for every seeded atlas concept', () => {
    const seededConcepts = allAtlasConcepts.filter((concept) => concept.status === 'seeded');

    expect(seededConcepts.length).toBe(389);

    for (const concept of seededConcepts) {
      const guide = conversationGuideForTerm({
        id: concept.id,
        term: concept.term,
        one_line_definition: concept.plainMeaning,
        long_definition: concept.plainMeaning,
        why_it_matters: concept.whyKevinCares,
        multiple_choice_distractors: concept.neighbors,
      });

      expect(guide.termId).toBe(concept.id);
      expect(guide.plainExplanation.length, `${concept.id} needs plain guide`).toBeGreaterThan(70);
      expect(guide.technicalExplanation.length, `${concept.id} needs technical guide`).toBeGreaterThan(90);
      expect(guide.sayBack.length, `${concept.id} needs say-back`).toBeGreaterThan(45);
      expect(guide.commonConfusion.length, `${concept.id} needs confusion guide`).toBeGreaterThan(70);
    }
  });

  it('normalizes acronyms and initialisms in generated guide copy', () => {
    const guide = conversationGuideForTerm({
      id: 'generated-api-json-http',
      term: 'api',
      one_line_definition: 'an api sends json over http.',
      long_definition: 'an api is the contract for a request and response using json over http.',
      why_it_matters: 'if the api shape is wrong, the ui and server can both look broken.',
      multiple_choice_distractors: ['json'],
    });

    const copy = [
      guide.plainExplanation,
      guide.technicalExplanation,
      guide.sayBack,
      guide.commonConfusion,
    ].join(' ');

    expect(copy).toContain('API');
    expect(copy).toContain('JSON');
    expect(copy).toContain('HTTP');
    expect(copy).not.toMatch(LOWERCASE_VISIBLE_INITIALISM_RE);
  });
});
