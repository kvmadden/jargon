// Type-check shim for running `tsc` over the Edge Functions under Node.
// It declares only the Deno surface these functions use. It is never
// deployed: Supabase bundles from each function's index.ts import graph.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
