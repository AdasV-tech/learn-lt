import { mil1Words } from './vocab/mil1.js';
import { mil2Words } from './vocab/mil2.js';
import { mil3Words } from './vocab/mil3.js';
import { mil4Words } from './vocab/mil4.js';
import { mil5Words } from './vocab/mil5.js';
import { mil6Words } from './vocab/mil6.js';
import { units } from './units.js';
import { achievements } from './achievements.js';
import { grammarPages } from './grammar.js';
import { buildLesson, lessonXp } from './build.js';
import { LEVEL_META, LEVELS } from './types.js';
import type { Course, Lesson, Level, Unit, Word } from './types.js';

export * from './types.js';
export { buildLesson, lessonXp, normalize, shortEn, xpForExercise } from './build.js';
export { units } from './units.js';
export { achievements } from './achievements.js';
export { grammarPages } from './grammar.js';

/** Every vocabulary entry, in level order. */
export const words: Word[] = [
  ...mil1Words,
  ...mil2Words,
  ...mil3Words,
  ...mil4Words,
  ...mil5Words,
  ...mil6Words,
];

/** Lookup by dictionary form. */
export const wordsByLt = new Map<string, Word>(words.map((w) => [w.lt, w]));

/** The single course this app teaches. */
export const course: Course = {
  slug: 'military-lithuanian',
  title: 'Military Lithuanian',
  description:
    'Lithuanian for soldiers, NATO personnel and anyone deploying to or working with the Lithuanian Armed Forces — from your first “Taip, pone kapitone” to giving a set of orders.',
  units,
};

export function unitsForLevel(level: Level): Unit[] {
  return units.filter((u) => u.level === level);
}

export function wordsForLevel(level: Level): Word[] {
  return words.filter((w) => w.level === level);
}

export function allLessons(): { unit: Unit; lesson: Lesson }[] {
  return units.flatMap((unit) => unit.lessons.map((lesson) => ({ unit, lesson })));
}

export function findLesson(slug: string): { unit: Unit; lesson: Lesson } | undefined {
  return allLessons().find(({ lesson }) => lesson.slug === slug);
}

/** Vocabulary grouped into flashcard decks by category. */
export function decks(): { category: string; level: Level; words: Word[] }[] {
  const map = new Map<string, Word[]>();
  for (const word of words) {
    const key = `${word.level}:${word.category}`;
    const list = map.get(key);
    if (list) list.push(word);
    else map.set(key, [word]);
  }
  return [...map.entries()].map(([key, list]) => {
    const [level, category] = key.split(':') as [Level, string];
    return { level, category, words: list };
  });
}

/** Headline numbers, used by the README, the CI content check and the app. */
export function courseStats() {
  const lessons = allLessons();
  const exerciseCount = lessons.reduce(
    (sum, { lesson }) => sum + buildLesson(lesson, words).length,
    0,
  );
  return {
    levels: LEVELS.length,
    units: units.length,
    lessons: lessons.length,
    words: words.length,
    exercises: exerciseCount,
    grammarPages: grammarPages.length,
    achievements: achievements.length,
    totalXp: lessons.reduce((sum, { lesson }) => sum + lessonXp(lesson, words), 0),
    byLevel: LEVELS.map((level) => ({
      ...LEVEL_META[level],
      units: unitsForLevel(level).length,
      lessons: unitsForLevel(level).reduce((sum, u) => sum + u.lessons.length, 0),
      words: wordsForLevel(level).length,
    })),
  };
}
