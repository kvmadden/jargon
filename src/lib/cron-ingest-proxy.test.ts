import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from '../../api/cron/ingest-terms';
import { ALL_DOMAINS } from './domains';

interface CapturedResponse {
  statusCode?: number;
  body?: unknown;
}

function response() {
  const captured: CapturedResponse = {};
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
    },
  };
  return { captured, res };
}

async function invoke(
  headers: Record<string, string | string[] | undefined> = {},
  method = 'GET',
) {
  const { captured, res } = response();
  await handler({ method, headers }, res);
  return captured;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('weekly ingest cron proxy authentication', () => {
  it('rejects unsupported methods before doing any work', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await invoke({}, 'PUT')).toEqual({
      statusCode: 405,
      body: { error: 'method not allowed' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await invoke({ 'x-vercel-cron': '1' })).toEqual({
      statusCode: 503,
      body: { error: 'server misconfigured: CRON_SECRET missing in Vercel env' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no authorization', { 'x-vercel-cron': '1' }],
    ['wrong secret plus marker', { authorization: 'Bearer wrong', 'x-vercel-cron': '1' }],
    ['extra bearer space', { authorization: 'Bearer  test-cron-secret' }],
    ['lowercase scheme', { authorization: 'bearer test-cron-secret' }],
    ['trailing space', { authorization: 'Bearer test-cron-secret ' }],
    ['duplicate values', { authorization: ['Bearer test-cron-secret', 'Bearer test-cron-secret'] }],
  ])('rejects %s', async (_label, headers) => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await invoke(headers)).toEqual({
      statusCode: 401,
      body: { error: 'unauthorized' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the exact bearer and forwards every configured domain', async () => {
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invoke({
      authorization: 'Bearer test-cron-secret',
    });

    expect(result.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(ALL_DOMAINS.length);
    for (const domain of ALL_DOMAINS) {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.supabase.co/functions/v1/ingest-terms',
        expect.objectContaining({
          method: 'POST',
          headers: {
            authorization: 'Bearer test-service-role',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ trigger: 'cron', domain }),
        }),
      );
    }
  });
});
