/**
 * Spaced repetition — SM-2, the algorithm behind SuperMemo and Anki.
 *
 * A word you get right keeps widening its interval; a word you fail drops back
 * to daily and its ease factor takes a permanent hit, so genuinely hard words
 * keep coming back more often than easy ones.
 */

/** What the learner reports after seeing a card. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

/** The four buttons shown in the UI, mapped to SM-2 grades. */
export const GRADE_BUTTONS = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
} as const satisfies Record<string, Grade>;

export type GradeButton = keyof typeof GRADE_BUTTONS;

export interface CardState {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ReviewOutcome extends CardState {
  dueAt: Date;
}

const MIN_EASE = 1.3;
const DAY_MS = 86_400_000;

export function reviewCard(card: CardState, grade: Grade, now = new Date()): ReviewOutcome {
  let { ease, intervalDays, repetitions, lapses } = card;

  if (grade < 3) {
    // Failed. Back to the start of the ladder, and the card is marked as harder
    // than we thought — but never below the SM-2 floor of 1.3.
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);

    // The classic SM-2 ease adjustment.
    ease = Math.max(MIN_EASE, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }

  // Never schedule further out than ~9 months — the curriculum is finite and a
  // word you have not seen in a year is effectively new again.
  intervalDays = Math.min(intervalDays, 270);

  return {
    ease: Number(ease.toFixed(3)),
    intervalDays,
    repetitions,
    lapses,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}

/** A brand-new card is due immediately. */
export function newCard(now = new Date()): ReviewOutcome {
  return { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now };
}

/**
 * When a word is answered inside a lesson (rather than in a review session) we
 * still want it to enter the review queue — but a single correct tap should not
 * push it out six days. This nudges rather than promotes.
 */
export function nudgeFromLesson(
  card: CardState,
  correct: boolean,
  now = new Date(),
): ReviewOutcome {
  return reviewCard(card, correct ? 3 : 1, now);
}
