import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { notFound } from '../lib/http-error.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { GRADE_BUTTONS, newCard, reviewCard } from '../services/srs.js';
import type { GradeButton } from '../services/srs.js';
import { addDays, utcDay } from '../lib/dates.js';

export const flashcardsRouter = Router();

flashcardsRouter.use(requireAuth);

/** Cards due now, hardest first. */
flashcardsRouter.get(
  '/due',
  asyncHandler(async (req, res) => {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
      .parse(req.query);

    const cards = await prisma.flashcard.findMany({
      where: { userId: userId(req), dueAt: { lte: new Date() } },
      // Lowest ease first: the words that keep catching you out come up first.
      orderBy: [{ ease: 'asc' }, { dueAt: 'asc' }],
      take: limit,
      include: { word: true },
    });

    res.json({
      cards: cards.map((card) => ({
        id: card.id,
        word: card.word,
        ease: card.ease,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        lapses: card.lapses,
        dueAt: card.dueAt,
      })),
    });
  }),
);

/** Deck overview: how many are due today, tomorrow, this week. */
flashcardsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const id = userId(req);
    const now = new Date();

    const [total, dueNow, dueTomorrow, dueWeek, byLevel] = await Promise.all([
      prisma.flashcard.count({ where: { userId: id } }),
      prisma.flashcard.count({ where: { userId: id, dueAt: { lte: now } } }),
      prisma.flashcard.count({
        where: { userId: id, dueAt: { gt: now, lte: addDays(utcDay(now), 2) } },
      }),
      prisma.flashcard.count({
        where: { userId: id, dueAt: { gt: now, lte: addDays(utcDay(now), 8) } },
      }),
      prisma.flashcard.groupBy({
        by: ['wordId'],
        where: { userId: id },
        _count: { _all: true },
      }),
    ]);

    // Mature = surviving a review interval of three weeks or more.
    const mature = await prisma.flashcard.count({
      where: { userId: id, intervalDays: { gte: 21 } },
    });

    res.json({
      total,
      dueNow,
      dueTomorrow,
      dueWithinWeek: dueWeek,
      mature,
      young: total - mature,
      distinctWords: byLevel.length,
    });
  }),
);

/** Grade one card. */
const reviewSchema = z.object({
  grade: z.enum(['again', 'hard', 'good', 'easy']),
});

flashcardsRouter.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const { grade } = reviewSchema.parse(req.body);
    const id = userId(req);

    const card = await prisma.flashcard.findFirst({
      where: { id: req.params.id, userId: id },
    });
    if (!card) throw notFound('No such card in your deck');

    const outcome = reviewCard(card, GRADE_BUTTONS[grade as GradeButton]);

    const updated = await prisma.flashcard.update({
      where: { id: card.id },
      data: {
        ease: outcome.ease,
        intervalDays: outcome.intervalDays,
        repetitions: outcome.repetitions,
        lapses: outcome.lapses,
        dueAt: outcome.dueAt,
        lastReviewedAt: new Date(),
      },
    });

    // Reviews count towards the daily goal too, at 1 XP a card.
    const today = utcDay();
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { xp: { increment: 1 } } }),
      prisma.dailyActivity.upsert({
        where: { userId_day: { userId: id, day: today } },
        create: { userId: id, day: today, xp: 1, exercises: 1 },
        update: { xp: { increment: 1 }, exercises: { increment: 1 } },
      }),
    ]);

    res.json({
      card: {
        id: updated.id,
        ease: updated.ease,
        intervalDays: updated.intervalDays,
        repetitions: updated.repetitions,
        dueAt: updated.dueAt,
      },
      xpEarned: 1,
    });
  }),
);

/** Add a word to the deck by hand (from the dictionary screen). */
flashcardsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { lt } = z.object({ lt: z.string().min(1).max(60) }).parse(req.body);
    const id = userId(req);

    const word = await prisma.word.findUnique({ where: { lt } });
    if (!word) throw notFound(`No word “${lt}” in the course`);

    const fresh = newCard();
    const card = await prisma.flashcard.upsert({
      where: { userId_wordId: { userId: id, wordId: word.id } },
      create: {
        userId: id,
        wordId: word.id,
        ease: fresh.ease,
        intervalDays: fresh.intervalDays,
        dueAt: fresh.dueAt,
      },
      update: {},
      include: { word: true },
    });

    res.status(201).json({ card });
  }),
);

flashcardsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.flashcard.deleteMany({ where: { id: req.params.id, userId: userId(req) } });
    res.status(204).end();
  }),
);
