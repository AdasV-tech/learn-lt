/**
 * XP levels.
 *
 * Level 1 starts at 0 XP, level 2 at 100, level 3 at 250, and each subsequent
 * level costs 50 XP more than the one before — so progress stays quick early on
 * and keeps meaning something later.
 *
 *   xpForLevel(L) = (L - 1) × (25L + 50)
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (25 * level + 50);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  const into = xp - currentLevelXp;
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel: into,
    xpForNextLevel: span,
    progress: span > 0 ? Math.min(1, into / span) : 1,
  };
}

/** A short table for the profile screen. */
export function levelTable(upTo = 20): { level: number; xp: number }[] {
  return Array.from({ length: upTo }, (_, i) => ({ level: i + 1, xp: xpForLevel(i + 1) }));
}
