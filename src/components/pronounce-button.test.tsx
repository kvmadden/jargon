import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PronounceButton } from './pronounce-button';

describe('PronounceButton', () => {
  const originalSpeechSynthesis = window.speechSynthesis;
  const originalSpeechSynthesisUtterance = window.SpeechSynthesisUtterance;

  afterEach(() => {
    // Restore window properties after each test
    if (originalSpeechSynthesis !== undefined) {
      Object.defineProperty(window, 'speechSynthesis', {
        value: originalSpeechSynthesis,
        configurable: true,
        writable: true,
      });
    } else {
      // @ts-expect-error cleanup window property
      delete window.speechSynthesis;
    }

    if (originalSpeechSynthesisUtterance !== undefined) {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: originalSpeechSynthesisUtterance,
        configurable: true,
        writable: true,
      });
    } else {
      // @ts-expect-error cleanup window property
      delete window.SpeechSynthesisUtterance;
    }
  });

  describe('Feature detection (unsupported environment)', () => {
    it('renders null when window.speechSynthesis is unavailable', () => {
      // Ensure window.speechSynthesis is undefined
      // @ts-expect-error remove property for test
      delete window.speechSynthesis;

      const { container } = render(<PronounceButton text="kubernetes" />);
      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders null when SpeechSynthesisUtterance is unavailable', () => {
      Object.defineProperty(window, 'speechSynthesis', {
        value: { speak: vi.fn(), cancel: vi.fn() },
        configurable: true,
        writable: true,
      });
      // @ts-expect-error remove property for test
      delete window.SpeechSynthesisUtterance;

      const { container } = render(<PronounceButton text="kubernetes" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Supported environment', () => {
    let mockCancel: ReturnType<typeof vi.fn>;
    let mockSpeak: ReturnType<typeof vi.fn>;
    let createdUtterance: MockUtterance | null = null;

    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((err?: any) => void) | null = null;

      constructor(text: string) {
        this.text = text;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        createdUtterance = this;
      }
    }

    beforeEach(() => {
      createdUtterance = null;
      mockCancel = vi.fn();
      mockSpeak = vi.fn();

      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          cancel: mockCancel,
          speak: mockSpeak,
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: MockUtterance,
        configurable: true,
        writable: true,
      });
    });

    it('renders accessible button with default aria-label and styling when supported', () => {
      render(<PronounceButton text="Kubernetes" />);

      const button = screen.getByRole('button', { name: 'hear "kubernetes" pronounced' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass('min-h-[44px]', 'min-w-[44px]', 'cursor-pointer');

      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('supports custom label and custom className props', () => {
      render(
        <PronounceButton
          text="docker"
          label="custom pronounce label"
          className="my-custom-class"
        />,
      );

      const button = screen.getByRole('button', { name: 'custom pronounce label' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('my-custom-class');
    });

    it('triggers speechSynthesis.speak with text and slow rate on click', () => {
      render(<PronounceButton text="Kubernetes" />);

      const button = screen.getByRole('button', { name: 'hear "kubernetes" pronounced' });

      fireEvent.click(button);

      expect(mockCancel).toHaveBeenCalledTimes(1);
      expect(mockSpeak).toHaveBeenCalledTimes(1);
      expect(createdUtterance).not.toBeNull();
      expect(createdUtterance?.text).toBe('Kubernetes');
      expect(createdUtterance?.lang).toBe('en-US');
      expect(createdUtterance?.rate).toBe(0.9);
    });

    it('cancels existing speech on double click before speaking again', () => {
      render(<PronounceButton text="Kubernetes" />);

      const button = screen.getByRole('button', { name: 'hear "kubernetes" pronounced' });

      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockCancel).toHaveBeenCalledTimes(2);
      expect(mockSpeak).toHaveBeenCalledTimes(2);
    });

    it('toggles speaking state through utterance lifecycle (onstart / onend)', () => {
      render(<PronounceButton text="Kubernetes" />);

      const button = screen.getByRole('button', { name: 'hear "kubernetes" pronounced' });

      fireEvent.click(button);

      expect(createdUtterance).not.toBeNull();

      // Trigger onstart
      act(() => {
        createdUtterance?.onstart?.();
      });
      expect(button).toHaveClass('text-accent-jargon-hi');

      // Trigger onend
      act(() => {
        createdUtterance?.onend?.();
      });
      expect(button).not.toHaveClass('text-accent-jargon-hi');
    });

    it('resets speaking state on utterance onerror', () => {
      render(<PronounceButton text="Kubernetes" />);

      const button = screen.getByRole('button', { name: 'hear "kubernetes" pronounced' });

      fireEvent.click(button);
      act(() => {
        createdUtterance?.onstart?.();
      });
      expect(button).toHaveClass('text-accent-jargon-hi');

      act(() => {
        createdUtterance?.onerror?.(new Error('speech error'));
      });
      expect(button).not.toHaveClass('text-accent-jargon-hi');
    });

    it('calls cancel on unmount so navigating away mid-utterance stops speech', () => {
      const { unmount } = render(<PronounceButton text="Kubernetes" />);

      unmount();

      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });
});
