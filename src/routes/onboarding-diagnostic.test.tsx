import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingDiagnostic from './onboarding-diagnostic';
import { useUserStore } from '../stores/user-store';
import { useSettingsStore } from '../stores/settings-store';
import { fetchAllTerms } from '../lib/data';
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

// Mock data fetch
vi.mock('../lib/data', () => ({
  fetchAllTerms: vi.fn(),
}));

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({
        error: null,
      })),
    })),
  },
}));

const MOCK_TERMS = Array.from({ length: 15 }, (_, i) => ({
  id: `term-${i}`,
  term: `Term ${i}`,
  one_line_definition: `Definition ${i}`,
  long_definition: `Long definition ${i}`,
  why_it_matters: `Why it matters ${i}`,
  example_in_sentence: `Example ${i}`,
  path: 'git-cli',
  difficulty: 1,
  pronunciation: null,
  related_terms: [],
  stretch_term: null,
  is_lived_icon_allowed: false,
  multiple_choice_distractors: ['option A', 'option B', 'option C'],
}));

describe('OnboardingDiagnostic route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'curator' } as any,
      session: null,
      loading: false,
    });
    useSettingsStore.setState({
      settings: null,
    });
    vi.spyOn(useSettingsStore.getState(), 'ensureExists').mockResolvedValue(undefined as any);
    vi.spyOn(useSettingsStore.getState(), 'update').mockResolvedValue(undefined as any);
    vi.mocked(fetchAllTerms).mockResolvedValue(MOCK_TERMS as any);
  });

  it('renders intro page with options', async () => {
    render(
      <MemoryRouter>
        <OnboardingDiagnostic />
      </MemoryRouter>,
    );

    expect(screen.getByText(/want to skip ahead\?/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take the 10-question check/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
  });

  it('skips diagnostic when skip is clicked', async () => {
    render(
      <MemoryRouter>
        <OnboardingDiagnostic />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

    const store = useSettingsStore.getState();
    await waitFor(() => {
      expect(store.ensureExists).toHaveBeenCalledWith('curator');
      expect(store.update).toHaveBeenCalledWith('curator', { diagnostic_completed: true });
      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
  });

  it('starts quiz when check is clicked', async () => {
    render(
      <MemoryRouter>
        <OnboardingDiagnostic />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /take the 10-question check/i })).not.toBeDisabled();
    });

    const checkBtn = screen.getByRole('button', { name: /take the 10-question check/i });
    fireEvent.click(checkBtn);

    // Wait for the first question to load
    await waitFor(() => {
      expect(screen.getByText(/1\s*\/\s*10/i)).toBeInTheDocument();
    });
  });

  it('shows error explanation and retry button in intro when fetchAllTerms fails', async () => {
    vi.mocked(fetchAllTerms).mockRejectedValue(new Error('Fetch failed'));

    render(
      <MemoryRouter>
        <OnboardingDiagnostic />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/couldn't load terms for the diagnostic check/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try loading questions again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
    });
  });

  it('shows actionable error screen with retry and skip when quiz has no terms', async () => {
    vi.mocked(fetchAllTerms).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <OnboardingDiagnostic />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no diagnostic terms available right now/i)).toBeInTheDocument();
    });
  });
});

