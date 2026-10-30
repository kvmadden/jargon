import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeleteAccount from './delete-account';
import { useUserStore } from '../stores/user-store';
import { useToastStore } from '../components/toast';
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

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('DeleteAccount route', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clear();

    useUserStore.setState({
      user: { id: 'test-user-id', email: 'test@example.com' } as any,
      session: { access_token: 'fake-jwt-token' } as any,
      loading: false,
      signOut: mockSignOut,
    });

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'fake-jwt-token' } as any },
      error: null,
    });
  });

  it('renders heading, export option, and confirmation input', () => {
    render(
      <MemoryRouter>
        <DeleteAccount />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'delete account & data' })).toBeInTheDocument();
    expect(screen.getByText('download a summary of your data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'download my data' })).toBeInTheDocument();
    expect(screen.getByText('permanent deletion')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('delete my account')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: 'permanently delete my account' });
    expect(deleteBtn).toBeDisabled();
  });

  it('enables delete button only when phrase matches "delete my account"', () => {
    render(
      <MemoryRouter>
        <DeleteAccount />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('delete my account');
    const deleteBtn = screen.getByRole('button', { name: 'permanently delete my account' });

    expect(deleteBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'wrong phrase' } });
    expect(deleteBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'delete my account' } });
    expect(deleteBtn).not.toBeDisabled();
  });

  it('calls edge function and signs out user on successful deletion', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    render(
      <MemoryRouter>
        <DeleteAccount />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'delete my account' } });

    const deleteBtn = screen.getByRole('button', { name: 'permanently delete my account' });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/delete-account'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer fake-jwt-token',
          }),
        }),
      );
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    fetchSpy.mockRestore();
  });

  it('shows error banner when deletion fails server-side', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: 'failed to delete from grade_sentence_log' }),
    } as Response);

    render(
      <MemoryRouter>
        <DeleteAccount />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('delete my account');
    fireEvent.change(input, { target: { value: 'delete my account' } });

    const deleteBtn = screen.getByRole('button', { name: 'permanently delete my account' });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('failed to delete from grade_sentence_log')).toBeInTheDocument();
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    fetchSpy.mockRestore();
  });

  it('triggers JSON blob export when "download my data" is clicked', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { job: 'developer' } });

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    } as any);

    // Mock URL.createObjectURL & revokeObjectURL & HTMLAnchorElement click
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <DeleteAccount />
      </MemoryRouter>,
    );

    const exportBtn = screen.getByRole('button', { name: 'download my data' });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');
      expect(useToastStore.getState().toasts[0]?.message).toBe('data export downloaded');
    });

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
