import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DifficultyDots } from './difficulty-dots';

describe('DifficultyDots', () => {
  it('renders with appropriate role, labels, and spans hidden', () => {
    const mastered = { 1: 2, 2: 1, 3: 0 };
    const totals = { 1: 3, 2: 3, 3: 3 };

    render(<DifficultyDots mastered={mastered} totals={totals} />);

    // Verify container has role="img" and accessible name summarizing stats
    const imgEl = screen.getByRole('img');
    expect(imgEl).toHaveAttribute(
      'aria-label',
      'mastery: easy 2 of 3, medium 1 of 3, hard 0 of 3'
    );

    // Verify inner spans are marked aria-hidden so screen readers do not count them
    const spans = imgEl.querySelectorAll('span');
    expect(spans.length).toBe(9);
    spans.forEach((span) => {
      expect(span).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
