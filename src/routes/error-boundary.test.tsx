import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary';

function ProblematicComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test rendering crash');
  }
  return <div>Component normal content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Component normal content')).toBeInTheDocument();
  });

  it('renders default error UI and allows try again when a child throws', () => {
    // Prevent Vitest/jsdom from printing the caught console.error to standard error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test rendering crash')).toBeInTheDocument();

    // Rerender with normal state and tap try again to recover
    rerender(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Component normal content')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('renders custom fallback if provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom fallback message</div>}>
        <ProblematicComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom fallback message')).toBeInTheDocument();
    expect(screen.queryByText('something went wrong')).not.toBeInTheDocument();

    spy.mockRestore();
  });
});
