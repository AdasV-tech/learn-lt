import { describe, expect, it } from 'vitest';
import { gradeExercise, similarity, xpForAnswer } from '../src/services/grading.js';
import { GRADE_BUTTONS, newCard, nudgeFromLesson, reviewCard } from '../src/services/srs.js';
import { levelForXp, levelProgress, xpForLevel } from '../src/lib/levels.js';
import { currentStreak, daysBetween, nextStreak, utcDay } from '../src/lib/dates.js';
import { parseDuration } from '../src/lib/tokens.js';
import type { Exercise } from '@kalba/content';

const select = (answer: string): Exercise => ({
  type: 'select',
  prompt: 'x',
  answer,
  options: [answer, 'a', 'b', 'c'],
  difficulty: 1,
});

const write = (answer: string, alt?: string[]): Exercise => ({
  type: 'write',
  prompt: 'x',
  answer,
  altAnswers: alt,
  difficulty: 3,
});

describe('grading', () => {
  it('accepts the exact answer', () => {
    expect(gradeExercise(select('Stok!'), 'Stok!').correct).toBe(true);
  });

  it('accepts a diacritic-free answer typed on a plain keyboard', () => {
    const result = gradeExercise(write('Dėmesio!'), 'demesio');
    expect(result.correct).toBe(true);
    expect(result.typo).toBe(false);
  });

  it('accepts a listed alternative form', () => {
    const result = gradeExercise(write('Sek mane!', ['sekite mane']), 'Sekite mane');
    expect(result.correct).toBe(true);
  });

  it('forgives a one-letter slip when typing a sentence', () => {
    const result = gradeExercise(write('Priešas kairėje'), 'Priesas kaireje!');
    expect(result.correct).toBe(true);
  });

  it('rejects a wrong case ending — that is the thing being taught', () => {
    // "po tiltu" (instrumental) is right; "po tiltas" (nominative) is not.
    expect(gradeExercise(write('Priedanga po tiltu'), 'Priedanga po tiltas').correct).toBe(false);
  });

  it('is strict on multiple choice — no partial credit', () => {
    expect(gradeExercise(select('Gulk!'), 'Kelkis!').correct).toBe(false);
  });

  it('is lenient on speaking, where recognition mangles endings', () => {
    const speak: Exercise = {
      type: 'speak',
      prompt: 'x',
      answer: 'Skyrius pasiruošęs',
      difficulty: 2,
    };
    expect(gradeExercise(speak, 'skyrius pasiruoses').correct).toBe(true);
    expect(gradeExercise(speak, 'visai kitas dalykas').correct).toBe(false);
  });

  it('reports similarity for pronunciation feedback', () => {
    expect(similarity('stok', 'stok')).toBe(1);
    expect(similarity('stok', 'gulk')).toBeLessThan(0.6);
  });
});

describe('xp for an answer', () => {
  it('pays nothing for a wrong answer', () => {
    const exercise = write('x');
    expect(
      xpForAnswer(exercise, { correct: false, typo: false, similarity: 0, expected: 'x' }),
    ).toBe(0);
  });

  it('pays more for harder exercises', () => {
    const easy = select('x');
    const hard = write('x');
    const clean = { correct: true, typo: false, similarity: 1, expected: 'x' };
    expect(xpForAnswer(hard, clean)).toBeGreaterThan(xpForAnswer(easy, clean));
  });

  it('pays less when the answer only scraped through on a typo', () => {
    const exercise = write('x');
    const clean = xpForAnswer(exercise, {
      correct: true,
      typo: false,
      similarity: 1,
      expected: 'x',
    });
    const typo = xpForAnswer(exercise, {
      correct: true,
      typo: true,
      similarity: 0.92,
      expected: 'x',
    });
    expect(typo).toBeLessThan(clean);
    expect(typo).toBeGreaterThan(0);
  });
});

describe('spaced repetition (SM-2)', () => {
  it('starts a new card due immediately', () => {
    const card = newCard();
    expect(card.intervalDays).toBe(0);
    expect(card.repetitions).toBe(0);
    expect(card.ease).toBe(2.5);
  });

  it('widens the interval on each successful review', () => {
    let card = reviewCard(newCard(), GRADE_BUTTONS.good);
    expect(card.intervalDays).toBe(1);
    card = reviewCard(card, GRADE_BUTTONS.good);
    expect(card.intervalDays).toBe(6);
    card = reviewCard(card, GRADE_BUTTONS.good);
    expect(card.intervalDays).toBeGreaterThan(6);
  });

  it('drops a failed card back to daily and marks it harder', () => {
    let card = reviewCard(newCard(), GRADE_BUTTONS.good);
    card = reviewCard(card, GRADE_BUTTONS.good);
    card = reviewCard(card, GRADE_BUTTONS.good);
    const before = card.ease;

    const failed = reviewCard(card, GRADE_BUTTONS.again);
    expect(failed.intervalDays).toBe(1);
    expect(failed.repetitions).toBe(0);
    expect(failed.lapses).toBe(1);
    expect(failed.ease).toBeLessThan(before);
  });

  it('never lets ease fall below the SM-2 floor', () => {
    let card = newCard();
    for (let i = 0; i < 40; i++) card = reviewCard(card, GRADE_BUTTONS.again);
    expect(card.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('caps the interval so nothing disappears for a year', () => {
    let card = newCard();
    for (let i = 0; i < 30; i++) card = reviewCard(card, GRADE_BUTTONS.easy);
    expect(card.intervalDays).toBeLessThanOrEqual(270);
  });

  it('only nudges a card met inside a lesson, rather than promoting it', () => {
    const promoted = reviewCard(newCard(), GRADE_BUTTONS.easy);
    const nudged = nudgeFromLesson(newCard(), true);
    expect(nudged.ease).toBeLessThan(promoted.ease);
  });
});

describe('xp levels', () => {
  it('matches the published curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(250);
  });

  it('keeps getting more expensive', () => {
    for (let level = 2; level < 30; level++) {
      const step = xpForLevel(level + 1) - xpForLevel(level);
      const previous = xpForLevel(level) - xpForLevel(level - 1);
      expect(step).toBeGreaterThan(previous);
    }
  });

  it('maps xp back to the right level', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(249)).toBe(2);
    expect(levelForXp(250)).toBe(3);
  });

  it('reports progress within the current level', () => {
    const progress = levelProgress(175);
    expect(progress.level).toBe(2);
    expect(progress.xpIntoLevel).toBe(75);
    expect(progress.xpForNextLevel).toBe(150);
    expect(progress.progress).toBeCloseTo(0.5);
  });
});

describe('streaks', () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

  it('starts at one for a first-ever session', () => {
    expect(nextStreak(0, null, day('2026-03-11'))).toBe(1);
  });

  it('does not double-count two sessions on the same day', () => {
    expect(nextStreak(5, day('2026-03-11'), day('2026-03-11'))).toBe(5);
  });

  it('extends when yesterday was trained', () => {
    expect(nextStreak(5, day('2026-03-10'), day('2026-03-11'))).toBe(6);
  });

  it('resets after a missed day', () => {
    expect(nextStreak(12, day('2026-03-08'), day('2026-03-11'))).toBe(1);
  });

  it('shows a dead streak as zero without erasing the stored value', () => {
    expect(currentStreak(12, day('2026-03-08'), day('2026-03-11'))).toBe(0);
    expect(currentStreak(12, day('2026-03-10'), day('2026-03-11'))).toBe(12);
  });

  it('counts whole days regardless of the time of day', () => {
    expect(daysBetween(new Date('2026-03-10T23:59:00Z'), new Date('2026-03-11T00:01:00Z'))).toBe(1);
    expect(utcDay(new Date('2026-03-11T18:30:00Z')).toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });
});

describe('duration parsing', () => {
  it('understands the units used in .env', () => {
    expect(parseDuration('45s')).toBe(45_000);
    expect(parseDuration('15m')).toBe(900_000);
    expect(parseDuration('12h')).toBe(43_200_000);
    expect(parseDuration('30d')).toBe(2_592_000_000);
  });

  it('rejects nonsense rather than defaulting silently', () => {
    expect(() => parseDuration('soon')).toThrow();
  });
});
