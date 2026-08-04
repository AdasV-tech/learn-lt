import type { Drill, Exercise, ExerciseType, Lesson, Word } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fold a string down to something we can compare answers with: lower case, no
 * diacritics, no punctuation, single spaces.
 *
 * This is what lets a learner type "aciu" on a keyboard without Lithuanian
 * letters and still be marked correct.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:"“”„‘’'()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First sense of a gloss, without the parenthetical, for use in option lists. */
export function shortEn(en: string): string {
  const firstSense = en.split(';')[0] ?? en;
  return firstSense
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic shuffling
//
// Seeding from the lesson slug keeps generated exercises byte-identical across
// runs, so re-seeding the database does not churn every row and tests can
// assert on concrete output.
// ─────────────────────────────────────────────────────────────────────────────

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Distractor selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick `count` wrong answers for a multiple-choice question.
 *
 * Preference order: same category (hardest and most useful), then same level,
 * then anything. Anything that normalises to the same string as the answer is
 * excluded so we never offer two correct options.
 */
function pickDistractors(
  target: Word,
  pool: readonly Word[],
  count: number,
  rng: () => number,
  project: (w: Word) => string,
): string[] {
  const answer = normalize(project(target));
  const seen = new Set<string>([answer]);
  const chosen: string[] = [];

  const tiers = [
    pool.filter((w) => w.category === target.category && w.lt !== target.lt),
    pool.filter((w) => w.level === target.level && w.category !== target.category),
    pool.filter((w) => w.level !== target.level),
  ];

  for (const tier of tiers) {
    for (const candidate of shuffle(tier, rng)) {
      if (chosen.length >= count) return chosen;
      const value = project(candidate);
      const key = normalize(value);
      if (seen.has(key) || !key) continue;
      seen.add(key);
      chosen.push(value);
    }
  }
  return chosen;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise builders
// ─────────────────────────────────────────────────────────────────────────────

function acceptedFormsFor(word: Word): string[] {
  return word.alt ?? [];
}

function wordExercises(word: Word, pool: readonly Word[], rng: () => number): Exercise[] {
  const out: Exercise[] = [];
  const gloss = shortEn(word.en);

  // English → Lithuanian, four options.
  out.push({
    type: 'select',
    prompt: gloss,
    instruction: 'Choose the Lithuanian',
    answer: word.lt,
    altAnswers: acceptedFormsFor(word),
    options: shuffle([word.lt, ...pickDistractors(word, pool, 3, rng, (w) => w.lt)], rng),
    explanation: word.grammar ?? word.usage,
    wordLt: word.lt,
    difficulty: 1,
  });

  // Audio → meaning.
  out.push({
    type: 'listen_select',
    prompt: 'What did you hear?',
    instruction: 'Tap the play button, then choose the meaning',
    audioText: word.lt,
    answer: gloss,
    options: shuffle([gloss, ...pickDistractors(word, pool, 3, rng, (w) => shortEn(w.en))], rng),
    explanation: word.usage,
    wordLt: word.lt,
    difficulty: 2,
  });

  // Say it. Commands and radio prowords are exactly what must be said aloud, so
  // they always get a speaking rep; other words get one every other time.
  const alwaysSpeak =
    word.pos === 'command' || (word.tags?.includes('radio') ?? false) || word.pos === 'phrase';
  if (alwaysSpeak || rng() < 0.5) {
    out.push({
      type: 'speak',
      prompt: word.lt,
      instruction: 'Say it out loud',
      audioText: word.lt,
      answer: word.lt,
      altAnswers: acceptedFormsFor(word),
      explanation: gloss,
      wordLt: word.lt,
      difficulty: 2,
    });
  }

  // Type what you hear — the hardest single-word drill, so only some words.
  if (rng() < 0.4) {
    out.push({
      type: 'listen_type',
      prompt: 'Type what you hear',
      instruction: 'Lithuanian spelling — diacritics optional',
      audioText: word.lt,
      answer: word.lt,
      altAnswers: acceptedFormsFor(word),
      explanation: gloss,
      wordLt: word.lt,
      difficulty: 3,
    });
  }

  return out;
}

function drillExercises(
  drill: Drill,
  siblings: readonly Drill[],
  pool: readonly Word[],
  rng: () => number,
): Exercise[] {
  const modes: ExerciseType[] = drill.modes ?? ['word_bank', 'write'];
  const out: Exercise[] = [];

  for (const mode of modes) {
    switch (mode) {
      case 'word_bank': {
        const answerTiles = drill.lt.split(/\s+/).filter(Boolean);
        // A couple of plausible extra tiles so the bank is not a giveaway.
        const extras = shuffle(pool, rng)
          .filter((w) => !w.lt.includes(' ') && !answerTiles.includes(w.lt))
          .slice(0, 3)
          .map((w) => w.lt);
        out.push({
          type: 'word_bank',
          prompt: drill.en,
          instruction: 'Build the Lithuanian sentence',
          answer: drill.lt,
          tiles: shuffle([...answerTiles, ...extras], rng),
          explanation: drill.explanation,
          difficulty: 2,
        });
        break;
      }
      case 'write': {
        out.push({
          type: 'write',
          prompt: drill.en,
          instruction: 'Translate into Lithuanian',
          answer: drill.lt,
          explanation: drill.explanation,
          difficulty: 3,
        });
        break;
      }
      case 'listen_type': {
        out.push({
          type: 'listen_type',
          prompt: 'Type what you hear',
          instruction: 'Lithuanian spelling — diacritics optional',
          audioText: drill.lt,
          answer: drill.lt,
          explanation: drill.en,
          difficulty: 3,
        });
        break;
      }
      case 'speak': {
        out.push({
          type: 'speak',
          prompt: drill.lt,
          instruction: 'Say it out loud',
          audioText: drill.lt,
          answer: drill.lt,
          explanation: drill.en,
          difficulty: 2,
        });
        break;
      }
      case 'listen_select': {
        const others = siblings.filter((d) => d.lt !== drill.lt).map((d) => d.en);
        out.push({
          type: 'listen_select',
          prompt: 'What did you hear?',
          instruction: 'Tap the play button, then choose the meaning',
          audioText: drill.lt,
          answer: drill.en,
          options: shuffle([drill.en, ...shuffle(others, rng).slice(0, 3)], rng),
          difficulty: 2,
        });
        break;
      }
      default:
        break;
    }
  }

  if (drill.blank) {
    const gapped = drill.lt.replace(drill.blank, '_____');
    if (gapped !== drill.lt) {
      out.push({
        type: 'fill_blank',
        prompt: gapped,
        instruction: `Fill the gap — “${drill.en}”`,
        answer: drill.blank,
        explanation: drill.explanation,
        difficulty: 3,
      });
    }
  }

  return out;
}

function matchExercise(words: readonly Word[], rng: () => number): Exercise | null {
  const usable = words.filter((w) => w.pos !== 'letter');
  if (usable.length < 4) return null;
  const picked = shuffle(usable, rng).slice(0, Math.min(5, usable.length));
  return {
    type: 'match',
    prompt: 'Match the pairs',
    instruction: 'Tap a Lithuanian word, then its English meaning',
    answer: picked.map((w) => w.lt).join('|'),
    pairs: picked.map((w) => ({ lt: w.lt, en: shortEn(w.en) })),
    difficulty: 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** How much XP a single correct answer is worth, before lesson-level bonuses. */
export function xpForExercise(difficulty: 1 | 2 | 3 = 1): number {
  return { 1: 2, 2: 3, 3: 5 }[difficulty];
}

/**
 * Expand a lesson definition into the ordered list of exercises the player runs.
 *
 * Order is deliberate: a warm-up match, then the new vocabulary, then sentence
 * work, then any hand-authored exercises. Within each block the order is
 * shuffled deterministically from the lesson slug.
 */
export function buildLesson(lesson: Lesson, allWords: readonly Word[]): Exercise[] {
  const rng = mulberry32(hash(lesson.slug));
  const byLt = new Map(allWords.map((w) => [w.lt, w]));

  const lessonWords = lesson.words
    .map((lt) => byLt.get(lt))
    .filter((w): w is Word => w !== undefined);

  const exercises: Exercise[] = [];

  const match = matchExercise(lessonWords, rng);
  if (match) exercises.push(match);

  const vocab = lessonWords.flatMap((word) => wordExercises(word, allWords, rng));
  exercises.push(...shuffle(vocab, rng));

  const drills = lesson.drills ?? [];
  const sentence = drills.flatMap((drill) => drillExercises(drill, drills, allWords, rng));
  exercises.push(...shuffle(sentence, rng));

  exercises.push(...(lesson.extraExercises ?? []));

  return exercises;
}

/** Total XP available from a lesson if every answer is correct first time. */
export function lessonXp(lesson: Lesson, allWords: readonly Word[]): number {
  const base = lesson.xp ?? 10;
  const fromExercises = buildLesson(lesson, allWords).reduce(
    (sum, ex) => sum + xpForExercise(ex.difficulty ?? 1),
    0,
  );
  return base + fromExercises;
}
