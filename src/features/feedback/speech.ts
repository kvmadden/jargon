export interface FeedbackSpeechController {
  supported: boolean;
  listening: boolean;
  toggle: () => void;
  stop: () => void;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string };
    isFinal: boolean;
  }>;
  resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function createFeedbackSpeech(
  onTranscript: (transcript: string) => void,
  onListeningChange: (listening: boolean) => void,
): FeedbackSpeechController {
  const Recognition = recognitionConstructor();
  let recognition: SpeechRecognitionLike | null = null;
  let listening = false;

  const stop = () => {
    recognition?.stop();
    listening = false;
    onListeningChange(false);
  };

  const toggle = () => {
    if (!Recognition) return;
    if (listening) {
      stop();
      return;
    }
    recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          transcript += event.results[index][0].transcript;
        }
      }
      if (transcript.trim()) onTranscript(transcript.trim());
    };
    recognition.onend = () => {
      listening = false;
      onListeningChange(false);
    };
    recognition.onerror = () => {
      listening = false;
      onListeningChange(false);
    };
    try {
      recognition.start();
      listening = true;
      onListeningChange(true);
    } catch {
      listening = false;
      onListeningChange(false);
    }
  };

  return {
    supported: Recognition !== null,
    get listening() {
      return listening;
    },
    toggle,
    stop,
  };
}
