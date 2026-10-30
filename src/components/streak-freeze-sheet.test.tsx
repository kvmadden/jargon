import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StreakFreezeSheet } from './streak-freeze-sheet';

describe('StreakFreezeSheet', () => {
  it('renders nothing when open is false', () => {
    const onUseFreeze = vi.fn();
    const onDecline = vi.fn();

    const { container } = render(
      <StreakFreezeSheet
        open={false}
        gap={3}
        freezesAvailable={2}
        onUseFreeze={onUseFreeze}
        onDecline={onDecline}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders dialog details and supports button clicks when open is true', () => {
    const onUseFreeze = vi.fn();
    const onDecline = vi.fn();

    render(
      <StreakFreezeSheet
        open={true}
        gap={3}
        freezesAvailable={5}
        onUseFreeze={onUseFreeze}
        onDecline={onDecline}
      />
    );

    // Verify header and description
    expect(screen.getByRole('dialog', { name: /use a streak freeze\?/i })).toBeInTheDocument();
    expect(screen.getByText(/you missed 2 days/i)).toBeInTheDocument();
    expect(screen.getByText(/spend 2 of your 5 freezes/i)).toBeInTheDocument();
    expect(screen.getByText(/refills monthly/i)).toBeInTheDocument();

    // Verify clicking use freeze
    fireEvent.click(screen.getByRole('button', { name: /use freeze/i }));
    expect(onUseFreeze).toHaveBeenCalledTimes(1);

    // Verify clicking decline
    fireEvent.click(screen.getByRole('button', { name: /no, start fresh/i }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('closes sheet and fires decline when escape key is pressed', () => {
    const onUseFreeze = vi.fn();
    const onDecline = vi.fn();

    render(
      <StreakFreezeSheet
        open={true}
        gap={3}
        freezesAvailable={5}
        onUseFreeze={onUseFreeze}
        onDecline={onDecline}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
