/**
 * Google OAuth helper for jargon (side reaction family).
 *
 * REMAINING MANUAL SETUP STEP FOR KEVIN:
 * 1. Create a Google Cloud OAuth 2.0 Client ID in GCP Console (APIs & Services -> Credentials).
 *    Note: You can reuse an existing GCP project used for other side-reaction apps or create a new one.
 * 2. Configure authorized redirect URI in GCP Console:
 *    https://<your-supabase-project-id>.supabase.co/auth/v1/callback
 * 3. In Supabase Dashboard -> Authentication -> Providers -> Google:
 *    Enable Google provider, paste Client ID + Client Secret, and save.
 */

import { supabase } from './supabase';

export async function signInWithGoogle() {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });
}
