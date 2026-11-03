// Minimal type surface of `https://esm.sh/@anthropic-ai/sdk@0.32.1` used by the
// Edge Functions, for type-checking under Node where the SDK is not installed.
export default class Anthropic {
  constructor(options: { apiKey?: string; baseURL?: string });
  messages: {
    create(body: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
  };
}
