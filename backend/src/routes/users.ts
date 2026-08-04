import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest, unauthorized } from '../lib/http-error.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../lib/tokens.js';
import { serializeUser } from './serializers.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

const profileSchema = z.object({
  displayName: z.string().min(1).max(40).trim().optional(),
  avatarEmoji: z.string().min(1).max(8).optional(),
  dailyGoalXp: z.number().int().min(10).max(500).optional(),
  timezone: z.string().max(60).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  largeText: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  ttsRate: z.number().min(0.5).max(1.5).optional(),
});

usersRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const data = profileSchema.parse(req.body);
    if (Object.keys(data).length === 0) throw badRequest('Nothing to update');

    const user = await prisma.user.update({ where: { id: userId(req) }, data });
    res.json({ user: serializeUser(user) });
  }),
);

usersRouter.post(
  '/me/password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8).max(200),
      })
      .parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });

    // Accounts created through Google have no password yet — let them set one
    // without proving the old value.
    if (user.passwordHash) {
      if (!currentPassword) throw badRequest('Enter your current password');
      const ok = await verifyPassword(user.passwordHash, currentPassword);
      if (!ok) throw unauthorized('Current password is incorrect');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    // Changing a password ends every other session.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.status(204).end();
  }),
);

/** Full data export — it's the learner's data, they can take it. */
usersRouter.get(
  '/me/export',
  asyncHandler(async (req, res) => {
    const id = userId(req);
    const [user, progress, flashcards, achievements, activity] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id } }),
      prisma.lessonProgress.findMany({
        where: { userId: id },
        include: { lesson: { select: { slug: true, title: true } } },
      }),
      prisma.flashcard.findMany({
        where: { userId: id },
        include: { word: { select: { lt: true, en: true } } },
      }),
      prisma.userAchievement.findMany({
        where: { userId: id },
        include: { achievement: { select: { slug: true, title: true } } },
      }),
      prisma.dailyActivity.findMany({ where: { userId: id }, orderBy: { day: 'asc' } }),
    ]);

    res.setHeader('Content-Disposition', 'attachment; filename="kalba-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      user: serializeUser(user),
      progress: progress.map((row) => ({
        lesson: row.lesson.slug,
        title: row.lesson.title,
        completions: row.completions,
        bestAccuracy: row.bestAccuracy,
        xpEarned: row.xpEarned,
      })),
      flashcards: flashcards.map((card) => ({
        lt: card.word.lt,
        en: card.word.en,
        ease: card.ease,
        intervalDays: card.intervalDays,
        dueAt: card.dueAt,
      })),
      achievements: achievements.map((row) => ({
        slug: row.achievement.slug,
        title: row.achievement.title,
        unlockedAt: row.unlockedAt,
      })),
      activity: activity.map((row) => ({ day: row.day.toISOString().slice(0, 10), xp: row.xp })),
    });
  }),
);

usersRouter.delete(
  '/me',
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: userId(req) } });
    res.status(204).end();
  }),
);
