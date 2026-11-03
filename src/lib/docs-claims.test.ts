// The README and docs quote figures from the 2026-10-30 run. Each figure must
// also appear in the report that eval/report.ts computes from the saved rows,
// so a doc cannot drift from the data. Prose rules for docs are checked too.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildReport } from '../../eval/report.ts';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const report = buildReport();
const docs = ['README.md', 'docs/evaluation.md', 'docs/verification.md', 'docs/canonical-review.md', 'eval/README.md'];

describe('figures quoted in the docs come from the computed report', () => {
  it.each([
    ['79 of 120', 'Items run: 79 of 120'],
    ['0 of 4', 'caught 0 of 4 (0%, 95% CI 0-49%)'],
    ['9 of 78', '9 of 78 (12%, 95% CI 6-20%)'],
    ['$2.92', '**$2.92**'],
    ['$8.77', 'As logged: $8.77'],
    ['$4.44', 'about $4.44'],
    ['27 of 40', 'Distinct terms: 27 of 40'],
    ['76 of 78', '76 of 78 (97%'],
    ['25 of 78', '25 of 78 (32%'],
  ])('%s', (figure, inReport) => {
    expect(report).toContain(inReport);
    expect(read('README.md')).toContain(figure);
  });

  it('the README no longer leads with the old 5-of-78 rate or the unbacked parity claim', () => {
    const readme = read('README.md');
    expect(readme).not.toMatch(/Verifier misses: 5 of 78/);
    expect(readme).not.toMatch(/747 prompt strings/);
    expect(readme).not.toMatch(/clears the cached rendering/);
  });
});

describe('doc prose rules', () => {
  // Fenced code blocks may quote old seed text verbatim, so they are skipped.
  const prose = (text: string) => text.replace(/```[\s\S]*?```/g, '');

  it.each(docs.map((d) => [d]))('%s has no semicolons or em dashes outside code blocks', (d) => {
    const text = prose(read(d));
    expect(text).not.toContain('—');
    expect(text).not.toContain(';');
  });
});
