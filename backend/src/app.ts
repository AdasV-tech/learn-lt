import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { contentRouter } from './routes/content.js';
import { progressRouter } from './routes/progress.js';
import { flashcardsRouter } from './routes/flashcards.js';
import { achievementsRouter, aiRouter, healthRouter, leaderboardRouter } from './routes/misc.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind a proxy (Fly, Render, Railway) so rate limiting sees the real IP.
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin requests, curl and native apps send no Origin header.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '256kb' }));
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // A generous global ceiling; the auth routes add a much tighter one.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.isTest ? 100_000 : 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/content', contentRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/flashcards', flashcardsRouter);
  app.use('/api/achievements', achievementsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/ai', aiRouter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'Kalba API',
      description: 'Free, open-source Military Lithuanian. No paywalls, no ads, forever.',
      docs: 'https://github.com/AdasV-tech/kalba/blob/main/docs/API.md',
      health: '/api/health',
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
