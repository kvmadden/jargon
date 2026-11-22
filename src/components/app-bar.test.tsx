import { render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUserStore } from '../stores/user-store';
import { AppBar } from './app-bar';

describe('AppBar keyboard focus', () => {
  beforeEach(() => {
    useUserStore.setState({
      user: { id: 'test-user' } as User,
      session: null,
      loading: false,
    });
  });

  afterEach(() => {
    useUserStore.setState({ user: null, session: null, loading: false });
  });

  it('shows a visible focus indicator on the home wordmark', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AppBar />
      </MemoryRouter>,
    );

    const home = screen.getByRole('link', { name: 'jargon home' });
    expect(home).toHaveAttribute('href', '/home');
    expect(home).toHaveClass(
      'focus-visible:ring-2',
      'focus-visible:ring-accent-jargon-hi',
      'focus-visible:ring-offset-2',
    );
  });
});
