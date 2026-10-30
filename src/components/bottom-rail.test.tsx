import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BottomRail } from './bottom-rail';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('BottomRail', () => {
  it('renders all three statistics correctly and handles click navigation', () => {
    render(
      <MemoryRouter>
        <BottomRail
          mastered={12}
          pathsTouched={3}
          pathsTotal={7}
          spottedThisWeek={5}
        />
      </MemoryRouter>
    );

    // Verify stats exist
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3/7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('mastered')).toBeInTheDocument();
    expect(screen.getByText('paths')).toBeInTheDocument();
    expect(screen.getByText('spotted this week')).toBeInTheDocument();

    // Verify accessible screen reader label matches dynamic stats
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute(
      'aria-label',
      'Open profile. 12 mastered, 3 of 7 paths, 5 spotted this week.'
    );

    // Verify click triggers navigation to /profile
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });
});
