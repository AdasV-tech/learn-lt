import type { User } from '@prisma/client';
import { LEVEL_META } from '@kalba/content';
import type { Level } from '@kalba/content';
import { levelProgress } from '../lib/levels.js';
import { currentStreak } from '../lib/dates.js';

/**
 * The public shape of a user. Never leaks passwordHash, googleId or tokens.
 */
export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarEmoji: user.avatarEmoji,
    xp: user.xp,
    level: levelProgress(user.xp),
    streak: currentStreak(user.streak, user.lastActiveOn),
    longestStreak: user.longestStreak,
    lastActiveOn: user.lastActiveOn,
    dailyGoalXp: user.dailyGoalXp,
    settings: {
      theme: user.theme,
      largeText: user.largeText,
      reducedMotion: user.reducedMotion,
      ttsRate: user.ttsRate,
      timezone: user.timezone,
    },
    createdAt: user.createdAt,
    hasPassword: user.passwordHash !== null,
    hasGoogle: user.googleId !== null,
  };
}

export function serializeLevel(level: Level) {
  return LEVEL_META[level];
}
