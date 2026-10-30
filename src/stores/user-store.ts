import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { _resetProfileStepSeen } from '../lib/onboarding-session';

export interface UserState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setSession: (s: Session | null) => void;
  /**
   * Initializes the store and subscribes to auth state changes.
   * Returns an `unsubscribe` callback so the caller (App.tsx) can drop the listener
   * on unmount — without this, React StrictMode (and HMR) leaves dangling subscriptions
   * that cascade into duplicate setState calls and noisy console warnings.
   */
  init: () => Promise<() => void>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  session: null,
  loading: true,

  setSession: (s: Session | null) => set({ session: s, user: s?.user ?? null }),

  init: async (): Promise<() => void> => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[user-store] Failed to get auth session:', error);
        set({ session: null, user: null, loading: false });
      } else {
        set({ session: data.session, user: data.session?.user ?? null, loading: false });
      }
    } catch (err) {
      console.error('[user-store] Error getting auth session:', err);
      set({ session: null, user: null, loading: false });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      set({ session: sess, user: sess?.user ?? null });
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  },

  signOut: async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[user-store] Error signing out:', err);
    } finally {
      set({ session: null, user: null });
      // BLOCKER fix from code-reviewer: clear the onboarding-session memo so a
      // returning user (or a different user on a shared device) gets re-prompted
      // through the profile step instead of being silently bounced past it.
      _resetProfileStepSeen();
    }
  },
}));
