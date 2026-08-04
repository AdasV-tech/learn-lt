import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma.js';

export interface UnlockedAchievement {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  tier: string;
  xpReward: number;
}

export interface UserMetrics {
  xp: number;
  streak: number;
  lessons: number;
  words: number;
  perfect_lessons: number;
  speaking: number;
  listening: number;
  writing: number;
  level: number;
  accuracy: number;
  /** Total answers, used to gate the accuracy achievement. */
  answers: number;
}

const LISTENING_TYPES = new Set(['listen_select', 'listen_type', 'react']);
const WRITING_TYPES = new Set(['write', 'listen_type', 'fill_blank', 'word_bank']);

/** Gather everything the achievement rules can test against, in one round trip. */
export async function collectMetrics(
  userId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<UserMetrics> {
  const [user, lessonAgg, wordCount, attempts, correctByType, militaryLevel] = await Promise.all([
    client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true, streak: true },
    }),
    client.lessonProgress.aggregate({
      where: { userId, completions: { gt: 0 } },
      _count: { _all: true },
      _sum: { perfectRuns: true },
    }),
    client.flashcard.count({ where: { userId } }),
    client.exerciseAttempt.groupBy({
      by: ['correct'],
      where: { userId },
      _count: { _all: true },
    }),
    client.exerciseAttempt.groupBy({
      by: ['exerciseType'],
      where: { userId, correct: true },
      _count: { _all: true },
    }),
    highestMilitaryLevel(userId, client),
  ]);

  const correct = attempts.find((row) => row.correct)?._count._all ?? 0;
  const wrong = attempts.find((row) => !row.correct)?._count._all ?? 0;
  const total = correct + wrong;

  const countFor = (predicate: (type: string) => boolean) =>
    correctByType
      .filter((row) => predicate(row.exerciseType))
      .reduce((sum, row) => sum + row._count._all, 0);

  return {
    xp: user.xp,
    streak: user.streak,
    lessons: lessonAgg._count._all,
    words: wordCount,
    perfect_lessons: lessonAgg._sum.perfectRuns ?? 0,
    speaking: countFor((type) => type === 'speak'),
    listening: countFor((type) => LISTENING_TYPES.has(type)),
    writing: countFor((type) => WRITING_TYPES.has(type)),
    level: militaryLevel,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    answers: total,
  };
}

/**
 * The highest military level the learner has unlocked: level N opens once every
 * lesson in level N-1 has been completed at least once.
 */
export async function highestMilitaryLevel(
  userId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<number> {
  const units = await client.unit.findMany({
    select: { level: true, lessons: { select: { id: true } } },
  });
  const completed = await client.lessonProgress.findMany({
    where: { userId, completions: { gt: 0 } },
    select: { lessonId: true },
  });
  const done = new Set(completed.map((row) => row.lessonId));

  const perLevel = new Map<string, { total: number; done: number }>();
  for (const unit of units) {
    const entry = perLevel.get(unit.level) ?? { total: 0, done: 0 };
    for (const lesson of unit.lessons) {
      entry.total += 1;
      if (done.has(lesson.id)) entry.done += 1;
    }
    perLevel.set(unit.level, entry);
  }

  let unlocked = 1;
  for (let index = 1; index <= 5; index++) {
    const stats = perLevel.get(`MIL${index}`);
    if (stats && stats.total > 0 && stats.done === stats.total) unlocked = index + 1;
    else break;
  }
  return unlocked;
}

/**
 * Unlock anything the learner now qualifies for and pay out the bonus XP.
 *
 * Returns the newly unlocked achievements so the client can show a card for
 * each one at the end of the lesson.
 */
export async function evaluateAchievements(
  userId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<UnlockedAchievement[]> {
  const [metrics, definitions, already] = await Promise.all([
    collectMetrics(userId, client),
    client.achievement.findMany(),
    client.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);

  const owned = new Set(already.map((row) => row.achievementId));
  const unlocked: UnlockedAchievement[] = [];
  let bonusXp = 0;

  for (const definition of definitions) {
    if (owned.has(definition.id)) continue;

    const metric = definition.metric as keyof UserMetrics;
    const value = metrics[metric];
    if (typeof value !== 'number') continue;

    // Accuracy is meaningless on a handful of answers.
    if (metric === 'accuracy' && metrics.answers < 200) continue;
    if (value < definition.threshold) continue;

    await client.userAchievement.create({
      data: { userId, achievementId: definition.id },
    });
    bonusXp += definition.xpReward;
    unlocked.push({
      slug: definition.slug,
      title: definition.title,
      description: definition.description,
      emoji: definition.emoji,
      tier: definition.tier,
      xpReward: definition.xpReward,
    });
  }

  if (bonusXp > 0) {
    await client.user.update({ where: { id: userId }, data: { xp: { increment: bonusXp } } });
  }

  return unlocked;
}
