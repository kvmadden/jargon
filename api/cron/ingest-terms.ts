// Vercel serverless function — weekly cron proxy for the ingest-terms Edge Function.
//
// This file exists so Vercel Cron has something to hit. It just forwards to the
// Supabase Edge Function with the service-role key as bearer auth — that key lives
// only in the Vercel runtime environment, never in the client bundle.
//
// Schedule defined in vercel.json: "0 6 * * 0" → every Sunday 06:00 UTC.

export const config = {
  // Cron jobs require nodejs runtime (not edge) per Vercel docs.
  runtime: 'nodejs',
  // Allow plenty of headroom — a 4-pass cycle over 10 candidates can take a minute or two.
  maxDuration: 300,
};

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
}

import { ALL_DOMAINS } from '../../src/lib/domains';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // Vercel sends CRON_SECRET as an Authorization bearer on scheduled
  // invocations. The x-vercel-cron marker is caller-controlled and therefore
  // not authentication.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(503).json({ error: 'server misconfigured: CRON_SECRET missing in Vercel env' });
    return;
  }

  const authorization = req.headers.authorization;
  if (Array.isArray(authorization) || authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceKey) {
    res
      .status(500)
      .json({ error: 'server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in Vercel env' });
    return;
  }

  try {
    const results: Record<string, unknown> = {};
    for (const domain of ALL_DOMAINS) {
      const upstream = await fetch(`${supabaseUrl}/functions/v1/ingest-terms`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'cron', domain }),
      });
      const body = await upstream.json().catch(() => ({}));
      results[domain] = { status: upstream.status, body };
    }
    // Vercel Cron's failure alerting keys on the HTTP status of THIS response, not
    // the per-domain upstream statuses in the body -- if every domain's ingest
    // failed, report that as a failure so a real outage doesn't look like a
    // successful weekly run.
    const anyDomainFailed = Object.values(results).some(
      (r) => typeof (r as { status?: number }).status === 'number' && (r as { status: number }).status >= 300,
    );
    res.status(anyDomainFailed ? 502 : 200).json({ results });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
