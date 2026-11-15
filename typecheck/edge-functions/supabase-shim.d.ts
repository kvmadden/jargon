// Loose type surface of `https://esm.sh/@supabase/supabase-js@2.45.4` for
// type-checking the Edge Functions under Node. Query results are `any` here,
// as they effectively are in the functions, so the check focuses on jargon's
// own code rather than on database typings this project does not generate.
// deno-lint-ignore-file no-explicit-any
export type SupabaseClient = any;
export function createClient(url: string, key: string, options?: Record<string, unknown>): any;
