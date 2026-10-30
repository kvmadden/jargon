import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260726090000_product_feedback_loop.sql',
);
const migration = readFileSync(migrationPath, 'utf8');
const profileMigrationPath = join(process.cwd(), 'supabase/schema-history/cloud-migration-038.sql');
const profileMigration = readFileSync(profileMigrationPath, 'utf8');
const ownerFunction = migration.match(
  /create or replace function public\.is_jargon_owner\(\)[\s\S]*?\$\$;/,
)?.[0] ?? '';
const askPilotFunction = migration.match(
  /create or replace function public\.ask_jargon_pilot\([\s\S]*?\$\$;/,
)?.[0] ?? '';
const profileFunction = profileMigration.match(
  /create or replace function upsert_user_profile_atomic\([\s\S]*?\$\$;/,
)?.[0] ?? '';

describe('Jargon security function source contract', () => {
  it('enables RLS and binds participant rows to auth.uid()', () => {
    expect(migration).toContain('alter table public.product_feedback enable row level security');
    expect(migration).toContain("(select auth.uid()) = author_user_id");
    expect(migration).toContain("(select auth.uid()) = asked_user_id");
    expect(migration).toContain("kind = 'submission'");
  });

  it('keeps privileged mutations behind hardened functions', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('revoke all on function public.reply_to_product_feedback');
    expect(migration).toContain('revoke all on function public.ask_jargon_pilot');
    expect(migration).not.toContain('grant update on table public.product_feedback to authenticated');
  });

  it('keeps the owner caller distinct from the allowlisted pilot recipient', () => {
    expect(ownerFunction).toContain('lower(allowed.email) = lower(auth.email())');
    expect(ownerFunction).toContain("allowed.role = 'owner'");
    expect(askPilotFunction).toContain('if not public.is_jargon_owner()');
    expect(askPilotFunction).toMatch(
      /join public\.allowed_users allowed\s+on lower\(allowed\.email\) = lower\(users\.email\)/,
    );
    expect(askPilotFunction).toContain('where users.id = p_asked_user_id');
    expect(askPilotFunction).toMatch(
      /author_user_id,\s*asked_user_id[\s\S]*?auth\.uid\(\),\s*p_asked_user_id/,
    );
    expect(askPilotFunction).not.toMatch(
      /(?:p_asked_user_id\s*=\s*auth\.uid\(\)|auth\.uid\(\)\s*=\s*p_asked_user_id)/,
    );
  });

  it('binds atomic profile writes to the authenticated target user', () => {
    expect(profileFunction).toMatch(
      /auth\.uid\(\)\s+is\s+null\s+or\s+auth\.uid\(\)\s*<>\s*p_user_id/,
    );
    expect(profileFunction).toContain(
      "raise exception 'forbidden: caller is not the target user'",
    );
  });

  it('bounds feedback, screenshots, and context', () => {
    expect(migration).toContain('between 1 and 4000');
    expect(migration).toContain('char_length(screenshot_data) <= 2000000');
    expect(migration).toContain('pg_column_size(context) <= 16384');
  });
});
