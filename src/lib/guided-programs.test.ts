import { describe, expect, it } from 'vitest';
import {
  GUIDED_PROGRAMS,
  asGuidedProgramId,
  guidedProgram,
  pathsForLearningContext,
} from './guided-programs';

describe('guided programs', () => {
  it('maps the Agentic Era course to all 30 unique terms in eight modules', () => {
    const program = GUIDED_PROGRAMS['agentic-era-operator'];
    const termIds = program.modules.flatMap((module) => [...module.termIds]);

    expect(program.modules).toHaveLength(8);
    expect(termIds).toHaveLength(30);
    expect(new Set(termIds).size).toBe(30);
    expect(termIds.every((id) => id.startsWith('era-'))).toBe(true);
  });

  it('accepts only registered program ids', () => {
    expect(asGuidedProgramId('agentic-era-operator')).toBe('agentic-era-operator');
    expect(asGuidedProgramId('unknown-program')).toBeNull();
    expect(asGuidedProgramId(null)).toBeNull();
    expect(guidedProgram('unknown-program')).toBeNull();
  });

  it('limits an active guided learner to the program path', () => {
    expect(pathsForLearningContext('ai', 'agentic-era-operator')).toEqual([
      'ai-agentic-era',
    ]);
  });

  it('falls back to the domain registry for legacy and unknown programs', () => {
    expect(pathsForLearningContext('ai', null)).toContain('ai-foundations');
    expect(pathsForLearningContext('coding', 'unknown-program')).toContain('dev-concepts');
    expect(
      pathsForLearningContext('coding', 'agentic-era-operator'),
    ).toContain('dev-concepts');
  });
});
