// Plain-fetch transport for the Message Batches API and the token-counting endpoint, with the failures sorted into the
// three kinds the batch loop in part-b-lib.ts understands. The base address is fixed and is not read from the
// environment, so a proxy variable cannot redirect the requests. An error's text is never kept, only its status and
// type, so nothing from a request can be echoed into a log.

import { ApiError, type BatchApi, type BatchInfo, type BatchRequest } from './part-b-lib.ts';

const BASE_URL = 'https://api.anthropic.com';
type FetchFn = typeof fetch;

function classify(status: number): ApiError['kind'] {
  if (status === 429 || status === 529) return 'rate_limited';
  if (status >= 500) return 'ambiguous';
  return 'rejected';
}

export function httpBatchApi(apiKey: string, fetchFn: FetchFn = fetch) {
  const headers = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  // The error text is never printed: only the status and the error type.
  const call = async (method: string, path: string, body?: unknown, timeoutMs = 120_000) => {
    let res: Response;
    try {
      res = await fetchFn(BASE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new ApiError('ambiguous', null, 'network error or timeout');
    }
    if (!res.ok) {
      let type = '';
      try {
        type = (await res.json())?.error?.type ?? '';
      } catch {
        // no readable body
      }
      throw new ApiError(classify(res.status), res.status, `http ${res.status} ${type}`.trim());
    }
    return res;
  };
  const api: BatchApi & { countTokens(params: BatchRequest['params']): Promise<number> } = {
    async createBatch(requests): Promise<BatchInfo> {
      return (await (await call('POST', '/v1/messages/batches', { requests })).json()) as BatchInfo;
    },
    async getBatch(id): Promise<BatchInfo> {
      return (await (await call('GET', `/v1/messages/batches/${encodeURIComponent(id)}`)).json()) as BatchInfo;
    },
    async findRecentBatch(total, sinceMs): Promise<BatchInfo | null> {
      const page: any = await (await call('GET', '/v1/messages/batches?limit=10')).json();
      for (const b of page?.data ?? []) {
        const c = b.request_counts ?? {};
        const n = (c.processing ?? 0) + (c.succeeded ?? 0) + (c.errored ?? 0) + (c.canceled ?? 0) + (c.expired ?? 0);
        if (n === total && Date.parse(b.created_at) >= sinceMs) return b as BatchInfo;
      }
      return null;
    },
    async getResults(id): Promise<string> {
      return await (await call('GET', `/v1/messages/batches/${encodeURIComponent(id)}/results`, undefined, 300_000)).text();
    },
    async countTokens(params): Promise<number> {
      const { model, system, messages } = params;
      const body: any = await (await call('POST', '/v1/messages/count_tokens', { model, system, messages })).json();
      return body.input_tokens as number;
    },
  };
  return api;
}
