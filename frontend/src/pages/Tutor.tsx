import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { AppShell, PageHeader } from '../components/layout';
import { AudioButton } from '../components/audio';
import { Badge, Button, Card, ErrorNote, Spinner } from '../components/ui';
import { Markdown } from '../components/markdown';
import { api, ApiError } from '../lib/api';
import type { AiStatus, TutorSuggestion } from '../lib/types';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  source?: 'ai' | 'local';
}

const MODE_LABELS: Record<string, string> = {
  explain: 'Explain',
  correct: 'Correct me',
  converse: 'Converse',
  roleplay: 'Roleplay',
  drill: 'Drill me',
};

export function TutorPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<TutorSuggestion['mode']>('explain');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .aiStatus()
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, model: null, suggestions: [] }));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  const send = async (message: string, nextMode = mode) => {
    if (!message.trim() || busy) return;
    setError(null);
    setBusy(true);
    setInput('');

    const history = turns.slice(-10).map((turn) => ({ role: turn.role, content: turn.content }));
    setTurns((current) => [...current, { role: 'user', content: message }]);

    try {
      const response = await api.tutor({ mode: nextMode, message, history });
      setTurns((current) => [
        ...current,
        { role: 'assistant', content: response.reply, source: response.source },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kalba AI could not answer just now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Kalba AI"
        emoji="💬"
        subtitle="Grammar answers, sentence corrections and military roleplay."
      />

      {status && !status.enabled && (
        <Card className="mb-4 border-info/40 bg-info/10 p-3 text-xs">
          <p className="font-bold text-info">Offline coach mode</p>
          <p className="muted mt-1">
            No AI key is configured on this server, so Kalba AI answers from the course data — word
            lookups, grammar notes and examples. Everything else in the app is unaffected.
            Self-hosting? Add an <code className="font-mono">ANTHROPIC_API_KEY</code> to your{' '}
            <code className="font-mono">.env</code> for full conversation practice.
          </p>
        </Card>
      )}

      {/* Mode selector */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4">
        {Object.entries(MODE_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value as TutorSuggestion['mode'])}
            className={clsx(
              'tap shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
              mode === value
                ? 'border-signal bg-signal/15 text-signal'
                : 'raised border-[color:var(--app-border)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Suggestions when the conversation is empty */}
      {turns.length === 0 && status && status.suggestions.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="muted text-xs font-bold uppercase tracking-wide">Try one of these</p>
          {status.suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => {
                setMode(suggestion.mode);
                void send(suggestion.prompt, suggestion.mode);
              }}
              className="tap raised flex w-full items-center gap-2.5 rounded-xl border p-3 text-left transition-colors hover:border-signal/50"
            >
              <Badge className="shrink-0">{MODE_LABELS[suggestion.mode]}</Badge>
              <span className="min-w-0 flex-1 text-sm font-semibold">{suggestion.label}</span>
              <span className="muted shrink-0" aria-hidden>
                →
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Conversation */}
      <div className="space-y-3 pb-24">
        {turns.map((turn, index) => (
          <div
            key={index}
            className={clsx('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={clsx(
                'max-w-[92%] rounded-2xl px-3.5 py-2.5',
                turn.role === 'user' ? 'bg-signal text-base-950' : 'surface border shadow-card',
              )}
            >
              {turn.role === 'user' ? (
                <p className="text-sm font-semibold">{turn.content}</p>
              ) : (
                <>
                  <Markdown source={turn.content} className="text-sm" />
                  <div className="mt-2 flex items-center gap-2">
                    <LithuanianLines text={turn.content} />
                    {turn.source === 'local' && (
                      <Badge className="ml-auto shrink-0 text-[0.6rem]">offline</Badge>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="surface flex items-center gap-2 rounded-2xl border px-4 py-3">
              <Spinner size={16} />
              <span className="muted text-sm">Thinking…</span>
            </div>
          </div>
        )}

        {error && <ErrorNote message={error} />}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="safe-bottom surface fixed inset-x-0 bottom-[4.25rem] border-t p-3">
        <form
          className="mx-auto flex max-w-lg items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="tutor-input" className="sr-only">
            Ask Kalba AI
          </label>
          <textarea
            id="tutor-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={`${MODE_LABELS[mode]}…`}
            className="raised max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-signal"
          />
          <Button type="submit" disabled={!input.trim()} loading={busy} className="shrink-0">
            Send
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

/**
 * Pull the Lithuanian lines out of a reply so they can be played back.
 * Heuristic but effective: Lithuanian-only diacritics are a strong signal.
 */
function LithuanianLines({ text }: { text: string }) {
  const candidates = text
    .split('\n')
    .map((line) => line.replace(/^[>*\-#\s]+/, '').trim())
    .filter((line) => line.length > 2 && line.length < 160)
    .filter((line) => /[ąčęėįšųūž]/i.test(line))
    .slice(0, 2);

  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {candidates.map((line) => (
        <AudioButton key={line} text={line} size="sm" label={`Play “${line}”`} />
      ))}
    </div>
  );
}
