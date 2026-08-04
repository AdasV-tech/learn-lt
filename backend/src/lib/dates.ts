const DAY_MS = 86_400_000;

/** Midnight UTC on the day the given instant falls in. */
export function utcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDay(to).getTime() - utcDay(from).getTime()) / DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Roll a streak forward for a day of activity.
 *
 * Same day → unchanged. The next day → +1. Any longer gap → back to 1.
 */
export function nextStreak(current: number, lastActiveOn: Date | null, today: Date): number {
  if (!lastActiveOn) return 1;
  const gap = daysBetween(lastActiveOn, today);
  if (gap <= 0) return Math.max(current, 1);
  if (gap === 1) return current + 1;
  return 1;
}

/** A streak that has not been fed today or yesterday is already dead. */
export function currentStreak(
  stored: number,
  lastActiveOn: Date | null,
  today = new Date(),
): number {
  if (!lastActiveOn) return 0;
  return daysBetween(lastActiveOn, today) <= 1 ? stored : 0;
}
