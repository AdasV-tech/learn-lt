import { describe, expect, it } from 'vitest';
import { achievements } from './achievements.js';
import { buildLesson, normalize, shortEn } from './build.js';
import { grammarPages } from './grammar.js';
import { units } from './units.js';
import { allLessons, courseStats, words, wordsByLt } from './index.js';

describe('normalize', () => {
  it('folds diacritics so a plain keyboard still works', () => {
    expect(normalize('Ačiū')).toBe('aciu');
    expect(normalize('Dėmesio!')).toBe('demesio');
    expect(normalize('pone puskarininki')).toBe('pone puskarininki');
  });

  it('ignores punctuation, case and repeated spacing', () => {
    expect(normalize('Stok!  Kas eina?')).toBe('stok kas eina');
    expect(normalize('  Į  priedangą!  ')).toBe('i priedanga');
  });

  it('treats the accented and unaccented spellings as equal', () => {
    expect(normalize('Gulk!')).toBe(normalize('gulk'));
    expect(normalize('žemėlapis')).toBe(normalize('zemelapis'));
  });
});

describe('shortEn', () => {
  it('keeps only the first sense and drops the parenthetical', () => {
    expect(shortEn('Attention! (stand to attention)')).toBe('Attention!');
    expect(shortEn('yes; certainly')).toBe('yes');
  });
});

describe('vocabulary', () => {
  it('has no duplicate dictionary forms', () => {
    const seen = new Set<string>();
    for (const word of words) {
      expect(seen.has(word.lt), `duplicate: ${word.lt}`).toBe(false);
      seen.add(word.lt);
    }
  });

  it('gives every entry a gloss, a respelling and a category', () => {
    for (const word of words) {
      expect(word.en.trim().length, word.lt).toBeGreaterThan(0);
      expect(word.pron.trim().length, word.lt).toBeGreaterThan(0);
      expect(word.category.trim().length, word.lt).toBeGreaterThan(0);
    }
  });

  it('uses only letters that exist in the Lithuanian alphabet', () => {
    // q, w and x are not Lithuanian letters — one appearing is a typo.
    const foreign = /[qwxQWX]/;
    for (const word of words) {
      expect(foreign.test(word.lt), `${word.lt} contains q/w/x`).toBe(false);
      for (const example of word.examples ?? []) {
        expect(foreign.test(example.lt), `${example.lt} contains q/w/x`).toBe(false);
      }
    }
  });

  it('teaches the personal commands as imperatives, not dictionary forms', () => {
    // The single most common error in military phrasebooks is listing the
    // infinitive — "Stoti!", "Gulėti!", "Keltis!" — as if it were shouted.
    // These four are the ones learners most often meet in the wrong form.
    const required = ['Stok!', 'Gulk!', 'Kelkis!', 'Pirmyn!'];
    for (const form of required) {
      expect(wordsByLt.has(form), `missing imperative “${form}”`).toBe(true);
    }

    const wrong = ['Stoti!', 'Gulėti!', 'Keltis!', 'Eiti!'];
    for (const form of wrong) {
      expect(
        wordsByLt.has(form),
        `“${form}” is an infinitive and must not be taught as a command`,
      ).toBe(false);
    }
  });

  it('only uses a bare infinitive for blanket orders to a group', () => {
    // Lithuanian *does* order a whole formation with a plain infinitive
    // ("Nešaudyti!", "Nutraukti ugnį!"). What it never does is shout the
    // infinitive at one person in place of an imperative — so an infinitive
    // command is fine only when it is negated or takes an object.
    const commands = words.filter((word) => word.pos === 'command');
    expect(commands.length).toBeGreaterThan(10);

    for (const command of commands) {
      const cleaned = command.lt.replace(/[!?]/g, '').trim();
      if (!cleaned.toLowerCase().endsWith('ti')) continue;

      const negated = /^ne/i.test(cleaned);
      const takesAnObject = cleaned.includes(' ');
      // Reflexives are marked either by the -si ending ("slėptis") or by the
      // -si- infix after a prefix ("iš-si-skirstyti"). Both are group orders.
      // \p{L} rather than \w — Lithuanian letters are outside ASCII.
      const reflexive = /tis$/iu.test(cleaned) || /^\p{L}+si\p{L}*ti$/iu.test(cleaned);

      expect(
        negated || takesAnObject || reflexive,
        `“${command.lt}” is a bare infinitive with no object — should be an imperative`,
      ).toBe(true);
    }
  });

  it('keeps “Ramiai!” and “Dėmesio!” as distinct commands', () => {
    const ramiai = wordsByLt.get('Ramiai!');
    const demesio = wordsByLt.get('Dėmesio!');
    expect(ramiai?.en).toMatch(/stand to attention/i);
    expect(demesio?.usage).toMatch(/not the drill command/i);
  });
});

describe('units and lessons', () => {
  it('references only words that exist', () => {
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        for (const lt of lesson.words) {
          expect(wordsByLt.has(lt), `${lesson.slug} → unknown word “${lt}”`).toBe(true);
        }
      }
    }
  });

  it('has unique slugs', () => {
    const unitSlugs = units.map((unit) => unit.slug);
    expect(new Set(unitSlugs).size).toBe(unitSlugs.length);

    const lessonSlugs = allLessons().map(({ lesson }) => lesson.slug);
    expect(new Set(lessonSlugs).size).toBe(lessonSlugs.length);
  });

  it('blanks a substring that actually occurs in its drill', () => {
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        for (const drill of lesson.drills ?? []) {
          if (drill.blank) {
            expect(drill.lt, `${lesson.slug}: “${drill.blank}”`).toContain(drill.blank);
          }
        }
      }
    }
  });

  it('covers every level with at least one unit', () => {
    const levels = new Set(units.map((unit) => unit.level));
    expect(levels).toEqual(new Set(['MIL1', 'MIL2', 'MIL3', 'MIL4', 'MIL5', 'MIL6']));
  });
});

describe('buildLesson', () => {
  const sample = allLessons()[0]!.lesson;

  it('is deterministic — the same lesson always yields the same exercises', () => {
    const first = buildLesson(sample, words);
    const second = buildLesson(sample, words);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('produces a usable set of exercises for every lesson', () => {
    for (const { lesson } of allLessons()) {
      const exercises = buildLesson(lesson, words);
      expect(exercises.length, lesson.slug).toBeGreaterThanOrEqual(4);

      for (const exercise of exercises) {
        expect(exercise.answer.trim().length, `${lesson.slug}/${exercise.type}`).toBeGreaterThan(0);
      }
    }
  });

  it('never offers two correct options in a multiple-choice question', () => {
    for (const { lesson } of allLessons()) {
      for (const exercise of buildLesson(lesson, words)) {
        if (!exercise.options) continue;
        const normalised = exercise.options.map(normalize);
        expect(new Set(normalised).size, `${lesson.slug}: ${exercise.options.join(' / ')}`).toBe(
          normalised.length,
        );
        expect(normalised).toContain(normalize(exercise.answer));
      }
    }
  });

  it('always ships a word bank that can spell its own answer', () => {
    for (const { lesson } of allLessons()) {
      for (const exercise of buildLesson(lesson, words)) {
        if (exercise.type !== 'word_bank') continue;
        const tiles = [...(exercise.tiles ?? [])];
        for (const token of exercise.answer.split(/\s+/)) {
          const at = tiles.indexOf(token);
          expect(at, `${lesson.slug}: missing tile “${token}”`).toBeGreaterThanOrEqual(0);
          tiles.splice(at, 1);
        }
      }
    }
  });

  it('gives every audio exercise something to speak', () => {
    for (const { lesson } of allLessons()) {
      for (const exercise of buildLesson(lesson, words)) {
        if (!['listen_select', 'listen_type', 'speak'].includes(exercise.type)) continue;
        expect(
          exercise.audioText?.trim().length,
          `${lesson.slug}/${exercise.type}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('achievements', () => {
  it('has unique slugs and positive thresholds', () => {
    const slugs = achievements.map((achievement) => achievement.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const achievement of achievements) {
      expect(achievement.threshold, achievement.slug).toBeGreaterThan(0);
    }
  });

  it('keeps the “finish everything” target in step with the course', () => {
    const target = achievements.find((achievement) => achievement.slug === 'all-lessons');
    expect(target?.threshold).toBe(allLessons().length);
  });
});

describe('grammar reference', () => {
  it('has unique slugs and substantial bodies', () => {
    const slugs = grammarPages.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const page of grammarPages) {
      expect(page.body.length, page.slug).toBeGreaterThan(500);
    }
  });
});

describe('courseStats', () => {
  it('reports a course big enough to be worth shipping', () => {
    const stats = courseStats();
    expect(stats.levels).toBe(6);
    expect(stats.lessons).toBeGreaterThanOrEqual(30);
    expect(stats.words).toBeGreaterThanOrEqual(200);
    expect(stats.exercises).toBeGreaterThanOrEqual(500);
    expect(stats.byLevel).toHaveLength(6);
  });
});
