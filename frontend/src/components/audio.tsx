import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import {
  hasLithuanianVoice,
  listen,
  recognitionErrorMessage,
  recognitionSupported,
  speak,
  ttsSupported,
} from '../lib/speech';
import { useSettings } from '../store/settings';

/**
 * Speaker button. Every Lithuanian string in the app is playable through this,
 * using the device's own Lithuanian voice.
 */
export function AudioButton({
  text,
  size = 'md',
  autoPlay = false,
  label,
  className,
}: {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  autoPlay?: boolean;
  label?: string;
  className?: string;
}) {
  const rate = useSettings((state) => state.ttsRate);
  const autoPlayEnabled = useSettings((state) => state.autoPlayAudio);
  const [playing, setPlaying] = useState(false);
  const played = useRef(false);

  const play = () => {
    if (!ttsSupported()) return;
    setPlaying(true);
    speak(text, { rate, onEnd: () => setPlaying(false), onError: () => setPlaying(false) });
  };

  useEffect(() => {
    if (autoPlay && autoPlayEnabled && !played.current) {
      played.current = true;
      // A short delay lets the exercise render before the audio starts.
      const timer = setTimeout(play, 250);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlay, autoPlayEnabled]);

  const sizes = {
    sm: 'h-9 w-9 text-base',
    md: 'h-12 w-12 text-xl',
    lg: 'h-20 w-20 text-3xl',
  };

  if (!ttsSupported()) return null;

  return (
    <button
      type="button"
      onClick={play}
      aria-label={label ?? `Play “${text}” in Lithuanian`}
      className={clsx(
        'tap relative grid shrink-0 place-items-center rounded-full border-2 border-signal/50 bg-signal/10 text-signal transition-colors hover:bg-signal/20',
        sizes[size],
        className,
      )}
    >
      {playing && (
        <span
          className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-signal"
          aria-hidden
        />
      )}
      <span aria-hidden>{playing ? '🔊' : '🔈'}</span>
    </button>
  );
}

/** Shown once when the device has no Lithuanian voice installed. */
export function VoiceWarning() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('kalba:voiceWarningDismissed') === 'true',
  );
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // Voices load asynchronously in Chrome; re-check shortly after mount.
    const check = () => setMissing(ttsSupported() && !hasLithuanianVoice());
    check();
    const timer = setTimeout(check, 900);
    return () => clearTimeout(timer);
  }, []);

  if (!missing || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs">
      <p className="font-semibold text-warn">No Lithuanian voice found on this device</p>
      <p className="muted mt-1">
        Audio will fall back to your default voice, which mispronounces Lithuanian. On Android and
        Windows you can add a Lithuanian voice in the system speech settings; Chrome on desktop
        usually has one already.
      </p>
      <button
        type="button"
        className="mt-2 font-semibold text-warn underline"
        onClick={() => {
          localStorage.setItem('kalba:voiceWarningDismissed', 'true');
          setDismissed(true);
        }}
      >
        Got it
      </button>
    </div>
  );
}

export type MicState = 'idle' | 'listening' | 'done' | 'error';

/**
 * Microphone button for speaking exercises. Falls back to a typed answer when
 * the browser has no speech recognition, so the exercise is never a dead end.
 */
export function MicButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<MicState>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<{ stop: () => void } | null>(null);

  useEffect(() => () => handle.current?.stop(), []);

  const start = () => {
    if (disabled) return;
    setError(null);
    setPartial('');
    setState('listening');

    handle.current = listen({
      onPartial: setPartial,
      onResult: (transcript) => {
        setState('done');
        onTranscript(transcript);
      },
      onError: (reason) => {
        setError(recognitionErrorMessage(reason));
        setState('error');
      },
      onEnd: () => {
        handle.current = null;
        setState((current) => (current === 'listening' ? 'idle' : current));
      },
    });
  };

  const stop = () => handle.current?.stop();

  if (!recognitionSupported()) {
    return (
      <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-center text-xs">
        <p className="font-semibold text-warn">Speech recognition isn’t available here</p>
        <p className="muted mt-1">
          Chrome or Edge can do this. Type the phrase instead — it still counts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={state === 'listening' ? stop : start}
        disabled={disabled}
        aria-label={state === 'listening' ? 'Stop recording' : 'Start recording'}
        className={clsx(
          'tap relative grid h-24 w-24 place-items-center rounded-full text-4xl transition-all disabled:opacity-40',
          state === 'listening'
            ? 'bg-alert text-base-950'
            : 'border-2 border-signal bg-signal/10 text-signal hover:bg-signal/20',
        )}
      >
        {state === 'listening' && (
          <span
            className="absolute inset-0 animate-pulse-ring rounded-full bg-alert/40"
            aria-hidden
          />
        )}
        <span aria-hidden>🎙️</span>
      </button>

      <p className="muted min-h-[1.25rem] text-center text-sm" aria-live="polite">
        {state === 'listening'
          ? partial || 'Listening…'
          : state === 'error'
            ? ''
            : 'Tap and say it out loud'}
      </p>

      {error && (
        <p role="alert" className="max-w-xs text-center text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
