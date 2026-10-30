import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPathTerms,
  fetchUserProfile,
  fetchUserProgress,
  upsertUserProfile,
} from '../lib/data';
import { GUIDED_PROGRAMS } from '../lib/guided-programs';
import { useLessonStore } from '../stores/lesson-store';
import { useUserStore } from '../stores/user-store';
import GuidedProgramRoute from './guided-program';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../lib/data', () => ({
  fetchPathTerms: vi.fn(),
  fetchUserProfile: vi.fn(),
  fetchUserProgress: vi.fn(),
  upsertUserProfile: vi.fn(),
}));

const program = GUIDED_PROGRAMS['agentic-era-operator'];
const terms = program.modules.flatMap((module) =>
  module.termIds.map((id, index) => ({
    id,
    term: id.replace('era-', '').replaceAll('-', ' '),
    path: 'ai-agentic-era',
    domain: 'ai',
    difficulty: ((index % 3) + 1) as 1 | 2 | 3,
  })),
);

function renderCourse(programId = 'agentic-era-operator') {
  return render(
    <MemoryRouter initialEntries={[`/program/${programId}`]}>
      <Routes>
        <Route path="/program/:programId" element={<GuidedProgramRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GuidedProgramRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({
      user: { id: 'learner' } as never,
      loading: false,
    });
    vi.mocked(fetchPathTerms).mockResolvedValue(terms as never);
    vi.mocked(fetchUserProgress).mockResolvedValue({});
    vi.mocked(fetchUserProfile).mockResolvedValue({
      guided_program_id: 'agentic-era-operator',
    } as never);
  });

  it('renders the full eight-module, 30-term course map', async () => {
    renderCourse();

    expect(
      await screen.findByRole('heading', { name: 'the second sword' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 of 30 terms mastered')).toBeInTheDocument();
    expect(screen.getAllByText(/module \d ·/i)).toHaveLength(8);
    expect(
      screen.getByRole('heading', { name: /ask the same five questions twice/i }),
    ).toBeInTheDocument();
  });

  it('starts a lesson from the first module and routes to the lesson runner', async () => {
    const start = vi.fn();
    useLessonStore.setState({ start } as never);
    renderCourse();

    const button = await screen.findByRole('button', {
      name: /continue with power on/i,
    });
    fireEvent.click(button);

    expect(start).toHaveBeenCalledWith(
      'ai-agentic-era',
      expect.arrayContaining([
        expect.objectContaining({ id: 'era-rules-based-system' }),
      ]),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/lesson');
  });

  it('fails closed when the live path is missing vocabulary', async () => {
    vi.mocked(fetchPathTerms).mockResolvedValue(terms.slice(0, 29) as never);
    renderCourse();

    await waitFor(() => {
      expect(
        screen.getByRole('alert'),
      ).toHaveTextContent(/missing 1 vocabulary item/i);
    });
    expect(
      screen.getAllByRole('button', { name: /practice this module/i })[0],
    ).toBeDisabled();
  });

  it('handles unknown program ids without a blank screen', () => {
    renderCourse('not-registered');

    expect(
      screen.getByRole('heading', { name: /course is not registered/i }),
    ).toBeInTheDocument();
  });

  it('toggles course enrollment when set as active course is tapped', async () => {
    vi.mocked(fetchUserProfile).mockResolvedValue({
      guided_program_id: null,
    } as never);
    vi.mocked(upsertUserProfile).mockResolvedValue({
      guided_program_id: 'agentic-era-operator',
    } as never);

    renderCourse();

    const button = await screen.findByRole('button', {
      name: /set as active course/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(upsertUserProfile).toHaveBeenCalledWith('learner', {
        guided_program_id: 'agentic-era-operator',
        active_domain: 'ai',
      });
    });
  });
});

