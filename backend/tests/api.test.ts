import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import type { Exercise } from '@kalba/content';

/**
 * API tests run against a real Postgres — the same one `npm run db:up` starts.
 * They create their own throwaway accounts and delete them afterwards, so they
 * never touch seeded content or anyone else's progress.
 */

let app: Express;
const createdEmails: string[] = [];

function uniqueEmail(prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.kalba`;
  createdEmails.push(email);
  return email;
}

async function signUp(prefix = 'user') {
  const email = uniqueEmail(prefix);
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Passw0rd!', displayName: 'Testas' });

  expect(response.status).toBe(201);
  return {
    email,
    token: response.body.accessToken as string,
    refreshToken: response.body.refreshToken as string,
    userId: response.body.user.id as string,
  };
}

beforeAll(async () => {
  app = createApp();
  const lessons = await prisma.lesson.count();
  if (lessons === 0) {
    throw new Error('Database is not seeded — run `npm run db:seed` before the API tests.');
  }
});

afterAll(async () => {
  if (createdEmails.length) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  await prisma.$disconnect();
});

describe('health', () => {
  it('reports the database as up', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
  });

  it('404s an unknown route with a structured error', async () => {
    const response = await request(app).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });
});

describe('auth', () => {
  it('registers, then signs in with the same credentials', async () => {
    const { email } = await signUp('login');

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Passw0rd!' });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
    expect(response.body.accessToken).toBeTruthy();
  });

  it('never returns the password hash', async () => {
    const { token } = await signUp('leak');
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(response.body.user.hasPassword).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const { email } = await signUp('dupe');
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Passw0rd!' });

    expect(response.status).toBe(409);
  });

  it('rejects a weak password with a field-level message', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_failed');
    expect(response.body.error.details[0].field).toBe('password');
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const { email } = await signUp('enum');

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'NotThePassword1!' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.kalba', password: 'NotThePassword1!' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });

  it('rotates the refresh token and revokes the old one', async () => {
    const { refreshToken } = await signUp('rotate');

    const first = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    // Replaying the consumed token must fail.
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('refuses protected routes without a token', async () => {
    expect((await request(app).get('/api/progress/summary')).status).toBe(401);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });
});

describe('content', () => {
  it('serves the whole course tree', async () => {
    const response = await request(app).get('/api/content/course');
    expect(response.status).toBe(200);
    expect(response.body.levels).toHaveLength(6);
    expect(response.body.levels[0].units.length).toBeGreaterThan(0);
  });

  it('locks later levels for a brand-new learner but leaves the first open', async () => {
    const { token } = await signUp('locks');
    const response = await request(app)
      .get('/api/content/course')
      .set('Authorization', `Bearer ${token}`);

    expect(response.body.levels[0].unlocked).toBe(true);
    expect(response.body.levels[1].unlocked).toBe(false);
  });

  it('serves a lesson with its exercises and words', async () => {
    const response = await request(app).get('/api/content/lessons/garsai');
    expect(response.status).toBe(200);
    expect(response.body.lesson.words.length).toBeGreaterThan(0);
    expect(response.body.lesson.exercises.length).toBeGreaterThan(4);
  });

  it('404s an unknown lesson', async () => {
    expect((await request(app).get('/api/content/lessons/nonexistent')).status).toBe(404);
  });

  it('searches vocabulary in both directions', async () => {
    const lithuanian = await request(app).get('/api/content/words?q=gulk');
    expect(lithuanian.body.words.some((word: { lt: string }) => word.lt === 'Gulk!')).toBe(true);

    const english = await request(app).get('/api/content/words?q=map');
    expect(english.body.words.some((word: { lt: string }) => word.lt === 'žemėlapis')).toBe(true);
  });

  it('serves the grammar reference', async () => {
    const index = await request(app).get('/api/content/grammar');
    expect(index.body.pages.length).toBeGreaterThan(4);

    const page = await request(app).get('/api/content/grammar/liepiamoji-nuosaka');
    expect(page.status).toBe(200);
    expect(page.body.page.body).toContain('imperative');
  });
});

describe('finishing a lesson', () => {
  it('awards XP, starts a streak and unlocks the first achievement', async () => {
    const { token } = await signUp('submit');

    const lesson = await request(app).get('/api/content/lessons/garsai');
    const exercises = lesson.body.lesson.exercises as Exercise[];
    const answers = exercises.map((exercise, index) => ({
      index,
      response: exercise.answer,
      timeMs: 1200,
    }));

    const response = await request(app)
      .post('/api/progress/lessons/garsai/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ answers });

    expect(response.status).toBe(200);
    expect(response.body.correct).toBe(answers.length);
    expect(response.body.accuracy).toBe(100);
    expect(response.body.perfect).toBe(true);
    expect(response.body.xp.total).toBeGreaterThan(0);
    expect(response.body.xp.perfectBonus).toBeGreaterThan(0);
    expect(response.body.streak).toBe(1);
    expect(response.body.unlockedAchievements.map((a: { slug: string }) => a.slug)).toContain(
      'first-lesson',
    );
  });

  it('does not award the perfect bonus when answers are wrong', async () => {
    const { token } = await signUp('imperfect');

    const lesson = await request(app).get('/api/content/lessons/garsai');
    const exercises = lesson.body.lesson.exercises as Exercise[];
    const answers = exercises.map((_, index) => ({ index, response: 'zzzz-not-an-answer' }));

    const response = await request(app)
      .post('/api/progress/lessons/garsai/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ answers });

    expect(response.status).toBe(200);
    expect(response.body.correct).toBe(0);
    expect(response.body.perfect).toBe(false);
    expect(response.body.xp.perfectBonus).toBe(0);
    expect(response.body.xp.fromAnswers).toBe(0);
  });

  it('grades on the server — a forged answer earns nothing', async () => {
    const { token } = await signUp('forge');

    // Claim a perfect score without sending the real answers.
    const response = await request(app)
      .post('/api/progress/lessons/garsai/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [{ index: 0, response: 'definitely wrong' }] });

    expect(response.status).toBe(200);
    expect(response.body.correct).toBe(0);
    expect(response.body.xp.fromAnswers).toBe(0);
  });

  it('seeds the review deck with the words met in the lesson', async () => {
    const { token, userId } = await signUp('deck');

    const lesson = await request(app).get('/api/content/lessons/kreipinys');
    const exercises = lesson.body.lesson.exercises as Exercise[];

    await request(app)
      .post('/api/progress/lessons/kreipinys/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: exercises.map((exercise, index) => ({ index, response: exercise.answer })),
      });

    const cards = await prisma.flashcard.count({ where: { userId } });
    expect(cards).toBeGreaterThan(0);

    const stats = await request(app)
      .get('/api/flashcards/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(stats.body.total).toBe(cards);
  });

  it('rejects a submission with no answers', async () => {
    const { token } = await signUp('empty');
    const response = await request(app)
      .post('/api/progress/lessons/garsai/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ answers: [] });

    expect(response.status).toBe(400);
  });
});

describe('progress summary', () => {
  it('reports lesson, accuracy and streak figures', async () => {
    const { token } = await signUp('summary');

    const lesson = await request(app).get('/api/content/lessons/garsai');
    const exercises = lesson.body.lesson.exercises as Exercise[];
    await request(app)
      .post('/api/progress/lessons/garsai/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        answers: exercises.map((exercise, index) => ({ index, response: exercise.answer })),
      });

    const response = await request(app)
      .get('/api/progress/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.lessons.completed).toBe(1);
    expect(response.body.accuracy.percent).toBe(100);
    expect(response.body.streak.current).toBe(1);
    expect(response.body.calendar.length).toBeGreaterThan(0);
  });

  it('points a new learner at the first lesson', async () => {
    const { token } = await signUp('next');
    const response = await request(app)
      .get('/api/progress/next')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.next.slug).toBe('garsai');
    expect(response.body.completed).toBe(0);
  });
});

describe('review deck', () => {
  it('adds a word by hand and schedules it after review', async () => {
    const { token } = await signUp('review');

    const added = await request(app)
      .post('/api/flashcards')
      .set('Authorization', `Bearer ${token}`)
      .send({ lt: 'žemėlapis' });
    expect(added.status).toBe(201);

    const due = await request(app)
      .get('/api/flashcards/due')
      .set('Authorization', `Bearer ${token}`);
    expect(due.body.cards.length).toBe(1);

    const cardId = due.body.cards[0].id as string;
    const reviewed = await request(app)
      .post(`/api/flashcards/${cardId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ grade: 'good' });

    expect(reviewed.status).toBe(200);
    expect(reviewed.body.card.intervalDays).toBe(1);
    expect(new Date(reviewed.body.card.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('404s when adding a word that is not in the course', async () => {
    const { token } = await signUp('nocard');
    const response = await request(app)
      .post('/api/flashcards')
      .set('Authorization', `Bearer ${token}`)
      .send({ lt: 'nesamone-zodis' });

    expect(response.status).toBe(404);
  });

  it("won't let one learner grade another's card", async () => {
    const owner = await signUp('owner');
    const stranger = await signUp('stranger');

    await request(app)
      .post('/api/flashcards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ lt: 'kompasas' });

    const due = await request(app)
      .get('/api/flashcards/due')
      .set('Authorization', `Bearer ${owner.token}`);
    const cardId = due.body.cards[0].id as string;

    const response = await request(app)
      .post(`/api/flashcards/${cardId}/review`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ grade: 'good' });

    expect(response.status).toBe(404);
  });
});

describe('achievements and leaderboard', () => {
  it('lists every achievement with progress for the caller', async () => {
    const { token } = await signUp('achieve');
    const response = await request(app)
      .get('/api/achievements')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.achievements.length).toBeGreaterThan(15);
    expect(response.body.achievements[0]).toHaveProperty('progress');
  });

  it('shows the caller their own rank', async () => {
    const { token, userId } = await signUp('rank');
    const response = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.you?.id).toBe(userId);
    expect(response.body.you?.isYou).toBe(true);
  });

  it('exposes nothing but display name, avatar, XP and streak', async () => {
    const { token } = await signUp('privacy');
    const response = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', `Bearer ${token}`);

    expect(JSON.stringify(response.body)).not.toContain('@test.kalba');
  });
});

describe('account management', () => {
  it('updates the profile and persists accessibility preferences', async () => {
    const { token } = await signUp('profile');

    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Vilkas', dailyGoalXp: 100, largeText: true, theme: 'light' });

    expect(response.status).toBe(200);
    expect(response.body.user.displayName).toBe('Vilkas');
    expect(response.body.user.dailyGoalXp).toBe(100);
    expect(response.body.user.settings.largeText).toBe(true);
    expect(response.body.user.settings.theme).toBe('light');
  });

  it('rejects a daily goal outside the allowed range', async () => {
    const { token } = await signUp('goal');
    const response = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ dailyGoalXp: 99999 });

    expect(response.status).toBe(400);
  });

  it('exports everything the learner has produced', async () => {
    const { token, email } = await signUp('export');
    const response = await request(app)
      .get('/api/users/me/export')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
    expect(response.body).toHaveProperty('progress');
    expect(response.body).toHaveProperty('flashcards');
    expect(response.body).toHaveProperty('activity');
  });

  it('deletes the account and everything attached to it', async () => {
    const { token, userId } = await signUp('delete');

    await request(app)
      .post('/api/flashcards')
      .set('Authorization', `Bearer ${token}`)
      .send({ lt: 'kompasas' });

    const response = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(204);

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.flashcard.count({ where: { userId } })).toBe(0);
  });
});

describe('kalba ai', () => {
  it('reports its status and suggestion chips without a key', async () => {
    const response = await request(app).get('/api/ai/status');
    expect(response.status).toBe(200);
    expect(response.body.suggestions.length).toBeGreaterThan(0);
  });

  it('answers from the course data when no API key is configured', async () => {
    const { token } = await signUp('tutor');
    const response = await request(app)
      .post('/api/ai/tutor')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'explain', message: 'What does Gulk mean?' });

    expect(response.status).toBe(200);
    expect(response.body.reply.length).toBeGreaterThan(10);
    // Without a key the offline coach answers — and it still finds the word.
    if (response.body.source === 'local') {
      expect(response.body.reply).toContain('Gulk');
    }
  });

  it('requires a signed-in user', async () => {
    const response = await request(app).post('/api/ai/tutor').send({ message: 'hello' });
    expect(response.status).toBe(401);
  });
});
