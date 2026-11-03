// Code-drawn lesson illustrations: every entry points at a real term and has
// short sentence-case labels.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { LESSON_ILLUSTRATIONS, illustrationFor } from './lesson-illustrations';
import { ConceptIllustration } from '../components/concept-illustration';
import { LessonBody } from '../components/lesson-body';
// @ts-expect-error plain .mjs module without type declarations
import { parseTermInserts, uniqueById } from '../../scripts/lib/seed-terms.mjs';

const seed = uniqueById(parseTermInserts(readFileSync(resolve(__dirname, '../../supabase/seed.sql'), 'utf8'))) as Map<string, unknown>;

describe('LESSON_ILLUSTRATIONS', () => {
  it.each(Object.entries(LESSON_ILLUSTRATIONS))('%s is a real term with 2 to 4 short sentence-case steps', (id, ill) => {
    expect(seed.has(id)).toBe(true);
    expect(ill.steps.length).toBeGreaterThanOrEqual(2);
    expect(ill.steps.length).toBeLessThanOrEqual(4);
    for (const step of ill.steps) {
      expect(step[0]).toBe(step[0].toUpperCase());
      expect(step.length).toBeLessThanOrEqual(20);
    }
    expect(ill.description).toMatch(/^[A-Z].*\.$/);
  });

  it('returns nothing for a term without a drawing', () => {
    expect(illustrationFor('no-such-term')).toBeNull();
  });
});

describe('ConceptIllustration and LessonBody', () => {
  it('draws the steps as an image with a description for screen readers', () => {
    render(<ConceptIllustration illustration={LESSON_ILLUSTRATIONS['cloud-environment']} />);
    expect(screen.getByRole('img', { name: /local to preview to staging to production/i })).toBeInTheDocument();
    // One visible copy plus one hidden copy that only measures the line width.
    expect(screen.getAllByText('Staging')).toHaveLength(2);
    expect(screen.getByRole('img').getAttribute('data-diagram-layout')).toMatch(/^(row|stack)$/);
  });

  it('shows a lead sentence and one bullet per later sentence', () => {
    const { container } = render(<LessonBody text="rls stands for row-level security. it filters rows. each viewer sees their rows." />);
    expect(container.querySelector('p')?.textContent).toBe('Rls stands for row-level security.');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });
});
