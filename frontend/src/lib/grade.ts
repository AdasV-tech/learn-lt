/**
 * Client-side answer checking.
 *
 * This exists only so the learner sees "correct" the instant they answer. The
 * server regrades every answer when the lesson is submitted and is the sole
 * authority on XP — this cannot be used to inflate a score.
 *
 * Kept deliberately in sync with `normalize()` in @kalba/content.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,!?;:"“”„‘’'()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}

/** Matches the server's per-type tolerance. */
function threshold(type: string): number {
  if (type === 'speak') return 0.7;
  if (type === 'listen_type' || type === 'write' || type === 'fill_blank') return 0.9;
  return 1;
}

export interface LocalGrade {
  correct: boolean;
  typo: boolean;
  similarity: number;
}

export function gradeLocally(
  type: string,
  answer: string,
  altAnswers: string[] | undefined,
  response: string,
): LocalGrade {
  const given = normalize(response);
  const candidates = [answer, ...(altAnswers ?? [])].map(normalize);

  let best = 0;
  for (const candidate of candidates) {
    if (given === candidate) return { correct: true, typo: false, similarity: 1 };
    best = Math.max(best, similarity(given, candidate));
  }

  const limit = threshold(type);
  const accepted = limit < 1 && best >= limit;
  return { correct: accepted, typo: accepted, similarity: Number(best.toFixed(3)) };
}
