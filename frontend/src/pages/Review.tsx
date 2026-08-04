import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, PageHeader } from '../components/layout';
import { AudioButton } from '../components/audio';
import { Button, Card, EmptyState, ErrorNote, ProgressBar, Skeleton } from '../components/ui';
import { api, ApiError } from '../lib/api';
import type { DeckStats, Flashcard } from '../lib/types';

type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADES: { value: Grade; label: string; hint: string; className: string }[] = [
  { value: 'again', label: 'Again', hint: 'Tomorrow', className: 'bg-alert text-base-950' },
  { value: 'hard', label: 'Hard', hint: 'Sooner', className: 'bg-warn text-base-950' },
  { value: 'good', label: 'Good', hint: 'Normal', className: 'bg-signal text-base-950' },
  { value: 'easy', label: 'Easy', hint: 'Later', className: 'bg-info text-base-950' },
];

export function ReviewPage() {
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    setPosition(0);
    setRevealed(false);
    setReviewed(0);
    Promise.all([api.dueCards(20), api.deckStats()])
      .then(([due, deckStats]) => {
        setCards(due.cards);
        setStats(deckStats);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load your review deck.'),
      );
  };

  useEffect(load, []);

  const card = cards?.[position];

  const grade = async (value: Grade) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await api.reviewCard(card.id, value);
      setReviewed((count) => count + 1);
      setRevealed(false);
      setPosition((index) => index + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Review"
        emoji="🔁"
        subtitle="Spaced repetition — the words you keep missing come back soonest."
      />

      {error && <ErrorNote message={error} onRetry={load} />}

      {stats && (
        <div className="mb-5 grid grid-cols-4 gap-2">
          <Stat label="Due" value={stats.dueNow} tone="warn" />
          <Stat label="Deck" value={stats.total} />
          <Stat label="Mature" value={stats.mature} tone="signal" />
          <Stat label="This week" value={stats.dueWithinWeek} />
        </div>
      )}

      {!cards && <Skeleton className="h-72" />}

      {cards && cards.length === 0 && (
        <EmptyState
          emoji="✅"
          title="Nothing due right now"
          description={
            stats && stats.total > 0
              ? `Your deck has ${stats.total} words. The next batch is scheduled — come back later, or add words from the dictionary.`
              : 'Finish a lesson and the words you meet will start appearing here automatically.'
          }
          action={
            <Link to="/dictionary">
              <Button variant="secondary">Browse the dictionary</Button>
            </Link>
          }
        />
      )}

      {cards && cards.length > 0 && !card && (
        <EmptyState
          emoji="🎖️"
          title={`${reviewed} cards reviewed`}
          description="That's the queue cleared. Your next batch is already scheduled."
          action={<Button onClick={load}>Check for more</Button>}
        />
      )}

      {card && (
        <>
          <ProgressBar
            className="mb-4"
            value={position}
            max={cards?.length ?? 1}
            label="Review progress"
          />

          <Card className="animate-pop-in p-6 text-center" key={card.id}>
            <div className="mb-3 text-5xl" aria-hidden>
              {card.word.emoji ?? '🪖'}
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight">{card.word.lt}</h2>
            <p className="muted mt-1 font-mono text-sm">{card.word.pron}</p>

            <div className="mt-4 flex justify-center">
              <AudioButton text={card.word.lt} size="md" />
            </div>

            {revealed ? (
              <div className="mt-5 animate-slide-up text-left">
                <p className="text-center text-xl font-bold text-signal">{card.word.en}</p>

                {card.word.grammar && (
                  <div className="mt-4 rounded-xl border p-3 text-sm raised">
                    <p className="muted mb-1 text-xs font-bold uppercase tracking-wide">Grammar</p>
                    <p>{card.word.grammar}</p>
                  </div>
                )}

                {card.word.examples.slice(0, 2).map((example) => (
                  <div key={example.lt} className="mt-3 flex items-start gap-2">
                    <AudioButton text={example.lt} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{example.lt}</p>
                      <p className="muted text-xs">{example.en}</p>
                    </div>
                  </div>
                ))}

                <div className="muted mt-4 flex justify-center gap-3 text-[0.7rem]">
                  <span>ease {card.ease.toFixed(2)}</span>
                  <span>·</span>
                  <span>interval {card.intervalDays}d</span>
                  {card.lapses > 0 && (
                    <>
                      <span>·</span>
                      <span>{card.lapses} lapses</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <Button className="mt-6" size="lg" fullWidth onClick={() => setRevealed(true)}>
                Show meaning
              </Button>
            )}
          </Card>

          {revealed && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {GRADES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={busy}
                  onClick={() => void grade(option.value)}
                  className={clsx(
                    'tap flex flex-col items-center rounded-xl px-2 py-3 font-bold transition-all disabled:opacity-50',
                    option.className,
                  )}
                >
                  <span className="text-sm">{option.label}</span>
                  <span className="text-[0.65rem] font-semibold opacity-75">{option.hint}</span>
                </button>
              ))}
            </div>
          )}

          <p className="muted mt-4 text-center text-xs">
            Card {position + 1} of {cards?.length} · {reviewed} done this session
          </p>
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'signal' }) {
  return (
    <Card className="p-2.5 text-center">
      <p
        className={clsx(
          'text-xl font-extrabold tabular-nums',
          tone === 'warn' && 'text-warn',
          tone === 'signal' && 'text-signal',
        )}
      >
        {value}
      </p>
      <p className="muted text-[0.65rem] font-bold uppercase tracking-wide">{label}</p>
    </Card>
  );
}
