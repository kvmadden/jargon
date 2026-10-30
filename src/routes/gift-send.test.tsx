/**
 * QA tests for gift-send.tsx — AI compose mode (B+1.12 sprint).
 *
 * Covers the ComposeView surface and mode transitions:
 *   1.  Initial render shows compose mode (not wizard, not review)
 *   2.  Voice button visible when isVoiceSupported returns true
 *   3.  Voice button hidden when isVoiceSupported returns false
 *   4.  "compose with AI →" CTA is disabled when email field is empty
 *   5.  "compose with AI →" CTA is disabled when name field is empty
 *   6.  "compose with AI →" CTA is disabled when describe textarea is empty
 *   7.  Loading state shows while composeGiftProfile is pending
 *   8.  On success (non-fallback), transitions to review mode
 *   9.  On fallback response, transitions to wizard mode
 *   10. Tapping "compose by hand instead →" goes directly to wizard mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../stores/user-store', () => ({
  useUserStore: (selector: (s: { user: { id: string; email: string } }) => unknown) =>
    selector({ user: { id: 'fake-user-id', email: 'owner@example.com' } }),
}));

const mockPushToast = vi.fn();
vi.mock('../components/toast', () => ({
  useToastStore: (selector: (s: { push: typeof mockPushToast }) => unknown) =>
    selector({ push: mockPushToast }),
}));

vi.mock('../components/wordmark', () => ({
  Wordmark: () => <div data-testid="wordmark" />,
}));

const mockComposeGiftProfile = vi.fn();
const mockSendGiftInvite = vi.fn();
const mockPickLivedIcons = vi.fn(async () => [] as string[]);

vi.mock('../lib/data', () => ({
  composeGiftProfile: (...args: unknown[]) => mockComposeGiftProfile(...args),
  sendGiftInvite: (...args: unknown[]) => mockSendGiftInvite(...args),
  pickLivedIcons: (...args: unknown[]) => mockPickLivedIcons(...args),
  generateJobFollowup: vi.fn(async () => ({ question: '', chips: [], isFallback: true })),
  EMPTY_PREFILLED_PROFILE: {
    goals_extended: [],
    goals_freeform: null,
    job: null,
    encounter_contexts: [],
    interests: [],
    heritage: null,
    roles: [],
    background_text: null,
    active_domain: null,
    display_name: null,
    relationship: null,
    lived_icons: [],
    lived_icon_url: null,
  },
}));

// voice-input mock — controlled per test
const mockIsVoiceSupported = vi.fn(() => true);
const mockCreateVoiceSession = vi.fn(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('../lib/voice-input', () => ({
  isVoiceSupported: () => mockIsVoiceSupported(),
  createVoiceSession: (...args: unknown[]) => mockCreateVoiceSession(...args),
}));

vi.mock('../lib/interest-dictionary', () => ({
  searchInterests: () => [],
}));

vi.mock('../lib/onboarding-session', () => ({
  markProfileStepSeen: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import GiftSend from './gift-send';

function renderGiftSend(url = '/gift/send') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <GiftSend />
    </MemoryRouter>,
  );
}

/** A valid compose-gift-profile success response shape. */
const HAPPY_COMPOSE_RESPONSE = {
  proposed_profile: {
    goals_extended: [],
    goals_freeform: 'wants to follow what his daughters do',
    job: 'retired biology professor',
    encounter_contexts: ['family / friends'],
    interests: ['nature', 'soccer'],
    heritage: 'Liverpool, England',
    roles: ['parent'],
    background_text: 'lives in Tampa.',
    display_name: 'Pop',
    relationship: 'father-in-law',
    lived_icons: [],
    lived_icon_url: null,
  },
  custom_message_draft: 'pop — made this for you.',
  private_reasoning_draft: 'he keeps asking.',
  lived_icons: ['leaf', 'soccer-ball'],
  confidence: 'high' as const,
  isFallback: undefined,
};

const FALLBACK_COMPOSE_RESPONSE = {
  proposed_profile: {
    goals_extended: [],
    goals_freeform: null,
    job: null,
    encounter_contexts: [],
    interests: [],
    heritage: null,
    roles: [],
    background_text: null,
    display_name: null,
    relationship: null,
    lived_icons: [],
    lived_icon_url: null,
  },
  custom_message_draft: '',
  private_reasoning_draft: '',
  lived_icons: [],
  confidence: 'low' as const,
  isFallback: true,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockIsVoiceSupported.mockReturnValue(true);
  mockComposeGiftProfile.mockResolvedValue(HAPPY_COMPOSE_RESPONSE);
  mockSendGiftInvite.mockResolvedValue({ invite_id: 'inv-new', sent: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GiftSend — compose mode (B+1.12)', () => {
  it('hydrates the reusable guided-program preset from the setup URL', () => {
    renderGiftSend(
      '/gift/send?program=agentic-era-operator&name=Learner',
    );

    expect(screen.getByDisplayValue('Learner')).toBeInTheDocument();
    expect(
      screen.getByRole('region', {
        name: /guided program: the second sword/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/8 modules · 30 terms/i)).toBeInTheDocument();
  });

  it('lets the sender remove the guided preset without changing the gift flow', () => {
    renderGiftSend('/gift/send?program=agentic-era-operator');

    fireEvent.click(
      screen.getByRole('button', { name: /use normal jargon instead/i }),
    );

    expect(
      screen.queryByRole('region', {
        name: /guided program: the second sword/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /attach the second sword/i }),
    ).toBeInTheDocument();
  });

  it('initial render shows compose mode (not wizard, not review)', () => {
    renderGiftSend();

    // Compose mode heading
    expect(screen.getByText(/set up jargon for someone you love/i)).toBeInTheDocument();

    // Primary CTA is the compose button
    expect(screen.getByRole('button', { name: /compose with AI/i })).toBeInTheDocument();

    // Wizard-specific step counter reads "step 1 of 2" in compose mode
    // (not "step 1 of 13")
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();

    // Wizard nav elements are NOT visible (no "step 1 of 13")
    expect(screen.queryByText(/step 1 of 13/i)).not.toBeInTheDocument();
  });

  it('voice button is visible when isVoiceSupported returns true', () => {
    mockIsVoiceSupported.mockReturnValue(true);
    renderGiftSend();

    // The dictate button has aria-pressed attribute (it's a toggle button)
    const dictateBtn = screen.getByRole('button', { name: /dictate/i });
    expect(dictateBtn).toBeInTheDocument();
  });

  it('voice button is hidden when isVoiceSupported returns false', () => {
    mockIsVoiceSupported.mockReturnValue(false);
    renderGiftSend();

    // No dictate/voice button
    expect(screen.queryByRole('button', { name: /dictate/i })).not.toBeInTheDocument();

    // Shows the fallback copy about browser not supporting voice
    expect(screen.getByText(/your browser doesn't support voice input/i)).toBeInTheDocument();
  });

  it('"compose with AI →" is disabled when email is empty', () => {
    renderGiftSend();

    // Fill name but not email
    const nameInput = screen.getByPlaceholderText(/mom · dad · jesse/i);
    fireEvent.change(nameInput, { target: { value: 'Pop' } });

    const describeTextarea = screen.getByPlaceholderText(/your father-in-law/i);
    fireEvent.change(describeTextarea, { target: { value: 'biology professor' } });

    const cta = screen.getByRole('button', { name: /compose with AI/i });
    expect(cta).toBeDisabled();
  });

  it('"compose with AI →" is disabled when name is empty', () => {
    renderGiftSend();

    const emailInput = screen.getByPlaceholderText(/name@example.com/i);
    fireEvent.change(emailInput, { target: { value: 'pop@example.com' } });

    const describeTextarea = screen.getByPlaceholderText(/your father-in-law/i);
    fireEvent.change(describeTextarea, { target: { value: 'biology professor' } });

    const cta = screen.getByRole('button', { name: /compose with AI/i });
    expect(cta).toBeDisabled();
  });

  it('"compose with AI →" is disabled when describe textarea is empty', () => {
    renderGiftSend();

    const nameInput = screen.getByPlaceholderText(/mom · dad · jesse/i);
    fireEvent.change(nameInput, { target: { value: 'Pop' } });

    const emailInput = screen.getByPlaceholderText(/name@example.com/i);
    fireEvent.change(emailInput, { target: { value: 'pop@example.com' } });

    // No describe text
    const cta = screen.getByRole('button', { name: /compose with AI/i });
    expect(cta).toBeDisabled();
  });

  it('shows loading state while composeGiftProfile is pending', async () => {
    // Make composeGiftProfile never resolve during this test
    let resolveCompose!: () => void;
    mockComposeGiftProfile.mockReturnValue(
      new Promise<typeof HAPPY_COMPOSE_RESPONSE>((resolve) => {
        resolveCompose = () => resolve(HAPPY_COMPOSE_RESPONSE);
      }),
    );

    renderGiftSend();

    fireEvent.change(screen.getByPlaceholderText(/mom · dad · jesse/i), {
      target: { value: 'Pop' },
    });
    fireEvent.change(screen.getByPlaceholderText(/name@example.com/i), {
      target: { value: 'pop@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your father-in-law/i), {
      target: { value: 'retired biology professor, loves birds' },
    });

    fireEvent.click(screen.getByRole('button', { name: /compose with AI/i }));

    // One of the cycling loading messages should appear
    await waitFor(() => {
      const loadingMsgs = ['reading…', 'thinking…', 'drafting…', 'picking icons…'];
      const found = loadingMsgs.some((msg) => screen.queryByText(msg) !== null);
      expect(found).toBe(true);
    });

    // Resolve so the test cleans up
    resolveCompose();
  });

  it('on success transitions to review mode (shows recipient name in review)', async () => {
    mockComposeGiftProfile.mockResolvedValue(HAPPY_COMPOSE_RESPONSE);

    renderGiftSend();

    fireEvent.change(screen.getByPlaceholderText(/mom · dad · jesse/i), {
      target: { value: 'Pop' },
    });
    fireEvent.change(screen.getByPlaceholderText(/name@example.com/i), {
      target: { value: 'pop@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your father-in-law/i), {
      target: { value: 'retired biology professor' },
    });

    fireEvent.click(screen.getByRole('button', { name: /compose with AI/i }));

    // Review mode renders a summary — not the compose textarea placeholder anymore
    await waitFor(() => {
      // Review mode has "step 2 of 2" counter
      expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
    });

    // Compose textarea placeholder should be gone
    expect(screen.queryByPlaceholderText(/your father-in-law/i)).not.toBeInTheDocument();
  });

  it('on fallback response transitions to wizard mode', async () => {
    mockComposeGiftProfile.mockResolvedValue(FALLBACK_COMPOSE_RESPONSE);

    renderGiftSend();

    fireEvent.change(screen.getByPlaceholderText(/mom · dad · jesse/i), {
      target: { value: 'Pop' },
    });
    fireEvent.change(screen.getByPlaceholderText(/name@example.com/i), {
      target: { value: 'pop@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your father-in-law/i), {
      target: { value: 'something' },
    });

    fireEvent.click(screen.getByRole('button', { name: /compose with AI/i }));

    // Wizard mode shows "step 1 of 13" progress counter
    await waitFor(() => {
      expect(screen.getByText(/step 1 of 13/i)).toBeInTheDocument();
    });
  });

  it('"compose by hand instead →" goes directly to wizard mode without calling AI', () => {
    renderGiftSend();

    const manualBtn = screen.getByRole('button', { name: /compose by hand instead/i });
    fireEvent.click(manualBtn);

    // Should immediately show wizard step counter
    expect(screen.getByText(/step 1 of 13/i)).toBeInTheDocument();

    // composeGiftProfile should NOT have been called
    expect(mockComposeGiftProfile).not.toHaveBeenCalled();
  });
});
