import type { Exercise } from '@kalba/content';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/http-error.js';
import { nextStreak, utcDay } from '../lib/dates.js';
import { levelProgress } from '../lib/levels.js';
import { gradeExercise, xpForAnswer } from './grading.js';
import { nudgeFromLesson } from './srs.js';
import { evaluateAchievements, type UnlockedAchievement } from './achievements.js';

export interface SubmittedAnswer {
  index: number;
  response: string;
  timeMs?: number;
}

export interface AnswerResult {
  index: number;
  type: string;
  correct: boolean;
  typo: boolean;
  expected: string;
  given: string;
  xp: number;
  explanation?: string;
}

export interface LessonSummary {
  lessonSlug: string;
  total: number;
  correct: number;
  accuracy: number;
  perfect: boolean;
  firstCompletion: boolean;
  xp: {
    fromAnswers: number;
    completionBonus: number;
    perfectBonus: number;
    achievements: number;
    total: number;
  };
  results: AnswerResult[];
  streak: number;
  streakIncreased: boolean;
  level: ReturnType<typeof levelProgress>;
  unlockedAchievements: UnlockedAchievement[];
  dailyGoal: { goalXp: number; earnedToday: number; met: boolean };
}

const PERFECT_BONUS = 15;

/**
 * Grade a finished lesson and write every consequence of it: XP, streak, daily
 * activity, per-lesson progress, per-answer attempt log, spaced-repetition
 * scheduling, and any achievements that just became reachable.
 *
 * Grading happens here rather than on the client so XP cannot be forged by
 * editing a request — the client's own checking is only for instant feedback.
 */
export async function submitLesson(
  userId: string,
  lessonSlug: string,
  answers: SubmittedAnswer[],
): Promise<LessonSummary> {
  const lesson = await prisma.lesson.findUnique({
    where: { slug: lessonSlug },
    include: { words: { include: { word: { select: { id: true, lt: true } } } } },
  });
  if (!lesson) throw notFound(`No lesson called “${lessonSlug}”`);

  const exercises = lesson.exercises as unknown as Exercise[];
  const wordIdByLt = new Map(lesson.words.map((link) => [link.word.lt, link.word.id]));

  // ── Grade ────────────────────────────────────────────────────────────────
  const results: AnswerResult[] = [];
  let xpFromAnswers = 0;
  const perWord = new Map<string, boolean>();

  for (const answer of answers) {
    const exercise = exercises[answer.index];
    if (!exercise) continue;

    const graded = gradeExercise(exercise, answer.response ?? '');
    const xp = xpForAnswer(exercise, graded);
    xpFromAnswers += xp;

    if (exercise.wordLt) {
      const previous = perWord.get(exercise.wordLt);
      perWord.set(exercise.wordLt, (previous ?? true) && graded.correct);
    }

    results.push({
      index: answer.index,
      type: exercise.type,
      correct: graded.correct,
      typo: graded.typo,
      expected: graded.expected,
      given: answer.response ?? '',
      xp,
      explanation: exercise.explanation,
    });
  }

  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const perfect = total > 0 && correct === total;

  const now = new Date();
  const today = utcDay(now);

  const summary = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      const existing = await tx.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
      });
      const firstCompletion = !existing || existing.completions === 0;

      const completionBonus = firstCompletion ? lesson.xp : Math.round(lesson.xp / 3);
      const perfectBonus = perfect ? PERFECT_BONUS : 0;
      const lessonXp = xpFromAnswers + completionBonus + perfectBonus;

      // ── Attempt log ──────────────────────────────────────────────────────
      if (results.length > 0) {
        await tx.exerciseAttempt.createMany({
          data: results.map((result) => ({
            userId,
            lessonId: lesson.id,
            exerciseType: result.type,
            correct: result.correct,
            timeMs: answers.find((a) => a.index === result.index)?.timeMs ?? 0,
          })),
        });
      }

      // ── Lesson progress ──────────────────────────────────────────────────
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        create: {
          userId,
          lessonId: lesson.id,
          completions: 1,
          bestAccuracy: accuracy,
          lastAccuracy: accuracy,
          xpEarned: lessonXp,
          perfectRuns: perfect ? 1 : 0,
          firstCompleted: now,
          lastCompleted: now,
        },
        update: {
          completions: { increment: 1 },
          bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, accuracy),
          lastAccuracy: accuracy,
          xpEarned: { increment: lessonXp },
          perfectRuns: { increment: perfect ? 1 : 0 },
          lastCompleted: now,
        },
      });

      // ── Streak & XP ──────────────────────────────────────────────────────
      const streak = nextStreak(user.streak, user.lastActiveOn, today);
      const streakIncreased = streak > user.streak;

      await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: lessonXp },
          streak,
          longestStreak: Math.max(user.longestStreak, streak),
          lastActiveOn: today,
        },
      });

      // ── Daily activity ───────────────────────────────────────────────────
      const activity = await tx.dailyActivity.upsert({
        where: { userId_day: { userId, day: today } },
        create: { userId, day: today, xp: lessonXp, lessons: 1, exercises: total },
        update: {
          xp: { increment: lessonXp },
          lessons: { increment: 1 },
          exercises: { increment: total },
        },
      });

      // ── Spaced repetition ────────────────────────────────────────────────
      for (const [lt, wasCorrect] of perWord) {
        const wordId = wordIdByLt.get(lt);
        if (!wordId) continue;

        const card = await tx.flashcard.findUnique({
          where: { userId_wordId: { userId, wordId } },
        });
        const outcome = nudgeFromLesson(
          card ?? { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 },
          wasCorrect,
          now,
        );

        await tx.flashcard.upsert({
          where: { userId_wordId: { userId, wordId } },
          create: {
            userId,
            wordId,
            ease: outcome.ease,
            intervalDays: outcome.intervalDays,
            repetitions: outcome.repetitions,
            lapses: outcome.lapses,
            dueAt: outcome.dueAt,
            lastReviewedAt: now,
          },
          update: {
            ease: outcome.ease,
            intervalDays: outcome.intervalDays,
            repetitions: outcome.repetitions,
            lapses: outcome.lapses,
            dueAt: outcome.dueAt,
            lastReviewedAt: now,
          },
        });
      }

      // ── Achievements ─────────────────────────────────────────────────────
      const unlockedAchievements = await evaluateAchievements(userId, tx);
      const achievementXp = unlockedAchievements.reduce((sum, a) => sum + a.xpReward, 0);

      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { xp: true, dailyGoalXp: true },
      });

      return {
        firstCompletion,
        completionBonus,
        perfectBonus,
        achievementXp,
        unlockedAchievements,
        streak,
        streakIncreased,
        totalXp: fresh.xp,
        goalXp: fresh.dailyGoalXp,
        earnedToday: activity.xp + achievementXp,
      };
    },
    { timeout: 20_000 },
  );

  return {
    lessonSlug,
    total,
    correct,
    accuracy,
    perfect,
    firstCompletion: summary.firstCompletion,
    xp: {
      fromAnswers: xpFromAnswers,
      completionBonus: summary.completionBonus,
      perfectBonus: summary.perfectBonus,
      achievements: summary.achievementXp,
      total: xpFromAnswers + summary.completionBonus + summary.perfectBonus + summary.achievementXp,
    },
    results,
    streak: summary.streak,
    streakIncreased: summary.streakIncreased,
    level: levelProgress(summary.totalXp),
    unlockedAchievements: summary.unlockedAchievements,
    dailyGoal: {
      goalXp: summary.goalXp,
      earnedToday: summary.earnedToday,
      met: summary.earnedToday >= summary.goalXp,
    },
  };
}
