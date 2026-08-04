/**
 * Content integrity check.
 *
 *   npm run content:validate
 *
 * Runs in CI on every commit. Catches the mistakes that are easy to make while
 * authoring curriculum data and impossible to spot by reading: a lesson
 * referencing a word that was renamed, a multiple-choice question whose
 * "wrong" options contain a second correct answer, a word-bank whose tiles
 * cannot spell the target sentence, a stray Latin letter that does not exist in
 * the Lithuanian alphabet.
 */
import { achievements } from './achievements.js';
import { buildLesson, normalize } from './build.js';
import { grammarPages } from './grammar.js';
import { units } from './units.js';
import { words, wordsByLt, allLessons, courseStats } from './index.js';
import type { Word } from './types.js';

const problems: string[] = [];
const warnings: string[] = [];

const fail = (msg: string) => problems.push(msg);
const warn = (msg: string) => warnings.push(msg);

// ── The Lithuanian alphabet, plus the punctuation we allow in content ────────
// q, w and x do not exist in Lithuanian. A stray one almost always means a
// typo or a word copied from another language.
const LT_ALLOWED =
  /^[AĄBCČDEĘĖFGHIĮYJKLMNOPRSŠTUŲŪVZŽaąbcčdeęėfghiįyjklmnoprsštuųūvzž0-9\s.,!?;:%°()„“”"'’—–-]*$/;

function checkLithuanian(context: string, text: string) {
  if (!LT_ALLOWED.test(text)) {
    const bad = [...text].filter((ch) => !LT_ALLOWED.test(ch));
    fail(
      `${context}: contains characters not in the Lithuanian alphabet: ${[...new Set(bad)].join(' ')} — “${text}”`,
    );
  }
}

// ── Vocabulary ──────────────────────────────────────────────────────────────
const seenLt = new Map<string, Word>();
for (const word of words) {
  const context = `word “${word.lt}” (${word.level})`;

  const existing = seenLt.get(word.lt);
  if (existing) {
    fail(`${context}: duplicate entry — also defined at level ${existing.level}`);
  }
  seenLt.set(word.lt, word);

  if (!word.en.trim()) fail(`${context}: empty English gloss`);
  if (!word.pron.trim()) fail(`${context}: missing pronunciation respelling`);
  if (!word.category.trim()) fail(`${context}: missing category`);

  checkLithuanian(context, word.lt);
  for (const alt of word.alt ?? []) checkLithuanian(`${context} alt form`, alt);
  for (const example of word.examples ?? []) {
    checkLithuanian(`${context} example`, example.lt);
    if (!example.en.trim()) fail(`${context}: example without a translation`);
  }

  if (!word.examples?.length && word.pos !== 'letter') {
    warn(`${context}: no example sentence`);
  }
}

// ── Units and lessons ───────────────────────────────────────────────────────
const unitSlugs = new Set<string>();
const lessonSlugs = new Set<string>();

for (const unit of units) {
  if (unitSlugs.has(unit.slug)) fail(`unit “${unit.slug}”: duplicate slug`);
  unitSlugs.add(unit.slug);

  if (!unit.lessons.length) fail(`unit “${unit.slug}”: has no lessons`);
  if (!/^#[0-9a-f]{6}$/i.test(unit.color)) fail(`unit “${unit.slug}”: colour must be a hex value`);

  for (const lesson of unit.lessons) {
    const context = `lesson “${lesson.slug}”`;

    if (lessonSlugs.has(lesson.slug)) fail(`${context}: duplicate slug`);
    lessonSlugs.add(lesson.slug);

    if (!lesson.words.length) fail(`${context}: introduces no vocabulary`);

    for (const lt of lesson.words) {
      const word = wordsByLt.get(lt);
      if (!word) {
        fail(`${context}: references unknown word “${lt}”`);
        continue;
      }
      if (word.level !== unit.level) {
        warn(`${context}: uses ${word.level} word “${lt}” inside a ${unit.level} unit`);
      }
    }

    for (const drill of lesson.drills ?? []) {
      checkLithuanian(`${context} drill`, drill.lt);
      if (!drill.en.trim()) fail(`${context}: drill “${drill.lt}” has no translation`);
      if (drill.blank && !drill.lt.includes(drill.blank)) {
        fail(`${context}: drill blank “${drill.blank}” does not occur in “${drill.lt}”`);
      }
    }
  }
}

// ── Generated exercises ─────────────────────────────────────────────────────
for (const { lesson } of allLessons()) {
  const exercises = buildLesson(lesson, words);
  const context = `lesson “${lesson.slug}”`;

  if (exercises.length < 4) fail(`${context}: only ${exercises.length} exercises generated`);

  exercises.forEach((exercise, index) => {
    const where = `${context} exercise ${index + 1} (${exercise.type})`;

    if (!exercise.answer.trim()) fail(`${where}: empty answer`);

    if (
      exercise.type === 'select' ||
      exercise.type === 'listen_select' ||
      exercise.type === 'react'
    ) {
      const options = exercise.options ?? [];
      if (options.length < 2) {
        fail(`${where}: needs at least two options, has ${options.length}`);
      }
      if (!options.some((option) => normalize(option) === normalize(exercise.answer))) {
        fail(`${where}: options do not include the answer “${exercise.answer}”`);
      }
      const normalised = options.map(normalize);
      if (new Set(normalised).size !== normalised.length) {
        fail(`${where}: duplicate options — ${options.join(' / ')}`);
      }
    }

    if (exercise.type === 'word_bank') {
      const tiles = [...(exercise.tiles ?? [])];
      for (const token of exercise.answer.split(/\s+/)) {
        const at = tiles.indexOf(token);
        if (at === -1) {
          fail(`${where}: tiles cannot spell the answer — missing “${token}”`);
          break;
        }
        tiles.splice(at, 1);
      }
    }

    if (
      (exercise.type === 'listen_select' ||
        exercise.type === 'listen_type' ||
        exercise.type === 'speak') &&
      !exercise.audioText?.trim()
    ) {
      fail(`${where}: needs audioText for the speech engine`);
    }

    if (exercise.audioText) checkLithuanian(where, exercise.audioText);
  });
}

// ── Achievements & grammar ──────────────────────────────────────────────────
const achievementSlugs = new Set<string>();
for (const achievement of achievements) {
  if (achievementSlugs.has(achievement.slug)) {
    fail(`achievement “${achievement.slug}”: duplicate slug`);
  }
  achievementSlugs.add(achievement.slug);
  if (achievement.threshold <= 0) fail(`achievement “${achievement.slug}”: threshold must be > 0`);
}

const totalLessons = allLessons().length;
const allLessonsAchievement = achievements.find((a) => a.slug === 'all-lessons');
if (allLessonsAchievement && allLessonsAchievement.threshold !== totalLessons) {
  fail(
    `achievement “all-lessons”: threshold is ${allLessonsAchievement.threshold} but the course has ${totalLessons} lessons`,
  );
}

const grammarSlugs = new Set<string>();
for (const page of grammarPages) {
  if (grammarSlugs.has(page.slug)) fail(`grammar page “${page.slug}”: duplicate slug`);
  grammarSlugs.add(page.slug);
  if (page.body.length < 200) warn(`grammar page “${page.slug}”: body looks very short`);
}

// ── Report ──────────────────────────────────────────────────────────────────
const stats = courseStats();

console.log('');
console.log('  Kalba — content check');
console.log('  ─────────────────────');
console.log(`  levels        ${stats.levels}`);
console.log(`  units         ${stats.units}`);
console.log(`  lessons       ${stats.lessons}`);
console.log(`  words         ${stats.words}`);
console.log(`  exercises     ${stats.exercises}`);
console.log(`  grammar pages ${stats.grammarPages}`);
console.log(`  achievements  ${stats.achievements}`);
console.log(`  total XP      ${stats.totalXp}`);
console.log('');
for (const row of stats.byLevel) {
  console.log(
    `  ${row.level}  ${row.nameLt.padEnd(14)} ${String(row.units).padStart(2)} units  ` +
      `${String(row.lessons).padStart(2)} lessons  ${String(row.words).padStart(3)} words`,
  );
}
console.log('');

if (warnings.length) {
  console.log(`  ${warnings.length} warning(s):`);
  for (const message of warnings) console.log(`    ! ${message}`);
  console.log('');
}

if (problems.length) {
  console.error(`  ${problems.length} problem(s):`);
  for (const message of problems) console.error(`    ✗ ${message}`);
  console.error('');
  process.exit(1);
}

console.log('  ✓ content OK');
console.log('');
