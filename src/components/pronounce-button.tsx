import { useEffect, useState } from 'react';

export interface PronounceButtonProps {
  text: string;
  label?: string;
  className?: string;
}

/**
 * Audio pronunciation button powered by the browser's Web Speech API (window.speechSynthesis).
 * Client-only, zero backend, zero network overhead.
 * Renders null when speechSynthesis is not supported.
 */
export function PronounceButton({ text, label, className = '' }: PronounceButtonProps) {
  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  if (!isSupported) {
    return null;
  }

  const defaultLabel = `hear "${text.toLowerCase()}" pronounced`;
  const ariaLabel = label || defaultLabel;

  const handleSpeak = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!text) return;

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeaking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-jargon cursor-pointer ${
        speaking ? 'text-accent-jargon-hi' : ''
      } ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={speaking ? 'motion-reduce:animate-none animate-pulse' : ''}
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  );
}
