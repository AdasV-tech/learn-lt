import { Router } from 'express';
import { z } from 'zod';
import { LEVELS, LEVEL_META } from '@kalba/content';
import type { Level } from '@kalba/content';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { notFound } from '../lib/http-error.js';
import { optionalAuth } from '../middleware/auth.js';
import { highestMilitaryLevel } from '../services/achievements.js';

export const contentRouter = Router();

const LEVEL_ORDER = new Map(LEVELS.map((level, index) => [level, index]));

/** The whole course tree, annotated with the caller's progress when signed in. */
contentRouter.get(
  '/course',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const units = await prisma.unit.findMany({
      orderBy: [{ order: 'asc' }],
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            emoji: true,
            order: true,
            xp: true,
            grammarTitle: true,
            _count: { select: { words: true } },
          },
        },
      },
    });

    const progressByLesson = new Map<
      string,
      { completions: number; bestAccuracy: number; lastCompleted: Date | null }
    >();
    let unlockedLevel = 1;

    if (req.userId) {
      const rows = await prisma.lessonProgress.findMany({ where: { userId: req.userId } });
      for (const row of rows) {
        progressByLesson.set(row.lessonId, {
          completions: row.completions,
          bestAccuracy: row.bestAccuracy,
          lastCompleted: row.lastCompleted,
        });
      }
      unlockedLevel = await highestMilitaryLevel(req.userId);
    }

    const byLevel = LEVELS.map((level) => {
      const levelUnits = units
        .filter((unit) => unit.level === level)
        .map((unit) => ({
          slug: unit.slug,
          title: unit.title,
          description: unit.description,
          emoji: unit.emoji,
          color: unit.color,
          level: unit.level,
          lessons: unit.lessons.map((lesson) => {
            const progress = progressByLesson.get(lesson.id);
            return {
              slug: lesson.slug,
              title: lesson.title,
              subtitle: lesson.subtitle,
              emoji: lesson.emoji,
              xp: lesson.xp,
              wordCount: lesson._count.words,
              hasGrammar: lesson.grammarTitle !== null,
              completed: (progress?.completions ?? 0) > 0,
              completions: progress?.completions ?? 0,
              bestAccuracy: progress?.bestAccuracy ?? 0,
              lastCompleted: progress?.lastCompleted ?? null,
            };
          }),
        }));

      const lessons = levelUnits.flatMap((unit) => unit.lessons);
      const index = (LEVEL_ORDER.get(level) ?? 0) + 1;

      return {
        ...LEVEL_META[level],
        // Level 1 is always open; each later level opens when the one before it
        // is finished. Signed-out visitors can browse everything.
        unlocked: !req.userId || index <= unlockedLevel,
        lessonCount: lessons.length,
        completedCount: lessons.filter((lesson) => lesson.completed).length,
        units: levelUnits,
      };
    });

    res.json({
      course: {
        slug: 'military-lithuanian',
        title: 'Military Lithuanian',
        description:
          'Lithuanian for soldiers, NATO personnel and anyone deploying to or working with the Lithuanian Armed Forces.',
      },
      levels: byLevel,
    });
  }),
);

/** One lesson, including the exercises the player will run. */
contentRouter.get(
  '/lessons/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const lesson = await prisma.lesson.findUnique({
      where: { slug: req.params.slug },
      include: {
        unit: { select: { slug: true, title: true, emoji: true, color: true, level: true } },
        words: {
          orderBy: { order: 'asc' },
          include: { word: true },
        },
      },
    });
    if (!lesson) throw notFound(`No lesson called “${req.params.slug}”`);

    const progress = req.userId
      ? await prisma.lessonProgress.findUnique({
          where: { userId_lessonId: { userId: req.userId, lessonId: lesson.id } },
        })
      : null;

    res.json({
      lesson: {
        slug: lesson.slug,
        title: lesson.title,
        subtitle: lesson.subtitle,
        emoji: lesson.emoji,
        xp: lesson.xp,
        unit: lesson.unit,
        grammar: lesson.grammarTitle
          ? { title: lesson.grammarTitle, body: lesson.grammarBody }
          : null,
        words: lesson.words.map((link) => link.word),
        exercises: lesson.exercises,
      },
      progress: progress
        ? {
            completions: progress.completions,
            bestAccuracy: progress.bestAccuracy,
            lastAccuracy: progress.lastAccuracy,
            lastCompleted: progress.lastCompleted,
          }
        : null,
    });
  }),
);

/** Vocabulary search — powers the dictionary screen and the deck builder. */
const wordQuery = z.object({
  level: z.enum(['MIL1', 'MIL2', 'MIL3', 'MIL4', 'MIL5', 'MIL6']).optional(),
  category: z.string().max(40).optional(),
  q: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

contentRouter.get(
  '/words',
  asyncHandler(async (req, res) => {
    const { level, category, q, limit } = wordQuery.parse(req.query);

    const words = await prisma.word.findMany({
      where: {
        ...(level ? { level: level as Level } : {}),
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { lt: { contains: q, mode: 'insensitive' } },
                { en: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ level: 'asc' }, { category: 'asc' }, { lt: 'asc' }],
      take: limit,
    });

    res.json({ words, total: words.length });
  }),
);

contentRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.word.groupBy({
      by: ['level', 'category'],
      _count: { _all: true },
      orderBy: [{ level: 'asc' }, { category: 'asc' }],
    });
    res.json({
      categories: rows.map((row) => ({
        level: row.level,
        category: row.category,
        count: row._count._all,
      })),
    });
  }),
);

contentRouter.get(
  '/grammar',
  asyncHandler(async (_req, res) => {
    const pages = await prisma.grammarPage.findMany({
      orderBy: { order: 'asc' },
      select: { slug: true, title: true, level: true, summary: true, order: true },
    });
    res.json({ pages });
  }),
);

contentRouter.get(
  '/grammar/:slug',
  asyncHandler(async (req, res) => {
    const page = await prisma.grammarPage.findUnique({ where: { slug: req.params.slug } });
    if (!page) throw notFound('No such grammar page');
    res.json({ page });
  }),
);

contentRouter.get('/levels', (_req, res) => {
  res.json({ levels: LEVELS.map((level) => LEVEL_META[level]) });
});
