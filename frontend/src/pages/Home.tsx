import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout';
import { VoiceWarning } from '../components/audio';
import { Badge, Button, Card, ErrorNote, ProgressBar, Skeleton } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import type { CourseResponse, DeckStats, LessonNode, NextLesson, UnitNode } from '../lib/types';

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);

  const [course, setCourse] = useState<CourseResponse | null>(null);
  const [next, setNext] = useState<NextLesson | null>(null);
  const [deck, setDeck] = useState<DeckStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openLevel, setOpenLevel] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([api.course(), api.nextLesson(), api.deckStats().catch(() => null)])
      .then(([courseData, nextData, deckData]) => {
        setCourse(courseData);
        setNext(nextData);
        setDeck(deckData);
        // Open the level containing the next lesson.
        const level = courseData.levels.find((candidate) =>
          candidate.units.some((unit) =>
            unit.lessons.some((lesson) => lesson.slug === nextData.next?.slug),
          ),
        );
        setOpenLevel(level?.level ?? courseData.levels[0]?.level ?? null);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not load the course.'),
      );
  };

  useEffect(load, []);

  const goalPercent = user ? Math.min(1, (next ? 0 : 0) + 0) : 0;
  void goalPercent;

  return (
    <AppShell>
      <VoiceWarning />

      {error && <ErrorNote message={error} onRetry={load} />}

      {/* Continue card */}
      {next?.next && (
        <Card className="mb-4 overflow-hidden">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Badge tone="success">{next.next.isReview ? 'Review' : 'Continue'}</Badge>
              <span className="muted text-xs font-semibold tabular-nums">
                {next.completed}/{next.total} lessons
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden>
                {next.next.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="muted text-xs font-bold uppercase tracking-wide">
                  {next.next.unit.emoji} {next.next.unit.title}
                </p>
                <h2 className="truncate text-lg font-extrabold">{next.next.title}</h2>
                <p className="muted truncate text-sm">{next.next.subtitle}</p>
              </div>
            </div>

            <ProgressBar
              className="my-3 h-2"
              value={next.completed}
              max={next.total || 1}
              label="Course progress"
            />

            <Button size="lg" fullWidth onClick={() => navigate(`/lesson/${next.next?.slug}`)}>
              {next.next.isReview ? 'Train again' : 'Start lesson'} · +{next.next.xp} XP
            </Button>
          </div>
        </Card>
      )}

      {/* Review deck nudge */}
      {deck && deck.dueNow > 0 && (
        <Link to="/review" className="tap mb-4 block">
          <Card className="flex items-center gap-3 border-warn/40 bg-warn/10 p-4">
            <span className="text-3xl" aria-hidden>
              🔁
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{deck.dueNow} words due for review</p>
              <p className="muted text-xs">Spaced repetition keeps them from slipping away.</p>
            </div>
            <span className="muted text-xl" aria-hidden>
              →
            </span>
          </Card>
        </Link>
      )}

      {/* The path */}
      <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide muted">Training path</h2>

      {!course && (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {course?.levels.map((level) => {
          const open = openLevel === level.level;
          const complete = level.completedCount >= level.lessonCount && level.lessonCount > 0;

          return (
            <Card key={level.level} className={clsx(!level.unlocked && 'opacity-60')}>
              <button
                type="button"
                onClick={() => setOpenLevel(open ? null : level.level)}
                aria-expanded={open}
                className="tap flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={clsx(
                    'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl',
                    complete ? 'bg-signal/20' : 'bg-base-800',
                  )}
                  aria-hidden
                >
                  {level.unlocked ? level.emoji : '🔒'}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="truncate font-extrabold">{level.nameLt}</h3>
                    <span className="muted shrink-0 text-xs">{level.nameEn}</span>
                  </div>
                  <p className="muted text-xs">
                    Level {level.index} · {level.completedCount}/{level.lessonCount} lessons ·{' '}
                    {level.cefrHint} equivalent
                  </p>
                  <ProgressBar
                    className="mt-2 h-1.5"
                    value={level.completedCount}
                    max={level.lessonCount || 1}
                    tone={complete ? 'signal' : 'info'}
                    label={`${level.nameEn} progress`}
                  />
                </div>

                <span
                  className={clsx('muted text-lg transition-transform', open && 'rotate-90')}
                  aria-hidden
                >
                  ›
                </span>
              </button>

              {open && (
                <div
                  className="border-t px-4 pb-4 pt-3"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  {!level.unlocked && (
                    <p className="muted mb-3 rounded-lg border border-warn/30 bg-warn/10 p-2 text-xs">
                      Finish level {level.index - 1} to unlock this. You can still browse the
                      lessons.
                    </p>
                  )}
                  <div className="space-y-4">
                    {level.units.map((unit) => (
                      <UnitBlock key={unit.slug} unit={unit} />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="muted mt-8 text-center text-xs">
        Kalba is free forever and open source.{' '}
        <Link to="/grammar" className="font-semibold text-signal underline">
          Grammar reference
        </Link>
      </p>
    </AppShell>
  );
}

function UnitBlock({ unit }: { unit: UnitNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {unit.emoji}
        </span>
        <h4 className="text-sm font-bold">{unit.title}</h4>
      </div>
      <p className="muted mb-2.5 text-xs">{unit.description}</p>
      <ul className="space-y-2">
        {unit.lessons.map((lesson) => (
          <LessonRow key={lesson.slug} lesson={lesson} color={unit.color} />
        ))}
      </ul>
    </div>
  );
}

function LessonRow({ lesson, color }: { lesson: LessonNode; color: string }) {
  return (
    <li>
      <Link
        to={`/lesson/${lesson.slug}`}
        className="tap raised flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:border-signal/50"
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
          style={{
            backgroundColor: lesson.completed ? color : 'transparent',
            border: `2px solid ${color}`,
          }}
          aria-hidden
        >
          {lesson.completed ? '✓' : lesson.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{lesson.title}</p>
          <p className="muted truncate text-xs">{lesson.subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          {lesson.completed ? (
            <span className="text-xs font-bold text-signal tabular-nums">
              {lesson.bestAccuracy}%
            </span>
          ) : (
            <span className="muted text-xs font-semibold">+{lesson.xp}</span>
          )}
          {lesson.hasGrammar && (
            <span className="muted block text-[0.65rem]" title="Includes a grammar briefing">
              📘
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
