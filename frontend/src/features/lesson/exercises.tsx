import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioButton, MicButton } from '../../components/audio';
import { Button } from '../../components/ui';
import type { Exercise } from '../../lib/types';
import { normalize } from '../../lib/grade';

/**
 * Every exercise renderer takes the same shape: it reports the learner's
 * current answer upwards, and goes read-only once the answer is checked.
 */
export interface ExerciseProps {
  exercise: Exercise;
  /** The answer so far; '' means "not ready to check yet". */
  value: string;
  onChange: (value: string) => void;
  /** Set once the learner has pressed Check. */
  checked: boolean;
  correct: boolean;
  /** Submit immediately — used by tap-to-answer exercises. */
  onCommit?: () => void;
}

function Prompt({ children, size = 'lg' }: { children: React.ReactNode; size?: 'lg' | 'md' }) {
  return (
    <p className={clsx('font-bold leading-snug', size === 'lg' ? 'text-2xl' : 'text-xl')}>
      {children}
    </p>
  );
}

function Instruction({ children }: { children: React.ReactNode }) {
  return <p className="muted mb-4 text-sm font-semibold uppercase tracking-wide">{children}</p>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiple choice (select / listen_select / react)
// ─────────────────────────────────────────────────────────────────────────────

function ChoiceList({ exercise, value, onChange, checked, correct, onCommit }: ExerciseProps) {
  const options = exercise.options ?? [];

  return (
    <div
      className="flex flex-col gap-2.5"
      role="radiogroup"
      aria-label={exercise.instruction ?? 'Choose an answer'}
    >
      {options.map((option, index) => {
        const selected = value === option;
        const isAnswer = normalize(option) === normalize(exercise.answer);
        const showRight = checked && isAnswer;
        const showWrong = checked && selected && !correct;

        return (
          <button
            key={`${option}-${index}`}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={checked}
            onClick={() => {
              onChange(option);
              onCommit?.();
            }}
            className={clsx(
              'tap flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-[1.05rem] font-semibold transition-all disabled:cursor-default',
              showRight && 'border-signal bg-signal/15 text-signal',
              showWrong && 'animate-shake border-alert bg-alert/15 text-alert',
              !checked && selected && 'border-signal bg-signal/10',
              !checked &&
                !selected &&
                'raised border-[color:var(--app-border)] hover:border-signal/50',
              checked &&
                !showRight &&
                !showWrong &&
                'raised border-[color:var(--app-border)] opacity-50',
            )}
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-bold"
              aria-hidden
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">{option}</span>
            {showRight && <span aria-hidden>✓</span>}
            {showWrong && <span aria-hidden>✕</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SelectExercise(props: ExerciseProps) {
  return (
    <div>
      <Instruction>{props.exercise.instruction ?? 'Choose the Lithuanian'}</Instruction>
      <div className="mb-6">
        <Prompt>{props.exercise.prompt}</Prompt>
      </div>
      <ChoiceList {...props} />
    </div>
  );
}

export function ListenSelectExercise(props: ExerciseProps) {
  const { exercise } = props;
  return (
    <div>
      <Instruction>{exercise.instruction ?? 'What did you hear?'}</Instruction>
      <div className="mb-6 flex items-center gap-4">
        <AudioButton text={exercise.audioText ?? exercise.answer} size="lg" autoPlay />
        <p className="muted text-sm">Tap to replay</p>
      </div>
      <ChoiceList {...props} />
    </div>
  );
}

export function ReactExercise(props: ExerciseProps) {
  const { exercise } = props;
  return (
    <div>
      <Instruction>{exercise.instruction ?? 'What do you do?'}</Instruction>
      <div className="mb-6 flex items-center gap-4 rounded-2xl border-2 border-alert/40 bg-alert/10 p-4">
        <AudioButton text={exercise.audioText ?? exercise.prompt} size="lg" autoPlay />
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-alert">{exercise.prompt}</p>
          <p className="muted text-xs">Shouted command — react</p>
        </div>
      </div>
      <ChoiceList {...props} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing (write / listen_type / fill_blank)
// ─────────────────────────────────────────────────────────────────────────────

function TypedAnswer({
  exercise,
  value,
  onChange,
  checked,
  placeholder,
}: ExerciseProps & { placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!checked) ref.current?.focus();
  }, [checked, exercise.prompt]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="typed-answer" className="sr-only">
        {exercise.instruction ?? 'Your answer'}
      </label>
      <textarea
        id="typed-answer"
        ref={ref}
        value={value}
        disabled={checked}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder={placeholder}
        className={clsx(
          'raised w-full resize-none rounded-2xl border-2 p-4 text-lg outline-none transition-colors',
          'placeholder:text-base-400 focus:border-signal disabled:opacity-70',
        )}
      />
      <p className="muted text-xs">
        Lithuanian letters are optional — “aciu” is accepted for “ačiū”.
      </p>
    </div>
  );
}

export function WriteExercise(props: ExerciseProps) {
  return (
    <div>
      <Instruction>{props.exercise.instruction ?? 'Translate into Lithuanian'}</Instruction>
      <div className="mb-6">
        <Prompt>{props.exercise.prompt}</Prompt>
      </div>
      <TypedAnswer {...props} placeholder="Type in Lithuanian…" />
    </div>
  );
}

export function ListenTypeExercise(props: ExerciseProps) {
  const { exercise } = props;
  return (
    <div>
      <Instruction>{exercise.instruction ?? 'Type what you hear'}</Instruction>
      <div className="mb-6 flex items-center gap-4">
        <AudioButton text={exercise.audioText ?? exercise.answer} size="lg" autoPlay />
        <p className="muted text-sm">Tap to replay</p>
      </div>
      <TypedAnswer {...props} placeholder="Type what you heard…" />
    </div>
  );
}

export function FillBlankExercise(props: ExerciseProps) {
  const { exercise } = props;
  const [before, after] = exercise.prompt.split('_____');

  return (
    <div>
      <Instruction>{exercise.instruction ?? 'Fill the gap'}</Instruction>
      <div className="mb-6 rounded-2xl border p-4 raised">
        <p className="text-xl font-bold leading-relaxed">
          {before}
          <span className="mx-1 inline-block min-w-[5rem] border-b-2 border-signal pb-0.5 text-center text-signal">
            {props.value || ' '}
          </span>
          {after}
        </p>
      </div>
      <TypedAnswer {...props} placeholder="Missing word…" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Speaking
// ─────────────────────────────────────────────────────────────────────────────

export function SpeakExercise({ exercise, value, onChange, checked, correct }: ExerciseProps) {
  const [skipped, setSkipped] = useState(false);

  return (
    <div>
      <Instruction>{exercise.instruction ?? 'Say it out loud'}</Instruction>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border p-4 raised">
        <AudioButton text={exercise.audioText ?? exercise.prompt} size="md" />
        <div className="min-w-0">
          <p className="text-2xl font-extrabold leading-tight">{exercise.prompt}</p>
          {exercise.explanation && <p className="muted text-sm">{exercise.explanation}</p>}
        </div>
      </div>

      {!checked && !skipped && (
        <MicButton onTranscript={(transcript) => onChange(transcript)} disabled={checked} />
      )}

      {value && (
        <div
          className={clsx(
            'mt-5 rounded-xl border-2 p-3 text-center',
            checked && correct && 'border-signal bg-signal/10',
            checked && !correct && 'border-alert bg-alert/10',
            !checked && 'raised border-[color:var(--app-border)]',
          )}
        >
          <p className="muted text-xs font-semibold uppercase tracking-wide">I heard</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      )}

      {!checked && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSkipped(true);
              // Marking it as attempted lets the learner move on; the server
              // will score it as incorrect, which is honest.
              onChange(value || '—');
            }}
            className="muted text-sm font-semibold underline"
          >
            Can’t speak right now — skip this one
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Word bank
// ─────────────────────────────────────────────────────────────────────────────

export function WordBankExercise({ exercise, onChange, checked }: ExerciseProps) {
  const tiles = useMemo(() => exercise.tiles ?? [], [exercise.tiles]);
  const [used, setUsed] = useState<number[]>([]);

  // Reset when the exercise changes.
  useEffect(() => {
    setUsed([]);
  }, [exercise.prompt]);

  const push = (index: number) => {
    if (checked || used.includes(index)) return;
    const next = [...used, index];
    setUsed(next);
    onChange(next.map((i) => tiles[i]).join(' '));
  };

  const pop = (position: number) => {
    if (checked) return;
    const next = used.filter((_, i) => i !== position);
    setUsed(next);
    onChange(next.map((i) => tiles[i]).join(' '));
  };

  return (
    <div>
      <Instruction>{exercise.instruction ?? 'Build the Lithuanian sentence'}</Instruction>
      <div className="mb-6">
        <Prompt size="md">{exercise.prompt}</Prompt>
      </div>

      {/* Answer line */}
      <div
        className="mb-6 min-h-[4.5rem] rounded-2xl border-2 border-dashed p-3"
        style={{ borderColor: 'var(--app-border)' }}
        aria-live="polite"
      >
        <div className="flex flex-wrap gap-2">
          {used.length === 0 && (
            <span className="muted self-center text-sm">Tap the words below in order</span>
          )}
          {used.map((tileIndex, position) => (
            <button
              key={`${tileIndex}-${position}`}
              type="button"
              disabled={checked}
              onClick={() => pop(position)}
              className="tap rounded-xl border-2 border-signal bg-signal/15 px-3 py-2 font-semibold text-signal disabled:opacity-70"
            >
              {tiles[tileIndex]}
            </button>
          ))}
        </div>
      </div>

      {/* Bank */}
      <div className="flex flex-wrap gap-2">
        {tiles.map((tile, index) => (
          <button
            key={`${tile}-${index}`}
            type="button"
            disabled={checked || used.includes(index)}
            onClick={() => push(index)}
            className={clsx(
              'tap raised rounded-xl border-2 px-3 py-2 font-semibold transition-all',
              used.includes(index)
                ? 'invisible'
                : 'border-[color:var(--app-border)] hover:border-signal/60',
            )}
          >
            {tile}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Match pairs
// ─────────────────────────────────────────────────────────────────────────────

export function MatchExercise({ exercise, onChange, checked }: ExerciseProps) {
  const pairs = useMemo(() => exercise.pairs ?? [], [exercise.pairs]);

  const shuffledEn = useMemo(
    () => pairs.map((pair, index) => ({ ...pair, index })).sort((a, b) => a.en.localeCompare(b.en)),
    [pairs],
  );

  const [selectedLt, setSelectedLt] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);

  useEffect(() => {
    setMatched([]);
    setSelectedLt(null);
  }, [exercise.prompt]);

  useEffect(() => {
    if (matched.length > 0 && matched.length === pairs.length) {
      onChange(pairs.map((pair) => pair.lt).join('|'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.length, pairs.length]);

  const chooseEn = (index: number) => {
    if (selectedLt === null || checked) return;
    if (selectedLt === index) {
      setMatched((current) => [...current, index]);
      setSelectedLt(null);
    } else {
      setWrong(index);
      setTimeout(() => setWrong(null), 420);
      setSelectedLt(null);
    }
  };

  return (
    <div>
      <Instruction>{exercise.instruction ?? 'Match the pairs'}</Instruction>
      <p className="muted mb-5 text-sm">
        {matched.length} of {pairs.length} matched
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2.5">
          {pairs.map((pair, index) => {
            const done = matched.includes(index);
            return (
              <button
                key={pair.lt}
                type="button"
                disabled={done || checked}
                onClick={() => setSelectedLt(index)}
                className={clsx(
                  'tap flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left text-[0.95rem] font-semibold transition-all',
                  done && 'border-signal/40 bg-signal/10 text-signal opacity-60',
                  !done && selectedLt === index && 'border-signal bg-signal/15',
                  !done && selectedLt !== index && 'raised border-[color:var(--app-border)]',
                )}
              >
                {pair.lt}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5">
          {shuffledEn.map((pair) => {
            const done = matched.includes(pair.index);
            return (
              <button
                key={pair.en}
                type="button"
                disabled={done || checked}
                onClick={() => chooseEn(pair.index)}
                className={clsx(
                  'tap rounded-xl border-2 px-3 py-3 text-left text-[0.95rem] font-semibold transition-all',
                  done && 'border-signal/40 bg-signal/10 text-signal opacity-60',
                  wrong === pair.index && 'animate-shake border-alert bg-alert/15',
                  !done && wrong !== pair.index && 'raised border-[color:var(--app-border)]',
                )}
              >
                {pair.en}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export function ExerciseView(props: ExerciseProps) {
  switch (props.exercise.type) {
    case 'select':
      return <SelectExercise {...props} />;
    case 'listen_select':
      return <ListenSelectExercise {...props} />;
    case 'react':
      return <ReactExercise {...props} />;
    case 'listen_type':
      return <ListenTypeExercise {...props} />;
    case 'write':
      return <WriteExercise {...props} />;
    case 'fill_blank':
      return <FillBlankExercise {...props} />;
    case 'speak':
      return <SpeakExercise {...props} />;
    case 'word_bank':
      return <WordBankExercise {...props} />;
    case 'match':
      return <MatchExercise {...props} />;
    default:
      return (
        <div>
          <Prompt>{props.exercise.prompt}</Prompt>
          <Button className="mt-4" onClick={() => props.onChange(props.exercise.answer)}>
            Continue
          </Button>
        </div>
      );
  }
}
