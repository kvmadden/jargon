// Sync-guard test for the PROMPT_VERSION constant.
//
// The constant lives in TWO places that MUST agree:
//   - src/lib/data.ts                           CURRENT_PROMPT_VERSION
//   - supabase/functions/personalize-term/index.ts   PROMPT_VERSION
//
// Both are integers. The client uses CURRENT_PROMPT_VERSION to decide if a
// cached row in `user_term_renderings` is stale (re-fire personalization);
// the server uses PROMPT_VERSION when WRITING new rows. If they drift, the
// client either thinks every row is stale (re-personalizes everything every
// open — burns tokens) or thinks nothing is stale (serves outdated
// personalization that the new prompt would have rejected).
//
// CLAUDE.md project file makes this an architecture invariant. This test
// gates pushes — if either constant changes, both must change.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_PROMPT_VERSION } from './data';

describe('PROMPT_VERSION sync between client and server', () => {
  it('matches the integer literal in personalize-term/index.ts', () => {
    const edgeFnPath = resolve(
      __dirname,
      '../../supabase/functions/personalize-term/index.ts',
    );
    const source = readFileSync(edgeFnPath, 'utf8');
    // Match the const declaration exactly. Anchor on `const PROMPT_VERSION = N;`
    // so we don't accidentally pick up a comment that mentions the constant.
    const match = source.match(/^const\s+PROMPT_VERSION\s*=\s*(\d+)\s*;/m);
    expect(match, 'PROMPT_VERSION declaration not found in personalize-term/index.ts').not.toBeNull();
    const serverVersion = Number(match![1]);
    expect(serverVersion).toBe(CURRENT_PROMPT_VERSION);
  });
});
