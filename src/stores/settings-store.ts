import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { SettingsRow } from '../lib/database.types';

export interface SettingsState {
  settings: SettingsRow | null;
  loading: boolean;
  load: (userId: string) => Promise<void>;
  ensureExists: (userId: string) => Promise<SettingsRow>;
  update: (userId: string, patch: Partial<SettingsRow>) => Promise<void>;
}

let currentLoadSequence = 0;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,

  load: async (userId: string): Promise<void> => {
    if (!userId) {
      set({ settings: null, loading: false });
      return;
    }

    const loadId = ++currentLoadSequence;
    set({ loading: true });

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[settings-store] Failed to load settings:', error);
      }

      // Ignore out-of-order responses from stale load calls
      if (loadId === currentLoadSequence) {
        set({ settings: data ?? null, loading: false });
      }
    } catch (err) {
      console.error('[settings-store] Error in load:', err);
      if (loadId === currentLoadSequence) {
        set({ loading: false });
      }
    }
  },

  ensureExists: async (userId: string): Promise<SettingsRow> => {
    if (!userId) {
      throw new Error('[settings-store] userId is required for ensureExists');
    }

    const existing = get().settings;
    if (existing && existing.user_id === userId) return existing;

    const { data, error } = await supabase
      .from('settings')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('[settings-store] ensureExists returned no data');

    set({ settings: data });
    return data;
  },

  update: async (userId: string, patch: Partial<SettingsRow>): Promise<void> => {
    if (!userId) {
      throw new Error('[settings-store] userId is required for update');
    }

    const { data, error } = await supabase
      .from('settings')
      .update(patch)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('[settings-store] update returned no data');

    set({ settings: data });
  },
}));
