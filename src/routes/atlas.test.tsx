import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Atlas from './atlas';

describe('Atlas', () => {
  it('renders the broad concept map as a public planning surface', () => {
    render(
      <MemoryRouter>
        <Atlas />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /concept atlas/i })).toBeInTheDocument();
    expect(screen.getByText(/a working list of terms to turn into lessons/i)).toBeInTheDocument();
    expect(screen.getByText(/25 lanes/i)).toBeInTheDocument();
    expect(screen.getByText(/\d+ concepts/i)).toBeInTheDocument();
    expect(screen.getByText('AI, LLMs, and agents')).toBeInTheDocument();
    expect(screen.getByText('languages, runtimes, frameworks, and tools')).toBeInTheDocument();
    expect(screen.getByText('Microsoft 365, Dataverse, and Power Platform')).toBeInTheDocument();
    expect(screen.getByText('Azure cloud and identity')).toBeInTheDocument();
    expect(screen.getByText('Copilot, Claude, and agent tools')).toBeInTheDocument();
    expect(screen.getByText('AI platforms and model labs')).toBeInTheDocument();
    expect(screen.getByText('AI coding agents and app builders')).toBeInTheDocument();
    expect(screen.getByText('content freshness and feedback')).toBeInTheDocument();
    expect(screen.getByText('Excel, Power BI, and Fabric analytics')).toBeInTheDocument();
    expect(screen.getByText('hardware and computing')).toBeInTheDocument();
    expect(screen.getByText('QA and reliability')).toBeInTheDocument();
    expect(screen.getByText('say: L-L-M')).toBeInTheDocument();
    expect(screen.getByText('candidate')).toBeInTheDocument();
    expect(screen.getByText('already seeded')).toBeInTheDocument();

    const analyticsHeading = screen.getByRole('heading', {
      name: 'Excel, Power BI, and Fabric analytics',
    });
    expect(analyticsHeading).toHaveClass('scroll-mt-16');
    expect(analyticsHeading.closest('article')).toHaveClass('scroll-mt-16');
  }, 30_000);

  it('renders pronounce buttons for concepts when speechSynthesis is available', () => {
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
      <MemoryRouter>
        <Atlas />
      </MemoryRouter>,
    );

    const buttons = screen.getAllByRole('button', { name: /hear .* pronounced/i });
    expect(buttons.length).toBeGreaterThan(0);
  }, 30_000);
});
