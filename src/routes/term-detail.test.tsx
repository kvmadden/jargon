import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TermDetail from './term-detail';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { fetchAllTerms, fetchLatestPersonalizationStatus, fetchPersonalizedRendering } from '../lib/data';
import { supabase } from '../lib/supabase';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock supabase
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn((table) => {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col, val) => ({
              maybeSingle: vi.fn(() => {
                if (table === 'terms' && val === 'dev-vite') {
                  return Promise.resolve({
                    data: {
                      id: 'dev-vite',
                      term: 'Vite',
                      pronunciation: '/veet/',
                      one_line_definition: 'A modern frontend build tool.',
                      long_definition: 'Vite is a build tool that aims to provide a faster and leaner development experience.',
                      example_in_sentence: 'We started our new React project using Vite.',
                      why_it_matters: 'It significantly improves hot module replacement speed.',
                      path: 'git-cli',
                    },
                    error: null,
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }),
            })),
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        };
      }),
    },
  };
});

// Mock data module
vi.mock('../lib/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/data')>();
  return {
    ...actual,
    fetchAllTerms: vi.fn().mockResolvedValue([]),
    fetchLatestPersonalizationStatus: vi.fn().mockResolvedValue({ status: 'disabled' }),
    fetchPersonalizedRendering: vi.fn().mockResolvedValue({ status: 'disabled' }),
    requestPersonalization: vi.fn().mockResolvedValue({ isFallback: true }),
  };
});

describe('TermDetail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    useSettingsStore.setState({
      settings: {
        personalization_enabled: true,
        first_personalization_seen_at: '2026-07-22T00:00:00Z',
      } as any,
    });
    vi.mocked(fetchLatestPersonalizationStatus).mockResolvedValue({ status: 'disabled' } as any);
    vi.mocked(fetchPersonalizedRendering).mockResolvedValue({ status: 'disabled' } as any);

    // Set default mock implementation for supabase.from
    vi.mocked(supabase.from).mockImplementation((table) => {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((col, val) => ({
            maybeSingle: vi.fn(() => {
              if (table === 'terms' && val === 'dev-vite') {
                return Promise.resolve({
                  data: {
                    id: 'dev-vite',
                    term: 'Vite',
                    pronunciation: '/veet/',
                    one_line_definition: 'A modern frontend build tool.',
                    long_definition: 'Vite is a build tool that aims to provide a faster and leaner development experience.',
                    example_in_sentence: 'We started our new React project using Vite.',
                    why_it_matters: 'It significantly improves hot module replacement speed.',
                    path: 'git-cli',
                  },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
          })),
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      } as any;
    });
  });

  it('renders loading state initially', () => {
    // Return a pending promise for supabase to simulate loading
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => new Promise(() => {})),
        })),
      })),
    } as any);

    render(
      <MemoryRouter initialEntries={['/term/dev-vite']}>
        <Routes>
          <Route path="/term/:termId" element={<TermDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('loading…')).toBeInTheDocument();
  });

  it('renders not found state if termId is invalid', async () => {
    render(
      <MemoryRouter initialEntries={['/term/invalid-id']}>
        <Routes>
          <Route path="/term/:termId" element={<TermDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('term not found')).toBeInTheDocument();
    });
  });

  it('renders term details when loaded successfully', async () => {
    render(
      <MemoryRouter initialEntries={['/term/dev-vite']}>
        <Routes>
          <Route path="/term/:termId" element={<TermDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vite' })).toBeInTheDocument();
      expect(screen.getByText('A modern frontend build tool.')).toBeInTheDocument();
    });
  });

  it('renders pronounce button when speechSynthesis is available', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: { cancel: vi.fn(), speak: vi.fn() },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        text = '';
        lang = '';
        rate = 1;
      },
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter initialEntries={['/term/dev-vite']}>
        <Routes>
          <Route path="/term/:termId" element={<TermDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'hear "vite" pronounced' })).toBeInTheDocument();
    });
  });
});

describe('stale and reported renderings are never displayed', () => {
  const BAD = 'think of how you can only open charts for patients on your unit (reported as wrong)';
  const staleResult = (reportedAt: string | null, promptVersion: number) => ({
    status: 'stale',
    rendering: {
      user_id: 'curator', term_id: 'dev-vite', long_definition: BAD, why_it_matters: 'stale why',
      example_in_sentence: 'stale example', rendered_at: '2026-10-01', profile_version_at_render: 1,
      model_used: 'claude-opus-4-7', prompt_version: promptVersion, reported_at: reportedAt,
    },
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { _resetInFlightPersonalizations } = await import('./term-detail');
    _resetInFlightPersonalizations();
    useUserStore.setState({ user: { id: 'curator' } as any, session: null, loading: false });
    useSettingsStore.setState({ settings: { personalization_enabled: true, first_personalization_seen_at: '2026-07-22T00:00:00Z' } as any });
    vi.mocked(fetchLatestPersonalizationStatus).mockResolvedValue(null as any);
    vi.mocked(supabase.from).mockImplementation((table: any) => ({
      select: vi.fn(() => ({
        eq: vi.fn((_c: any, val: any) => ({
          maybeSingle: vi.fn(() => table === 'terms' && val === 'dev-vite'
            ? Promise.resolve({ data: { id: 'dev-vite', term: 'Vite', pronunciation: null, one_line_definition: 'A modern frontend build tool.', long_definition: 'CANONICAL long definition.', example_in_sentence: 'canonical example.', why_it_matters: 'canonical why.', path: 'git-cli' }, error: null })
            : Promise.resolve({ data: null, error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    }) as any);
  });

  it.each([
    ['reported by the learner', '2026-11-01T00:00:00Z', 10],
    ['made under an older prompt version', null, 9],
  ])('shows the canonical text, not a rendering %s, when regeneration falls back', async (_label, reportedAt, version) => {
    const { requestPersonalization } = await import('../lib/data');
    vi.mocked(fetchPersonalizedRendering).mockResolvedValue(staleResult(reportedAt, version) as any);
    vi.mocked(requestPersonalization).mockResolvedValue({
      long_definition: 'CANONICAL long definition.', why_it_matters: 'canonical why.',
      example_in_sentence: 'canonical example.', fromCache: false, isFallback: true, needsReview: true,
    } as any);
    render(
      <MemoryRouter initialEntries={['/term/dev-vite']}>
        <Routes><Route path="/term/:termId" element={<TermDetail />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(requestPersonalization).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText(BAD, { exact: false })).toBeNull();
    expect(screen.getByText('CANONICAL long definition.', { exact: false })).toBeInTheDocument();
  });
});

describe('dedupedRequestPersonalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates concurrent requests for the same termId and delivers to both callers', async () => {
    const { dedupedRequestPersonalization, _resetInFlightPersonalizations } = await import('./term-detail');
    const { requestPersonalization } = await import('../lib/data');

    _resetInFlightPersonalizations();

    let resolveRequest: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveRequest = resolve;
    });

    vi.mocked(requestPersonalization).mockImplementation(() => pendingPromise as any);

    // Call dedupedRequestPersonalization twice concurrently for 'term-1'
    const p1 = dedupedRequestPersonalization('term-1');
    const p2 = dedupedRequestPersonalization('term-1');

    // Should only call requestPersonalization ONCE
    expect(requestPersonalization).toHaveBeenCalledTimes(1);

    const mockResult = {
      long_definition: 'def',
      why_it_matters: 'why',
      example_in_sentence: 'ex',
      isFallback: false,
    };

    resolveRequest(mockResult);

    const [res1, res2] = await Promise.all([p1, p2]);

    // Both callers get the exact same result
    expect(res1).toEqual(mockResult);
    expect(res2).toEqual(mockResult);

    // Now that the request is resolved, a subsequent call should trigger a NEW fetch
    const p3 = dedupedRequestPersonalization('term-1');
    expect(requestPersonalization).toHaveBeenCalledTimes(2);
    resolveRequest(mockResult);
    await p3;
  });

  it('keeps concurrent requests for two accounts apart, so one never receives the other result', async () => {
    const { dedupedRequestPersonalization, _resetInFlightPersonalizations } = await import('./term-detail');
    const { requestPersonalization } = await import('../lib/data');
    _resetInFlightPersonalizations();

    const resolvers: Array<(v: any) => void> = [];
    vi.mocked(requestPersonalization).mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)) as any,
    );

    const forA = dedupedRequestPersonalization('term-3', 'user-a');
    const forB = dedupedRequestPersonalization('term-3', 'user-b');
    expect(requestPersonalization).toHaveBeenCalledTimes(2);

    resolvers[0]({ long_definition: 'for a', why_it_matters: '', example_in_sentence: '', isFallback: false });
    resolvers[1]({ long_definition: 'for b', why_it_matters: '', example_in_sentence: '', isFallback: false });
    expect((await forA).long_definition).toBe('for a');
    expect((await forB).long_definition).toBe('for b');
  });

  it('cleans up in-flight entry on request failure so subsequent calls can retry', async () => {
    const { dedupedRequestPersonalization, _resetInFlightPersonalizations } = await import('./term-detail');
    const { requestPersonalization } = await import('../lib/data');

    _resetInFlightPersonalizations();

    vi.mocked(requestPersonalization).mockRejectedValueOnce(new Error('Network error'));

    const p1 = dedupedRequestPersonalization('term-2');
    await expect(p1).rejects.toThrow('Network error');

    // Next request should retry (not stuck in-flight)
    vi.mocked(requestPersonalization).mockResolvedValueOnce({
      long_definition: 'def2',
      why_it_matters: 'why2',
      example_in_sentence: 'ex2',
      isFallback: false,
    } as any);

    const res2 = await dedupedRequestPersonalization('term-2');
    expect(res2.long_definition).toBe('def2');
    expect(requestPersonalization).toHaveBeenCalledTimes(2);
  });
});

