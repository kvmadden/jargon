import type { Domain, PathId } from './database.types';
import { pathsForDomain } from './domains';

export const GUIDED_PROGRAM_IDS = ['agentic-era-operator'] as const;

export type GuidedProgramId = (typeof GUIDED_PROGRAM_IDS)[number];

export interface GuidedProgramModule {
  id: string;
  number: number;
  title: string;
  theme: string;
  summary: string;
  termIds: readonly string[];
}

export interface GuidedProgram {
  id: GuidedProgramId;
  title: string;
  eyebrow: string;
  subtitle: string;
  domain: Domain;
  pathId: PathId;
  duration: string;
  modules: readonly GuidedProgramModule[];
}

const AGENTIC_ERA_MODULES = [
  {
    id: 'power-on',
    number: 1,
    title: 'power on',
    theme: 'past',
    summary: 'From explicit rules to the transformer breakthrough behind modern generative AI.',
    termIds: [
      'era-rules-based-system',
      'era-expert-system',
      'era-machine-learning',
      'era-deep-learning',
      'era-transformer',
      'era-generative-ai',
      'era-large-language-model',
    ],
  },
  {
    id: 'grayskull',
    number: 2,
    title: 'grayskull',
    theme: 'present',
    summary: 'The model, product, context, evidence, permissions, and guardrails around an assistant.',
    termIds: [
      'era-ai-assistant',
      'era-enterprise-ai',
      'era-context-window',
      'era-grounding',
      'era-hallucination',
      'era-guardrail',
    ],
  },
  {
    id: 'the-sword',
    number: 3,
    title: 'the sword',
    theme: 'delegation',
    summary: 'Turn a vague prompt into an outcome, context, boundaries, and proof.',
    termIds: [
      'era-delegation-brief',
      'era-iteration',
      'era-verification-workflow',
    ],
  },
  {
    id: 'battle-cat',
    number: 4,
    title: 'battle cat',
    theme: 'tools',
    summary: 'Understand what changes when an assistant can read or act through approved tools.',
    termIds: [
      'era-tool-use',
      'era-human-in-the-loop',
    ],
  },
  {
    id: 'the-veil',
    number: 5,
    title: 'the veil',
    theme: 'redesign',
    summary: 'Redesign a workflow around a measurable outcome instead of wrapping it in chat.',
    termIds: [
      'era-workflow-redesign',
      'era-measurable-delta',
    ],
  },
  {
    id: 'agents-of-eternia',
    number: 6,
    title: 'agents of eternia',
    theme: 'agents',
    summary: 'Move from one response to a tool-using loop with observations and governed memory.',
    termIds: [
      'era-agentic-workflow',
      'era-agent',
      'era-agent-loop',
      'era-persistent-memory',
    ],
  },
  {
    id: 'build-your-minion',
    number: 7,
    title: 'build your minion',
    theme: 'control',
    summary: 'Define the approvals, stop conditions, and autonomy boundary before a run begins.',
    termIds: [
      'era-approval-gate',
      'era-stopping-condition',
      'era-autonomy-boundary',
    ],
  },
  {
    id: 'the-iron-throne',
    number: 8,
    title: 'the iron throne',
    theme: 'future',
    summary: 'Reason about orchestration, mixed teams, and the agentic operating-system direction.',
    termIds: [
      'era-orchestration',
      'era-mixed-human-agent-team',
      'era-agentic-operating-system',
    ],
  },
] as const satisfies readonly GuidedProgramModule[];

export const GUIDED_PROGRAMS: Record<GuidedProgramId, GuidedProgram> = {
  'agentic-era-operator': {
    id: 'agentic-era-operator',
    title: 'the second sword',
    eyebrow: 'agentic era operator course',
    subtitle: 'Eight guided modules on working with AI agents.',
    domain: 'ai',
    pathId: 'ai-agentic-era',
    duration: '8 modules · 30 terms',
    modules: AGENTIC_ERA_MODULES,
  },
};

export function asGuidedProgramId(raw: string | null | undefined): GuidedProgramId | null {
  if (!raw) return null;
  return (GUIDED_PROGRAM_IDS as readonly string[]).includes(raw)
    ? (raw as GuidedProgramId)
    : null;
}

export function guidedProgram(raw: string | null | undefined): GuidedProgram | null {
  const id = asGuidedProgramId(raw);
  return id ? GUIDED_PROGRAMS[id] : null;
}

export function pathsForLearningContext(
  domain: Domain,
  programId: string | null | undefined,
): PathId[] {
  const program = guidedProgram(programId);
  return program && program.domain === domain
    ? [program.pathId]
    : pathsForDomain(domain);
}
