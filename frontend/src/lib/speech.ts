/**
 * Speech in and out, using only what the browser already ships.
 *
 * Text-to-speech gives every Lithuanian word and sentence in the course a
 * pronunciation without hosting a single audio file — which is what keeps the
 * whole app free to run. Speech recognition powers the speaking exercises.
 *
 * Both degrade gracefully: if the platform has no Lithuanian voice the app
 * still works, it just says so.
 */

const LT = 'lt-LT';

// ─────────────────────────────────────────────────────────────────────────────
// Text to speech
// ─────────────────────────────────────────────────────────────────────────────

let cachedVoices: SpeechSynthesisVoice[] = [];

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function loadVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

if (ttsSupported()) {
  // Chrome populates voices asynchronously.
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => loadVoices());
}

/** The best available Lithuanian voice, or null if the device has none. */
export function lithuanianVoice(): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  return (
    voices.find((voice) => voice.lang === LT) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('lt')) ??
    null
  );
}

export function hasLithuanianVoice(): boolean {
  return lithuanianVoice() !== null;
}

export interface SpeakOptions {
  rate?: number;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Speak Lithuanian text. Resolves as soon as playback is handed to the engine;
 * use `onEnd` if you need to know when it finished.
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!ttsSupported() || !text.trim()) {
    options.onError?.();
    return;
  }

  // Cancel anything already queued so rapid taps don't stack up.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LT;
  // Slightly slower than natural: learners need to hear the endings.
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = 1;

  const voice = lithuanianVoice();
  if (voice) utterance.voice = voice;

  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// ─────────────────────────────────────────────────────────────────────────────
// Speech recognition
// ─────────────────────────────────────────────────────────────────────────────

interface SpeechRecognitionResultLike {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionEventLike extends Event {
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
  resultIndex: number;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenHandle {
  stop: () => void;
}

export interface ListenCallbacks {
  onPartial?: (transcript: string) => void;
  onResult: (transcript: string) => void;
  onError?: (reason: string) => void;
  onEnd?: () => void;
}

/**
 * Listen for one Lithuanian utterance.
 *
 * Returns a handle so the caller can stop early; `onEnd` always fires, whether
 * recognition succeeded, errored or was stopped.
 */
export function listen(callbacks: ListenCallbacks): ListenHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    callbacks.onError?.('unsupported');
    callbacks.onEnd?.();
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = LT;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  let best = '';

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) continue;
      const transcript = result[0].transcript.trim();
      if (result.isFinal) {
        best = transcript;
      } else {
        callbacks.onPartial?.(transcript);
      }
    }
  };

  recognition.onerror = (event) => {
    const reason = (event as Event & { error?: string }).error ?? 'error';
    callbacks.onError?.(reason);
  };

  recognition.onend = () => {
    if (best) callbacks.onResult(best);
    callbacks.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    callbacks.onError?.('start-failed');
    callbacks.onEnd?.();
    return null;
  }

  return { stop: () => recognition.stop() };
}

/** A human-readable reason for a recognition failure. */
export function recognitionErrorMessage(reason: string): string {
  switch (reason) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow it in your browser settings to use speaking exercises.';
    case 'no-speech':
      return 'I didn’t hear anything — tap and try again.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'network':
      return 'Speech recognition needs a network connection.';
    case 'unsupported':
      return 'This browser can’t do speech recognition. Chrome and Edge can — or skip and type instead.';
    case 'language-not-supported':
      return 'This browser has no Lithuanian speech model. You can skip speaking exercises.';
    default:
      return 'Couldn’t capture that — tap and try again.';
  }
}
