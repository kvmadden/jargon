// Term expansions (Kevin's ruling, 2026-11-03): every term that looks like an
// abbreviation has data saying what it stands for, or says it is not one, and
// the line renders right under the title.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { expansionParts, letterMarks, type TermExpansion } from './term-expansion';
import { ExpansionLine } from '../components/expansion-line';
import { buildPass1UserMessage } from '../../supabase/functions/personalize-term/prompts.ts';
// @ts-expect-error plain .mjs module without type declarations
import { parseTermInserts, uniqueById } from '../../scripts/lib/seed-terms.mjs';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');
const data = JSON.parse(read('supabase/term-expansions.json')) as { terms: Record<string, TermExpansion> };
const seedText = read('supabase/seed.sql');
const rows = [...uniqueById(parseTermInserts(seedText)).values()] as Array<{ id: string; term: string }>;

// Clipped forms, lowercase commands and acronym names that count as
// abbreviations when they are a whole word of a term name.
const CLIPPED = new Set(['repo', 'app', 'apps', 'config', 'env', 'auth', 'admin', 'prod', 'dev', 'docs', 'spec', 'info', 'demo',
  'stats', 'temp', 'regex', 'lib', 'pkg', 'src', 'cmd', 'db', 'ops', 'param', 'params', 'arg', 'args', 'cert', 'props', 'evals', 'eval',
  'cd', 'ls', 'mv', 'rm', 'cat', 'man', 'grep', 'sudo', 'bash', 'authn', 'authz', 'k8s', 'retro', 'tech', 'enum', 'diff', 'pub',
  'sub', 'npm', 'pnpm', 'gen2', 'redis', 'glob']);
// Mixed-case acronyms that are not all capitals.
const MIXED = /^(?:OAuth|NoSQL|PCIe|SaaS|PaaS|IaaS|GraphQL|ChatGPT|iOS|macOS|CoT|MoE|SoC|E2E)$/;

function looksLikeAbbreviation(term: string): boolean {
  return term
    .split(/[\s/()]+/)
    .filter(Boolean)
    .some((tok) => {
      const bare = tok.replace(/^[.]+|[.,]+$/g, '');
      return /^[A-Z]{2,}(?:\.[a-z]+)?$/.test(bare) || MIXED.test(bare) || CLIPPED.has(bare.toLowerCase()) || /\.md$/.test(bare);
    });
}

describe('term expansion data', () => {
  it('has an entry, or an explicit not-an-abbreviation flag, for every term that looks like an abbreviation', () => {
    const missing = rows.filter((r) => looksLikeAbbreviation(r.term) && !data.terms[r.id]).map((r) => `${r.id} (${r.term})`);
    expect(missing).toEqual([]);
  });

  it('points every entry at a real term, with a well-formed part list', () => {
    const ids = new Set(rows.map((r) => r.id));
    for (const [id, e] of Object.entries(data.terms)) {
      expect(ids.has(id), id).toBe(true);
      if (e.not_abbreviation) {
        expect(e.parts, id).toBeUndefined();
        continue;
      }
      expect(e.parts!.length, id).toBeGreaterThan(0);
      for (const p of e.parts!) {
        expect(['letters', 'clipped'], id).toContain(p.kind);
        expect(p.expansion.trim().length, id).toBeGreaterThan(0);
      }
    }
  });

  it('is written into the migration and the seed exactly as in the JSON', () => {
    const migration = read('supabase/migrations/20261103000400_term_expansions.sql');
    for (const [id, e] of Object.entries(data.terms)) {
      const sql = `update terms set expansion = '${JSON.stringify(e, Object.keys(e).sort()).replace(/'/g, "''")}'::jsonb where id = '${id}';`;
      void sql;
      const line = new RegExp(`update terms set expansion = '(.*)'::jsonb where id = '${id.replace(/[-]/g, '\\-')}';`);
      const m1 = migration.match(line);
      const m2 = seedText.match(line);
      expect(m1, id).not.toBeNull();
      expect(m2, id).not.toBeNull();
      expect(JSON.parse(m1![1].replace(/''/g, "'")), id).toEqual(e);
      expect(m2![1], id).toBe(m1![1]);
    }
  });

  it('keeps the note on the nine entries Kevin confirmed, and nothing waits for review', () => {
    const noted = Object.entries(data.terms).filter(([, e]) => e.note).map(([id]) => id).sort();
    expect(noted).toEqual(['cli-sudo', 'ent-sap', 'hw-arm', 'ms365-admin-center', 'ms365-entra', 'qa-mttr', 'sys-graphql', 'sys-nosql', 'tool-npm']);
    expect(Object.values(data.terms).some((e) => 'review' in e)).toBe(false);
  });
});

describe('letterMarks', () => {
  it('marks R, L and S in row-level security', () => {
    const marks = letterMarks({ abbr: 'RLS', expansion: 'row-level security', kind: 'letters' })!;
    expect(marks.map((w) => w.text[w.mark])).toEqual(['r', 'l', 's']);
    expect(marks.map((w) => w.after)).toEqual(['-', ' ', '']);
  });

  it.each([
    ['OAuth', 'open authorization'],
    ['OKR', 'objectives and key results'],
    ['HTTP', 'Hypertext Transfer Protocol'],
  ])('skips marking when %s does not map one to one', (abbr, expansion) => {
    expect(letterMarks({ abbr, expansion, kind: 'letters' })).toBeNull();
  });

  it('shows nothing for a name that is not an abbreviation, or for a plain word', () => {
    expect(expansionParts({ not_abbreviation: true })).toEqual([]);
    expect(expansionParts(null)).toEqual([]);
  });
});

describe('ExpansionLine', () => {
  it('says what RLS stands for, with each letter marked', () => {
    const { container } = render(<ExpansionLine term="RLS" expansion={data.terms['bi-rls']} />);
    expect(container.textContent).toBe('RLS stands for Row-Level Security.');
    expect([...container.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['R', 'L', 'S']);
  });

  it('says "Short for" for a clipped term', () => {
    render(<ExpansionLine term="evals" expansion={data.terms['aid-evals']} />);
    expect(screen.getByText(/Short for/)).toHaveTextContent('Short for evaluations.');
  });

  it('keeps the case the abbreviation gives each letter', () => {
    const cot = render(<ExpansionLine term="chain of thought (CoT)" expansion={data.terms['ai-chain-of-thought']} />);
    expect(cot.container.textContent).toBe('CoT stands for Chain of Thought.');
    expect([...cot.container.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['C', 'o', 'T']);
    cot.unmount();
    const cd = render(<ExpansionLine term="cd" expansion={data.terms['cli-cd']} />);
    expect(cd.container.textContent).toBe('cd stands for change directory.');
    expect([...cd.container.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['c', 'd']);
  });

  it('covers commands, clipped words and two-part names', () => {
    const line = (term: string, id: string) => render(<ExpansionLine term={term} expansion={data.terms[id]} />).container.textContent;
    expect(line('ls', 'cli-ls')).toBe('Short for list.');
    expect(line('Kubernetes (k8s)', 'ent-kubernetes')).toBe('k8s is short for Kubernetes, counting the 8 letters between k and s.');
    expect(line('pub/sub (publish-subscribe)', 'sys-pub-sub')).toBe('pub is short for publish.sub is short for subscribe.');
    expect(line('npm', 'tool-npm')).toBe('');
  });

  it('shows the expansion without marking when the letters do not map', () => {
    const { container } = render(<ExpansionLine term="OAuth" expansion={data.terms['sec-oauth']} />);
    expect(container.textContent).toBe('OAuth stands for open authorization.');
    expect(container.querySelectorAll('strong')).toHaveLength(0);
  });

  it('renders nothing for a plain word', () => {
    const { container } = render(<ExpansionLine term="deploy" expansion={null} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('generated lessons keep the expansion', () => {
  it('sends it to the model as fixed text it must not reword', () => {
    const term = { id: 'bi-rls', term: 'RLS', expansion: data.terms['bi-rls'] as any, one_line_definition: 'a', long_definition: 'b', why_it_matters: 'c', example_in_sentence: 'd' };
    const msg = buildPass1UserMessage(term, { user_id: 'u', education_level: null, job: 'nurse', interests: [], background_text: null, goals_extended: null, goals_freeform: null, encounter_contexts: [], heritage: null, roles: null, personalization_enabled: true, profile_version: 1 } as any, []);
    expect(msg).toContain('EXPANSION (shown to the learner above the lesson, word for word): RLS stands for row-level security.');
  });
});
