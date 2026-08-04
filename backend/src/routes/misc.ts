import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { asyncHandler } from '../lib/async-handler.js';
import { optionalAuth, requireAuth, userId } from '../middleware/auth.js';
import { collectMetrics } from '../services/achievements.js';
import { levelProgress, levelTable } from '../lib/levels.js';
import { currentStreak } from '../lib/dates.js';
import { lookup, tutor, tutorSuggestions } from '../services/ai.js';

// ─────────────────────────────────────────────────────────────────────────────
// Achievements
// ─────────────────────────────────────────────────────────────────────────────
export const achievementsRouter = Router();

achievementsRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const definitions = await prisma.achievement.findMany({
      orderBy: [{ tier: 'asc' }, { threshold: 'asc' }],
    });

    if (!req.userId) {
      return res.json({
        achievements: definitions.map((a) => ({
          slug: a.slug,
          title: a.title,
          description: a.description,
          emoji: a.emoji,
          tier: a.tier,
          xpReward: a.xpReward,
          metric: a.metric,
          threshold: a.threshold,
          unlocked: false,
          progress: 0,
        })),
      });
    }

    const [unlocked, metrics] = await Promise.all([
      prisma.userAchievement.findMany({ where: { userId: req.userId } }),
      collectMetrics(req.userId),
    ]);
    const unlockedAt = new Map(unlocked.map((row) => [row.achievementId, row.unlockedAt]));

    res.json({
      achievements: definitions.map((a) => {
        const value = (metrics as unknown as Record<string, number>)[a.metric] ?? 0;
        return {
          slug: a.slug,
          title: a.title,
          description: a.description,
          emoji: a.emoji,
          tier: a.tier,
          xpReward: a.xpReward,
          metric: a.metric,
          threshold: a.threshold,
          value,
          progress: Math.min(1, a.threshold > 0 ? value / a.threshold : 0),
          unlocked: unlockedAt.has(a.id),
          unlockedAt: unlockedAt.get(a.id) ?? null,
        };
      }),
    });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard — opt-in by nature: only display name, avatar, XP and streak.
// ─────────────────────────────────────────────────────────────────────────────
export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(req.query);

    const top = await prisma.user.findMany({
      orderBy: { xp: 'desc' },
      take: limit,
      select: {
        id: true,
        displayName: true,
        avatarEmoji: true,
        xp: true,
        streak: true,
        lastActiveOn: true,
      },
    });

    const rows = top.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      displayName: user.displayName,
      avatarEmoji: user.avatarEmoji,
      xp: user.xp,
      level: levelProgress(user.xp).level,
      streak: currentStreak(user.streak, user.lastActiveOn),
      isYou: user.id === req.userId,
    }));

    // If the caller is not in the visible slice, append their own row so they
    // can always see where they stand.
    let you = rows.find((row) => row.isYou) ?? null;
    if (!you && req.userId) {
      const self = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          displayName: true,
          avatarEmoji: true,
          xp: true,
          streak: true,
          lastActiveOn: true,
        },
      });
      if (self) {
        const ahead = await prisma.user.count({ where: { xp: { gt: self.xp } } });
        you = {
          rank: ahead + 1,
          id: self.id,
          displayName: self.displayName,
          avatarEmoji: self.avatarEmoji,
          xp: self.xp,
          level: levelProgress(self.xp).level,
          streak: currentStreak(self.streak, self.lastActiveOn),
          isYou: true,
        };
      }
    }

    res.json({ leaderboard: rows, you });
  }),
);

leaderboardRouter.get('/levels', (_req, res) => {
  res.json({ table: levelTable(25) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Kalba AI
// ─────────────────────────────────────────────────────────────────────────────
export const aiRouter = Router();

const tutorSchema = z.object({
  mode: z.enum(['explain', 'correct', 'converse', 'roleplay', 'drill']).default('explain'),
  message: z.string().min(1).max(2000),
  context: z.string().max(200).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

aiRouter.get('/status', (_req, res) => {
  res.json({
    enabled: env.aiEnabled,
    model: env.aiEnabled ? env.ANTHROPIC_MODEL : null,
    suggestions: tutorSuggestions(),
  });
});

aiRouter.post(
  '/tutor',
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = tutorSchema.parse(req.body);
    // The user id is not sent to the model — it only scopes the rate limit.
    void userId(req);
    const response = await tutor(request);
    res.json(response);
  }),
);

aiRouter.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    const { term } = z.object({ term: z.string().min(1).max(60) }).parse(req.query);
    const word = lookup(term);
    res.json({ word: word ?? null });
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────
export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    let database = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      ai: env.aiEnabled ? 'configured' : 'offline-coach',
      google: env.googleEnabled ? 'configured' : 'disabled',
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '1.0.0',
    });
  }),
);
