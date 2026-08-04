import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FocusShell } from '../../components/layout';
import { Markdown } from '../../components/markdown';
import { AudioButton, VoiceWarning } from '../../components/audio';
import { Badge, Button, Card, ErrorNote, Sheet, Spinner } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { gradeLocally } from '../../lib/grade';
import { useAuth } from '../../store/auth';
import type { Exercise, LessonResponse, LessonSummary } from '../../lib/types';
import { ExerciseView } from './exercises';

type Stage = 'loading' | 'briefing' | 'vocab' | 'playing' | 'summary' | 'error';

interface Attempt {
  index: number;
  response: string;
  timeMs: number;
}

export function LessonPlayer() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const applyProgress = useAuth((state) => state.applyProgress);

  const [stage, setStage] = useState<Stage>('loading');
  const [data, setData] = useState<LessonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [position, setPosition] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [typo, setTypo] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [vocabIndex, setVocabIndex] = useState(0);

  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startedAt = useRef(Date.now());

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStage('loading');

    api
      .lesson(slug)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setStage(response.lesson.grammar ? 'briefing' : 'vocab');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load this lesson.');
        setStage('error');
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const exercises: Exercise[] = useMemo(() => data?.lesson.exercises ?? [], [data]);
  const current = exercises[position];

  // ── Check / advance ──────────────────────────────────────────────────────
  const check = useCallback(() => {
    if (!current || checked || !answer.trim()) return;

    const grade = gradeLocally(current.type, current.answer, current.altAnswers, answer);
    setChecked(true);
    setCorrect(grade.correct);
    setTypo(grade.typo);
    if (!grade.correct) setWrongCount((count) => count + 1);

    setAttempts((list) => [
      ...list,
      { index: position, response: answer, timeMs: Date.now() - startedAt.current },
    ]);
  }, [answer, checked, current, position]);

  const submit = useCallback(
    async (finalAttempts: Attempt[]) => {
      setSubmitting(true);
      try {
        const result = await api.submitLesson(slug, finalAttempts);
        setSummary(result);
        applyProgress({
          xp: result.level.xp,
          level: result.level,
          streak: result.streak,
        });
        setStage('summary');
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not save your results. Check your connection.',
        );
        setStage('error');
      } finally {
        setSubmitting(false);
      }
    },
    [applyProgress, slug],
  );

  const advance = useCallback(() => {
    if (position + 1 >= exercises.length) {
      void submit(attempts);
      return;
    }
    setPosition((index) => index + 1);
    setAnswer('');
    setChecked(false);
    setCorrect(false);
    setTypo(false);
    startedAt.current = Date.now();
  }, [attempts, exercises.length, position, submit]);

  // Enter checks, then continues — the keyboard path through a whole lesson.
  useEffect(() => {
    if (stage !== 'playing') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      if (checked) advance();
      else check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, check, checked, stage]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (stage === 'error' || !data) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorNote message={error ?? 'Something went wrong.'} onRetry={() => navigate(0)} />
        <Button className="mt-4" variant="secondary" fullWidth onClick={() => navigate('/')}>
          Back to the path
        </Button>
      </div>
    );
  }

  const { lesson } = data;

  // 1. Grammar briefing
  if (stage === 'briefing' && lesson.grammar) {
    return (
      <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-6">
        <Badge tone="info" className="mb-3">
          {lesson.unit.emoji} {lesson.unit.title}
        </Badge>
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{lesson.grammar.title}</h1>
        <p className="muted mb-6 text-sm">Briefing — read this before the drills.</p>

        <Card className="p-5">
          <Markdown source={lesson.grammar.body} />
        </Card>

        <div className="safe-bottom surface fixed inset-x-0 bottom-0 border-t p-4">
          <div className="mx-auto max-w-lg">
            <Button size="lg" fullWidth onClick={() => setStage('vocab')}>
              Got it — show the words
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Vocabulary preview
  if (stage === 'vocab') {
    const word = lesson.words[vocabIndex];
    const last = vocabIndex >= lesson.words.length - 1;

    if (!word) {
      setStage('playing');
      return null;
    }

    return (
      <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-6">
        <VoiceWarning />
        <div className="mb-4 flex items-center justify-between">
          <Badge>
            {vocabIndex + 1} / {lesson.words.length}
          </Badge>
          <button
            type="button"
            onClick={() => setStage('playing')}
            className="muted text-sm font-semibold underline"
          >
            Skip to drills
          </button>
        </div>

        <Card className="animate-pop-in p-6 text-center">
          <div className="mb-3 text-6xl" aria-hidden>
            {word.emoji ?? '🪖'}
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">{word.lt}</h2>
          <p className="muted mt-1 font-mono text-sm">{word.pron}</p>
          <p className="mt-3 text-lg font-semibold text-signal">{word.en}</p>

          <div className="mt-4 flex justify-center">
            <AudioButton text={word.lt} size="md" autoPlay />
          </div>

          {word.grammar && (
            <div className="mt-5 rounded-xl border p-3 text-left text-sm raised">
              <p className="muted mb-1 text-xs font-bold uppercase tracking-wide">Grammar</p>
              <p>{word.grammar}</p>
            </div>
          )}

          {word.usage && (
            <div className="mt-3 rounded-xl border border-info/30 bg-info/10 p-3 text-left text-sm">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-info">
                In the field
              </p>
              <p>{word.usage}</p>
            </div>
          )}

          {word.examples.length > 0 && (
            <div className="mt-4 space-y-2 text-left">
              {word.examples.map((example) => (
                <div key={example.lt} className="flex items-start gap-2">
                  <AudioButton text={example.lt} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold">{example.lt}</p>
                    <p className="muted text-sm">{example.en}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="safe-bottom surface fixed inset-x-0 bottom-0 border-t p-4">
          <div className="mx-auto flex max-w-lg gap-3">
            {vocabIndex > 0 && (
              <Button variant="secondary" size="lg" onClick={() => setVocabIndex((i) => i - 1)}>
                Back
              </Button>
            )}
            <Button
              size="lg"
              fullWidth
              onClick={() => (last ? setStage('playing') : setVocabIndex((i) => i + 1))}
            >
              {last ? 'Start drills' : 'Next word'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Summary
  if (stage === 'summary' && summary) {
    return <LessonSummaryView summary={summary} lessonTitle={lesson.title} />;
  }

  // 3. Drills
  if (!current) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  const canCheck = answer.trim().length > 0;

  return (
    <FocusShell
      onExit={() => {
        if (attempts.length === 0 || window.confirm('Leave the lesson? Your progress is lost.')) {
          navigate('/');
        }
      }}
      progress={position / exercises.length}
      hearts={
        <div className="flex items-center gap-1 text-sm font-bold" title="Mistakes so far">
          <span aria-hidden>❌</span>
          <span className="tabular-nums">{wrongCount}</span>
        </div>
      }
    >
      <div key={position} className="flex-1 animate-pop-in">
        <ExerciseView
          exercise={current}
          value={answer}
          onChange={setAnswer}
          checked={checked}
          correct={correct}
        />
      </div>

      <Sheet open={checked} tone={correct ? 'success' : 'danger'} labelledBy="feedback-title">
        <div className="pb-4">
          <p
            id="feedback-title"
            className={clsx('text-lg font-extrabold', correct ? 'text-signal' : 'text-alert')}
          >
            {correct ? (typo ? 'Correct — watch the spelling' : 'Correct!') : 'Not quite'}
          </p>

          {!correct && (
            <p className="mt-1 text-sm">
              Answer: <span className="font-bold">{current.answer}</span>
            </p>
          )}

          {current.explanation && <p className="muted mt-2 text-sm">{current.explanation}</p>}

          <div className="mt-3 flex items-center gap-3">
            {current.audioText && <AudioButton text={current.audioText} size="sm" />}
            <Button size="lg" fullWidth onClick={advance} loading={submitting}>
              {position + 1 >= exercises.length ? 'Finish' : 'Continue'}
            </Button>
          </div>
        </div>
      </Sheet>

      {!checked && (
        <div className="safe-bottom surface fixed inset-x-0 bottom-0 border-t p-4">
          <div className="mx-auto max-w-lg">
            <Button size="lg" fullWidth disabled={!canCheck} onClick={check}>
              Check
            </Button>
          </div>
        </div>
      )}
    </FocusShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

function LessonSummaryView({
  summary,
  lessonTitle,
}: {
  summary: LessonSummary;
  lessonTitle: string;
}) {
  const navigate = useNavigate();
  const mistakes = summary.results.filter((result) => !result.correct);

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-10">
      <div className="mb-6 text-center">
        <div className="mb-2 animate-pop-in text-6xl" aria-hidden>
          {summary.perfect ? '🏆' : summary.accuracy >= 70 ? '🎖️' : '💪'}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {summary.perfect ? 'Be klaidų!' : 'Užduotis įvykdyta'}
        </h1>
        <p className="muted mt-1 text-sm">
          {summary.perfect ? 'Flawless — not a single mistake.' : `${lessonTitle} complete.`}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="muted text-xs font-bold uppercase tracking-wide">XP</p>
          <p className="animate-count-up text-2xl font-extrabold text-signal">
            +{summary.xp.total}
          </p>
        </Card>
        <Card className="p-3 text-center">
          <p className="muted text-xs font-bold uppercase tracking-wide">Accuracy</p>
          <p className="animate-count-up text-2xl font-extrabold">{summary.accuracy}%</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="muted text-xs font-bold uppercase tracking-wide">Streak</p>
          <p className="animate-count-up text-2xl font-extrabold text-warn">
            {summary.streak}
            {summary.streakIncreased && <span className="text-base"> 🔥</span>}
          </p>
        </Card>
      </div>

      <Card className="mb-4 p-4">
        <p className="mb-2 text-sm font-bold">XP breakdown</p>
        <dl className="space-y-1 text-sm">
          <Row label="Correct answers" value={summary.xp.fromAnswers} />
          <Row
            label={summary.firstCompletion ? 'Lesson complete' : 'Repeat bonus'}
            value={summary.xp.completionBonus}
          />
          {summary.xp.perfectBonus > 0 && (
            <Row label="Perfect run" value={summary.xp.perfectBonus} />
          )}
          {summary.xp.achievements > 0 && (
            <Row label="Achievements" value={summary.xp.achievements} />
          )}
        </dl>
      </Card>

      {summary.unlockedAchievements.length > 0 && (
        <div className="mb-4 space-y-2">
          {summary.unlockedAchievements.map((achievement) => (
            <Card
              key={achievement.slug}
              className="animate-slide-up flex items-center gap-3 border-warn/40 bg-warn/10 p-3"
            >
              <span className="text-3xl" aria-hidden>
                {achievement.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-warn">
                  Achievement unlocked
                </p>
                <p className="font-bold">{achievement.title}</p>
                <p className="muted text-xs">{achievement.description}</p>
              </div>
              <Badge tone="warn">+{achievement.xpReward}</Badge>
            </Card>
          ))}
        </div>
      )}

      {mistakes.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="mb-3 text-sm font-bold">Worth another look</p>
          <ul className="space-y-3">
            {mistakes.slice(0, 8).map((mistake) => (
              <li key={mistake.index} className="flex items-start gap-3">
                <AudioButton text={mistake.expected} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold">{mistake.expected}</p>
                  {mistake.given && mistake.given !== '—' && (
                    <p className="text-xs text-alert">You said: {mistake.given}</p>
                  )}
                  {mistake.explanation && <p className="muted text-xs">{mistake.explanation}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="safe-bottom surface fixed inset-x-0 bottom-0 border-t p-4">
        <div className="mx-auto flex max-w-lg gap-3">
          <Button variant="secondary" size="lg" onClick={() => navigate(0)}>
            Again
          </Button>
          <Button size="lg" fullWidth onClick={() => navigate('/')}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="muted">{label}</dt>
      <dd className="font-semibold tabular-nums">+{value}</dd>
    </div>
  );
}
