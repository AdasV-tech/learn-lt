import { Router } from 'express';
import { z } from 'zod';
import { LEVELS, LEVEL_META } from '@kalba/content';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { submitLesson } from '../services/progress.js';
import { collectMetrics, highestMilitaryLevel } from '../services/achievements.js';
import { levelProgress } from '../lib/levels.js';
import { addDays, currentStreak, utcDay } from '../lib/dates.js';

export const progressRouter = Router();

progressRouter.use(requireAuth);

const submission = z.object({
  answers: z
    .array(
      z.object({
        index: z.number().int().min(0).max(500),
        response: z.string().max(500),
        timeMs: z.number().int().min(0).max(600_000).optional(),
      }),
    )
    .min(1)
    .max(500),
});

/** Finish a lesson: grade it, award XP, roll the streak, schedule reviews. */
progressRouter.post(
  '/lessons/:slug/submit',
  asyncHandler(async (req, res) => {
    const { answers } = submission.parse(req.body);
    const slug = z.string().min(1).parse(req.params.slug);
    const summary = await submitLesson(userId(req), slug, answers);
    res.json(summary);
  }),
);

/** Everything the profile screen needs, in one request. */
progressRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const id = userId(req);

    const [user, metrics, militaryLevel, lessonTotal, activity, perType] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id } }),
      collectMetrics(id),
      highestMilitaryLevel(id),
      prisma.lesson.count(),
      prisma.dailyActivity.findMany({
        where: { userId: id, day: { gte: utcDay(addDays(new Date(), -364)) } },
        orderBy: { day: 'asc' },
      }),
      prisma.exerciseAttempt.groupBy({
        by: ['exerciseType', 'correct'],
        where: { userId: id },
        _count: { _all: true },
      }),
    ]);

    const today = utcDay();
    const todayRow = activity.find((row) => row.day.getTime() === today.getTime());

    const skills = new Map<string, { correct: number; total: number }>();
    for (const row of perType) {
      const entry = skills.get(row.exerciseType) ?? { correct: 0, total: 0 };
      entry.total += row._count._all;
      if (row.correct) entry.correct += row._count._all;
      skills.set(row.exerciseType, entry);
    }

    res.json({
      xp: user.xp,
      level: levelProgress(user.xp),
      militaryLevel: LEVEL_META[LEVELS[Math.min(militaryLevel, LEVELS.length) - 1] ?? 'MIL1'],
      streak: {
        current: currentStreak(user.streak, user.lastActiveOn),
        longest: user.longestStreak,
        lastActiveOn: user.lastActiveOn,
      },
      dailyGoal: {
        goalXp: user.dailyGoalXp,
        earnedToday: todayRow?.xp ?? 0,
        met: (todayRow?.xp ?? 0) >= user.dailyGoalXp,
      },
      lessons: { completed: metrics.lessons, total: lessonTotal, perfect: metrics.perfect_lessons },
      words: { learned: metrics.words },
      accuracy: { percent: metrics.accuracy, answers: metrics.answers },
      skills: [...skills.entries()].map(([type, value]) => ({
        type,
        correct: value.correct,
        total: value.total,
        accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0,
      })),
      calendar: activity.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        xp: row.xp,
        lessons: row.lessons,
        exercises: row.exercises,
      })),
    });
  }),
);

/** Per-lesson progress, used to redraw the path without refetching the course. */
progressRouter.get(
  '/lessons',
  asyncHandler(async (req, res) => {
    const rows = await prisma.lessonProgress.findMany({
      where: { userId: userId(req) },
      include: { lesson: { select: { slug: true } } },
    });
    res.json({
      lessons: rows.map((row) => ({
        slug: row.lesson.slug,
        completions: row.completions,
        bestAccuracy: row.bestAccuracy,
        lastAccuracy: row.lastAccuracy,
        xpEarned: row.xpEarned,
        perfectRuns: row.perfectRuns,
        lastCompleted: row.lastCompleted,
      })),
    });
  }),
);

/** Where to pick up: the first unfinished lesson in level order. */
progressRouter.get(
  '/next',
  asyncHandler(async (req, res) => {
    const id = userId(req);
    const [lessons, done] = await Promise.all([
      prisma.lesson.findMany({
        orderBy: [{ unit: { order: 'asc' } }, { order: 'asc' }],
        include: {
          unit: { select: { slug: true, title: true, emoji: true, color: true, level: true } },
        },
      }),
      prisma.lessonProgress.findMany({
        where: { userId: id, completions: { gt: 0 } },
        select: { lessonId: true },
      }),
    ]);

    const completed = new Set(done.map((row) => row.lessonId));
    const next = lessons.find((lesson) => !completed.has(lesson.id)) ?? lessons[0];

    res.json({
      next: next
        ? {
            slug: next.slug,
            title: next.title,
            subtitle: next.subtitle,
            emoji: next.emoji,
            xp: next.xp,
            unit: next.unit,
            isReview: completed.size === lessons.length,
          }
        : null,
      completed: completed.size,
      total: lessons.length,
    });
  }),
);
