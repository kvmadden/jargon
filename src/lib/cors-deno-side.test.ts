// Tests for the Deno-side CORS helper (`_shared/cors.ts`).
//
// Pure TypeScript, `Deno.env` read lazily inside the functions — so vitest
// imports it directly and stubs `globalThis.Deno`. Same pattern as
// src/lib/spend-guard-deno-side.test.ts.
//
// What these pin (2026-08-17 security pass): the dev origins
// (localhost/127.0.0.1 on 5173/5200) were unconditionally in the allowlist, so a
// PRODUCTION deploy would echo `access-control-allow-origin: http://localhost:5173`
// for anything running on a developer's machine. Severity is low — these
// responses carry no `access-control-allow-credentials`, so a browser will not
// attach the caller's cookies/JWT — but a production function has no business
// vouching for localhost. Dev origins are now trusted only when the deploy has
// NOT been given a production origin list, with an explicit env escape hatch.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — _shared lives outside the TS root config but is pure TS.
import { corsHeaders, preflight, jsonResponse } from '../../supabase/functions/_shared/cors.ts';

const ENV: Record<string, string> = {};

function reqFrom(origin?: string, method = 'POST'): Request {
  return new Request('https://example.test/fn', {
    method,
    headers: origin ? { origin } : {},
  });
}

const allowOrigin = (r: Request) => corsHeaders(r)['access-control-allow-origin'];

beforeEach(() => {
  for (const k of Object.keys(ENV)) delete ENV[k];
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (name: string) => ENV[name] },
  };
});

afterEach(() => {
  delete (globalThis as unknown as { Deno?: unknown }).Deno;
});

describe('corsHeaders — a configured (production) deploy', () => {
  beforeEach(() => {
    ENV.JARGON_SITE_ORIGINS = 'https://jargon.example.com,https://staging.jargon.example.com';
  });

  it('does NOT vouch for localhost', () => {
    expect(allowOrigin(reqFrom('http://localhost:5173'))).not.toBe('http://localhost:5173');
    expect(allowOrigin(reqFrom('http://127.0.0.1:5173'))).not.toBe('http://127.0.0.1:5173');
    expect(allowOrigin(reqFrom('http://localhost:5200'))).not.toBe('http://localhost:5200');
    expect(allowOrigin(reqFrom('http://127.0.0.1:5200'))).not.toBe('http://127.0.0.1:5200');
  });

  it('still echoes every configured production origin (control)', () => {
    expect(allowOrigin(reqFrom('https://jargon.example.com'))).toBe('https://jargon.example.com');
    expect(allowOrigin(reqFrom('https://staging.jargon.example.com'))).toBe('https://staging.jargon.example.com');
  });

  it('falls back to the first configured origin for an unknown origin (control)', () => {
    expect(allowOrigin(reqFrom('https://evil.example'))).toBe('https://jargon.example.com');
  });

  it('honours the explicit dev escape hatch', () => {
    // For deliberately pointing a local Vite at the deployed functions.
    ENV.JARGON_ALLOW_DEV_ORIGINS = 'true';
    expect(allowOrigin(reqFrom('http://localhost:5173'))).toBe('http://localhost:5173');
  });
});

describe('corsHeaders — an unconfigured (local/dev) deploy: unchanged (controls)', () => {
  it('allows the dev origins when no production origins are configured', () => {
    expect(allowOrigin(reqFrom('http://localhost:5173'))).toBe('http://localhost:5173');
    expect(allowOrigin(reqFrom('http://127.0.0.1:5173'))).toBe('http://127.0.0.1:5173');
    expect(allowOrigin(reqFrom('http://localhost:5200'))).toBe('http://localhost:5200');
    expect(allowOrigin(reqFrom('http://127.0.0.1:5200'))).toBe('http://127.0.0.1:5200');
  });

  it('allows the port vite.config.ts actually serves on', () => {
    const vite = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const port = vite.match(/server:\s*{\s*port:\s*(\d+)/)?.[1];
    expect(port).toBe('5182');
    expect(allowOrigin(reqFrom(`http://localhost:${port}`))).toBe(`http://localhost:${port}`);
    expect(allowOrigin(reqFrom(`http://127.0.0.1:${port}`))).toBe(`http://127.0.0.1:${port}`);
  });

  it('falls back to localhost:5173 for an unknown origin', () => {
    expect(allowOrigin(reqFrom('https://evil.example'))).toBe('http://localhost:5173');
  });
});

describe('cors plumbing (controls)', () => {
  it('preflight answers OPTIONS with 204 + the cors headers', async () => {
    ENV.JARGON_SITE_ORIGINS = 'https://jargon.example.com';
    const res = preflight(reqFrom('https://jargon.example.com', 'OPTIONS'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(204);
    expect(res!.headers.get('access-control-allow-origin')).toBe('https://jargon.example.com');
    expect(res!.headers.get('vary')).toBe('origin');
  });

  it('preflight passes through non-OPTIONS', () => {
    expect(preflight(reqFrom('https://jargon.example.com', 'POST'))).toBeNull();
  });

  it('jsonResponse carries the cors headers and a json content-type', async () => {
    ENV.JARGON_SITE_ORIGINS = 'https://jargon.example.com';
    const res = jsonResponse(reqFrom('https://jargon.example.com'), { ok: true }, 200);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://jargon.example.com');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('never sets allow-credentials (why the dev-origin leak stayed low severity)', () => {
    ENV.JARGON_SITE_ORIGINS = 'https://jargon.example.com';
    expect(corsHeaders(reqFrom('http://localhost:5173'))['access-control-allow-credentials']).toBeUndefined();
  });
});
