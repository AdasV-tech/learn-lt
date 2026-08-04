import { normalize } from '@kalba/content';
import type { Exercise } from '@kalba/content';

export interface GradeResult {
  correct: boolean;
  /** True when the answer was accepted despite a small spelling slip. */
  typo: boolean;
  /** 0–1 similarity, useful for showing pronunciation feedback. */
  similarity: number;
  expected: string;
}

/** Levenshtein distance, iterative with a single row buffer. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = (current[j - 1] ?? 0) + 1;
      const deletion = (previous[j] ?? 0) + 1;
      current[j] = Math.min(substitution, insertion, deletion);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** 1 = identical, 0 = nothing in common. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}

/**
 * How close a typed answer has to be, per exercise type.
 *
 * Speech recognition mangles endings and drops diacritics, so speaking is the
 * most forgiving. Typed Lithuanian is checked strictly enough that a wrong case
 * ending still counts as wrong — that is the thing being taught.
 */
function threshold(type: Exercise['type']): number {
  switch (type) {
    case 'speak':
      return 0.7;
    case 'listen_type':
    case 'write':
    case 'fill_blank':
      return 0.9;
    default:
      return 1;
  }
}

export function gradeExercise(exercise: Exercise, response: string): GradeResult {
  const given = normalize(response ?? '');
  const candidates = [exercise.answer, ...(exercise.altAnswers ?? [])].map(normalize);

  let best = 0;
  for (const candidate of candidates) {
    if (given === candidate) {
      return { correct: true, typo: false, similarity: 1, expected: exercise.answer };
    }
    best = Math.max(best, similarity(given, candidate));
  }

  const limit = threshold(exercise.type);
  const accepted = best >= limit && limit < 1;

  return {
    correct: accepted,
    typo: accepted,
    similarity: Number(best.toFixed(3)),
    expected: exercise.answer,
  };
}

/**
 * XP for one answer.
 *
 * A first-time-correct answer pays full; one accepted with a typo pays less; a
 * wrong answer pays nothing. Difficulty scales the whole thing.
 */
export function xpForAnswer(exercise: Exercise, result: GradeResult): number {
  if (!result.correct) return 0;
  const base = { 1: 2, 2: 3, 3: 5 }[exercise.difficulty ?? 1];
  return result.typo ? Math.max(1, Math.round(base * 0.6)) : base;
}
