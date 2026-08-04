/**
 * Seed the database from @kalba/content.
 *
 *   npm run db:seed
 *
 * The content tables are owned by this script — they are cleared and rebuilt on
 * every run, so the curriculum always matches what is in version control. User
 * data is never touched, except that the demo account is refreshed.
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { achievements, buildLesson, courseStats, grammarPages, units, words } from '@kalba/content';
import type { AchievementTier, Level } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@kalba.app';
const DEMO_PASSWORD = 'Demo1234!';

async function main() {
  const started = Date.now();
  console.info('\n  Kalba — seeding\n  ───────────────');

  // ── Content is rebuilt from scratch ───────────────────────────────────────
  // LessonWord and Lesson cascade from Unit; delete leaf tables first anyway so
  // the script works regardless of the database's FK enforcement order.
  await prisma.lessonWord.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.grammarPage.deleteMany();
  // Flashcards reference words, so orphan them rather than deleting user data.
  await prisma.flashcard.deleteMany();
  await prisma.word.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();

  // ── Vocabulary ───────────────────────────────────────────────────────────
  await prisma.word.createMany({
    data: words.map((word) => ({
      lt: word.lt,
      en: word.en,
      pron: word.pron,
      pos: word.pos,
      level: word.level as Level,
      category: word.category,
      gender: word.gender ?? null,
      emoji: word.emoji ?? null,
      grammar: word.grammar ?? null,
      usage: word.usage ?? null,
      examples: word.examples ?? [],
      tags: word.tags ?? [],
      alt: word.alt ?? [],
    })),
  });
  const wordRows = await prisma.word.findMany({ select: { id: true, lt: true } });
  const wordIdByLt = new Map(wordRows.map((row) => [row.lt, row.id]));
  console.info(`  ✓ ${wordRows.length} words`);

  // ── Units, lessons and their generated exercises ─────────────────────────
  let lessonCount = 0;
  let exerciseCount = 0;

  for (const [unitIndex, unit] of units.entries()) {
    const created = await prisma.unit.create({
      data: {
        slug: unit.slug,
        title: unit.title,
        description: unit.description,
        emoji: unit.emoji,
        level: unit.level as Level,
        color: unit.color,
        order: unitIndex,
      },
    });

    for (const [lessonIndex, lesson] of unit.lessons.entries()) {
      const exercises = buildLesson(lesson, words);
      exerciseCount += exercises.length;

      const createdLesson = await prisma.lesson.create({
        data: {
          slug: lesson.slug,
          unitId: created.id,
          title: lesson.title,
          subtitle: lesson.subtitle,
          emoji: lesson.emoji,
          order: lessonIndex,
          xp: lesson.xp ?? 10,
          grammarTitle: lesson.grammar?.title ?? null,
          grammarBody: lesson.grammar?.body ?? null,
          exercises: exercises as unknown as object,
        },
      });
      lessonCount += 1;

      const links = lesson.words
        .map((lt, order) => {
          const wordId = wordIdByLt.get(lt);
          return wordId ? { lessonId: createdLesson.id, wordId, order } : null;
        })
        .filter(
          (link): link is { lessonId: string; wordId: string; order: number } => link !== null,
        );

      if (links.length) await prisma.lessonWord.createMany({ data: links });
    }
  }
  console.info(`  ✓ ${units.length} units, ${lessonCount} lessons, ${exerciseCount} exercises`);

  // ── Grammar reference ────────────────────────────────────────────────────
  await prisma.grammarPage.createMany({
    data: grammarPages.map((page) => ({
      slug: page.slug,
      title: page.title,
      level: page.level as Level,
      summary: page.summary,
      body: page.body,
      order: page.order,
    })),
  });
  console.info(`  ✓ ${grammarPages.length} grammar pages`);

  // ── Achievements ─────────────────────────────────────────────────────────
  await prisma.achievement.createMany({
    data: achievements.map((achievement) => ({
      slug: achievement.slug,
      title: achievement.title,
      description: achievement.description,
      emoji: achievement.emoji,
      metric: achievement.metric,
      threshold: achievement.threshold,
      xpReward: achievement.xpReward,
      tier: achievement.tier as AchievementTier,
    })),
  });
  console.info(`  ✓ ${achievements.length} achievements`);

  // ── Demo account ─────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      passwordHash: await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id }),
      displayName: 'Demo',
      avatarEmoji: '🪖',
      dailyGoalXp: 50,
    },
    update: {
      passwordHash: await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id }),
    },
  });
  console.info(`  ✓ demo account  ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  const stats = courseStats();
  console.info(
    `\n  ${stats.levels} levels · ${stats.units} units · ${stats.lessons} lessons · ` +
      `${stats.words} words · ${stats.exercises} exercises · ${stats.totalXp} XP available`,
  );
  console.info(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}

main()
  .catch((error) => {
    console.error('\n  Seeding failed:\n', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
