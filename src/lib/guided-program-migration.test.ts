import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260726145814_guided_program_invites.sql',
  ),
  'utf8',
).toLowerCase();

describe('guided program migration', () => {
  it('stores a constrained program id on invites and accepted profiles', () => {
    expect(sql).toContain('alter table public.gift_invites');
    expect(sql).toContain('alter table public.user_profile');
    expect(sql).toContain("guided_program_id in ('agentic-era-operator')");
    expect(sql).toContain('guided_program_id = v_invite.guided_program_id');
  });

  it('keeps program attachment inside atomic invite acceptance', () => {
    expect(sql).toContain('create or replace function public.accept_gift_invite_atomic');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from auth.users');
    expect(sql).toContain('from public.gift_invites');
    expect(sql).toContain('for update');
    expect(sql).toContain("'guided_program_id'");
  });

  it('finishes the onboarding gate and pins the guided course to AI atomically', () => {
    expect(sql).toContain('insert into public.settings (user_id, diagnostic_completed)');
    expect(sql).toContain('on conflict (user_id) do update');
    expect(sql).toContain('set diagnostic_completed = true');
    expect(sql).toContain("when v_invite.guided_program_id = 'agentic-era-operator'");
    expect(sql).toContain("then 'ai'");
  });

  it('does not expose the privileged function directly to browser roles', () => {
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });
});
