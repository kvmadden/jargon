import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ALLOWLIST_EXEMPTIONS,
  JWT_EXEMPTIONS,
  inspectEdgeFunctionAuth,
} from './pre-deploy-auth-gate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('delete-account is allowlist-exempt but remains JWT-gated', () => {
  assert.equal(ALLOWLIST_EXEMPTIONS.has('delete-account'), true);
  assert.equal(JWT_EXEMPTIONS.has('delete-account'), false);

  const source = readFileSync(
    join(ROOT, 'supabase/functions/delete-account/index.ts'),
    'utf8',
  );
  const result = inspectEdgeFunctionAuth('delete-account', source);

  assert.deepEqual(result.findings, []);
  assert.equal(result.hasJwtCheck, true);
  assert.equal(result.hasAllowlist, false);
  assert.match(source, /getUserFromJWT\s*\(\s*jwt[\s,]/);
  assert.match(source, /\.eq\('user_id', user\.id\)/);
  // The allowlist grant is still revoked on deletion — but through the shared
  // helper, which normalizes the email exactly the way the lookup does.
  //
  // This used to assert the raw `.eq('email', user.email)` call, which pinned a
  // real bug in place: `allowed_users` rows are stored lowercased, so a
  // mixed-case auth email failed to match its own row and the grant SURVIVED
  // account deletion, ready to re-admit that address on a later signup. The
  // doesNotMatch below keeps the raw form from coming back.
  // See src/lib/allowlist-deno-side.test.ts.
  assert.match(source, /removeFromAllowlist\(\s*serviceClient,\s*user\.email\s*\)/);
  assert.doesNotMatch(source, /\.eq\('email', user\.email\)/);
  assert.match(source, /deleteUser\(user\.id\)/);
});

test('the delete-account exemption never excuses a missing JWT check', () => {
  const result = inspectEdgeFunctionAuth('delete-account', 'Deno.serve(() => null);');

  assert.deepEqual(result.findings, ['missing JWT check (supabase.auth.getUser)']);
});

test('ordinary user-facing functions still require both JWT and allowlist checks', () => {
  const result = inspectEdgeFunctionAuth(
    'new-user-function',
    'getUserFromJWT(jwt, supabaseUrl, anonKey);',
  );

  assert.deepEqual(result.findings, ['missing isAllowlisted gate']);
});

test('JWT-exempt functions must retain service-role bearer authentication', () => {
  const keywordOnly = inspectEdgeFunctionAuth(
    'ingest-terms',
    'const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const scheme = "Bearer";',
  );
  assert.deepEqual(keywordOnly.findings, [
    'JWT-exempt but missing fail-closed exact service-role bearer guard',
  ]);
  assert.equal(keywordOnly.hasServiceRoleKeyRead, true);
  assert.equal(keywordOnly.hasAuthorizationHeaderRead, false);
  assert.equal(keywordOnly.hasServiceRoleAuth, false);

  const noComparison = inspectEdgeFunctionAuth(
    'ingest-terms',
    `
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    `,
  );
  assert.deepEqual(noComparison.findings, [
    'JWT-exempt but missing fail-closed exact service-role bearer guard',
  ]);
  assert.equal(noComparison.hasBearerExtraction, true);
  assert.equal(noComparison.hasExactServiceRoleComparison, false);

  const looseComparison = inspectEdgeFunctionAuth(
    'ingest-terms',
    `
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (!serviceKey || token != serviceKey) return unauthorized();
    `,
  );
  assert.deepEqual(looseComparison.findings, [
    'JWT-exempt but missing fail-closed exact service-role bearer guard',
  ]);
  assert.equal(looseComparison.hasExactServiceRoleComparison, false);

  const comparisonWithoutRejection = inspectEdgeFunctionAuth(
    'ingest-terms',
    `
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const mismatch = token !== serviceKey;
    `,
  );
  assert.deepEqual(comparisonWithoutRejection.findings, [
    'JWT-exempt but missing fail-closed exact service-role bearer guard',
  ]);
  assert.equal(comparisonWithoutRejection.hasFailClosedServiceRoleGuard, false);

  const nestedReturnOnly = inspectEdgeFunctionAuth(
    'ingest-terms',
    `
      const authHeader = req.headers.get('authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (token !== serviceKey) {
        const rejectLater = () => {
          return unauthorized();
        };
      }
    `,
  );
  assert.deepEqual(nestedReturnOnly.findings, [
    'JWT-exempt but missing fail-closed exact service-role bearer guard',
  ]);
  assert.equal(nestedReturnOnly.hasExactServiceRoleComparison, true);
  assert.equal(nestedReturnOnly.hasFailClosedServiceRoleGuard, false);
});

test('the real ingest function has a fail-closed exact service-role guard', () => {
  const source = readFileSync(
    join(ROOT, 'supabase/functions/ingest-terms/index.ts'),
    'utf8',
  );
  const result = inspectEdgeFunctionAuth('ingest-terms', source);

  assert.deepEqual(result.findings, []);
  assert.equal(result.hasAuthorizationHeaderRead, true);
  assert.equal(result.hasBearerExtraction, true);
  assert.equal(result.hasServiceRoleKeyRead, true);
  assert.equal(result.hasExactServiceRoleComparison, true);
  assert.equal(result.hasFailClosedServiceRoleGuard, true);
  assert.equal(result.hasServiceRoleAuth, true);

  const weakened = inspectEdgeFunctionAuth(
    'ingest-terms',
    source.replace('token !== serviceKey', 'token != serviceKey'),
  );
  assert.deepEqual(weakened.findings, [
    'JWT-exempt but missing fail-closed exact service-role bearer guard',
  ]);
  assert.equal(weakened.hasServiceRoleAuth, false);
});
