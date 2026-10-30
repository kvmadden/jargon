import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore } from './settings-store';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function createMockBuilder(result: any) {
  const builder: any = {};
  const chainMethod = () => builder;

  builder.select = vi.fn(chainMethod);
  builder.eq = vi.fn(chainMethod);
  builder.insert = vi.fn(chainMethod);
  builder.update = vi.fn(chainMethod);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));

  return builder;
}

describe('settings-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ settings: null, loading: false });
  });

  it('loads settings for a user', async () => {
    const mockSettings = { user_id: 'user-1', theme: 'dark' };
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: mockSettings, error: null }));

    await useSettingsStore.getState().load('user-1');

    expect(useSettingsStore.getState().settings).toEqual(mockSettings);
    expect(useSettingsStore.getState().loading).toBe(false);
  });

  it('handles empty or falsy userId gracefully in load', async () => {
    await useSettingsStore.getState().load('');

    expect(useSettingsStore.getState().settings).toBeNull();
    expect(useSettingsStore.getState().loading).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('handles thrown error during load without stuck loading state', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('Network failure');
    });

    await useSettingsStore.getState().load('user-1');

    expect(useSettingsStore.getState().loading).toBe(false);
  });

  it('ignores stale out-of-order load responses (race condition prevention)', async () => {
    let resolveUser1: (val: any) => void = () => {};
    let resolveUser2: (val: any) => void = () => {};

    const promiseUser1 = new Promise((r) => {
      resolveUser1 = r;
    });
    const promiseUser2 = new Promise((r) => {
      resolveUser2 = r;
    });

    const builder1: any = {
      select: vi.fn(() => builder1),
      eq: vi.fn(() => builder1),
      maybeSingle: vi.fn(() => promiseUser1),
    };
    const builder2: any = {
      select: vi.fn(() => builder2),
      eq: vi.fn(() => builder2),
      maybeSingle: vi.fn(() => promiseUser2),
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(builder1)
      .mockReturnValueOnce(builder2);

    const load1Promise = useSettingsStore.getState().load('user-1');
    const load2Promise = useSettingsStore.getState().load('user-2');

    // Resolve user-2 first
    resolveUser2({ data: { user_id: 'user-2', theme: 'dark' }, error: null });
    await load2Promise;

    expect(useSettingsStore.getState().settings).toEqual({ user_id: 'user-2', theme: 'dark' });

    // Now resolve user-1 (stale response)
    resolveUser1({ data: { user_id: 'user-1', theme: 'light' }, error: null });
    await load1Promise;

    // user-1 stale response should be ignored!
    expect(useSettingsStore.getState().settings).toEqual({ user_id: 'user-2', theme: 'dark' });
  });

  it('ensureExists returns existing settings if present for same userId', async () => {
    const existingSettings = { user_id: 'user-1', theme: 'dark' } as any;
    useSettingsStore.setState({ settings: existingSettings });

    const result = await useSettingsStore.getState().ensureExists('user-1');
    expect(result).toBe(existingSettings);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('ensureExists inserts new settings if not present', async () => {
    const newSettings = { user_id: 'user-1', theme: 'light' } as any;
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: newSettings, error: null }));

    const result = await useSettingsStore.getState().ensureExists('user-1');
    expect(result).toEqual(newSettings);
    expect(useSettingsStore.getState().settings).toEqual(newSettings);
  });

  it('ensureExists throws if userId is missing', async () => {
    await expect(useSettingsStore.getState().ensureExists('')).rejects.toThrow('userId is required');
  });

  it('ensureExists throws on supabase error or missing data', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Insert failed') }));

    await expect(useSettingsStore.getState().ensureExists('user-1')).rejects.toThrow('Insert failed');

    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: null }));
    await expect(useSettingsStore.getState().ensureExists('user-1')).rejects.toThrow('returned no data');
  });

  it('updates settings', async () => {
    const updatedSettings = { user_id: 'user-1', theme: 'system' } as any;
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: updatedSettings, error: null }));

    await useSettingsStore.getState().update('user-1', { theme: 'system' } as any);
    expect(useSettingsStore.getState().settings).toEqual(updatedSettings);
  });

  it('update throws if userId is missing', async () => {
    await expect(useSettingsStore.getState().update('', { theme: 'system' } as any)).rejects.toThrow(
      'userId is required',
    );
  });

  it('update throws on supabase error or missing data', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: new Error('Update failed') }));

    await expect(useSettingsStore.getState().update('user-1', { theme: 'system' } as any)).rejects.toThrow(
      'Update failed',
    );

    vi.mocked(supabase.from).mockReturnValue(createMockBuilder({ data: null, error: null }));
    await expect(useSettingsStore.getState().update('user-1', { theme: 'system' } as any)).rejects.toThrow(
      'returned no data',
    );
  });
});
