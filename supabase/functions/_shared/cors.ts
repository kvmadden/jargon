// Shared CORS helpers for Jargon Edge Functions.
//
// Origin allowlist resolution:
//   1) Allow the dev origins (Vite at 5173/5200, with 127.0.0.1 variants) ONLY
//      when this deploy has no production origin list — see devOriginsTrusted().
//   2) Allow the comma-separated origins in env var
//      `JARGON_SITE_ORIGINS` (production deploy + any preview URLs). Set this
//      in the Edge Function secrets — e.g. `https://jargon.app` or
//      `https://jargon.app,https://staging.jargon.app`.
//   3) Unknown origin → respond with the FIRST configured prod origin (so
//      browsers in production at least see a coherent allow-origin header)
//      OR `localhost:5173` if no prod origins are configured (dev-only deploy).
//
// Why the change from B+1.4-B's "fall back to localhost:5173": once gift mode
// ships, recipients open the app in browsers that aren't running on the owner's
// laptop. The old fallback caused every prod CORS response to claim
// `access-control-allow-origin: http://localhost:5173`, which browsers reject
// with a CORS error. See pre-deploy review warning W7.

const DEV_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5200',
  'http://127.0.0.1:5200',
]);

function prodOrigins(): string[] {
  const raw = Deno.env.get('JARGON_SITE_ORIGINS') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Whether the localhost dev origins are trusted on THIS deploy.
 *
 * They used to be trusted unconditionally, which meant the production functions
 * would echo `access-control-allow-origin: http://localhost:5173` to anything
 * running on a developer's machine. Low severity — no
 * `access-control-allow-credentials` is ever sent, so a browser will not attach
 * the caller's cookies or JWT — but a production deploy has no business vouching
 * for localhost.
 *
 * A deploy that has been given JARGON_SITE_ORIGINS is by definition a real
 * deploy, so dev origins drop off. A local stack (no such env) is unaffected.
 * JARGON_ALLOW_DEV_ORIGINS=true re-enables them for deliberately pointing a
 * local Vite at deployed functions.
 */
function devOriginsTrusted(prod: string[]): boolean {
  if (Deno.env.get('JARGON_ALLOW_DEV_ORIGINS') === 'true') return true;
  return prod.length === 0;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const prod = prodOrigins();
  const allAllowed = new Set<string>([
    ...(devOriginsTrusted(prod) ? DEV_ORIGINS : []),
    ...prod,
  ]);

  let allowed: string;
  if (allAllowed.has(origin)) {
    allowed = origin;
  } else if (prod.length > 0) {
    // Unknown origin in prod — echo the first configured prod origin so the
    // CORS contract is at least coherent for the most common deploy URL.
    allowed = prod[0];
  } else {
    allowed = 'http://localhost:5173';
  }

  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '3600',
    'vary': 'origin',
  };
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json',
    },
  });
}
