import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest, conflict, unauthorized } from '../lib/http-error.js';
import {
  createRefreshToken,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
} from '../lib/tokens.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { serializeUser } from './serializers.js';

export const authRouter = Router();

/** Brute-force protection on the credential endpoints. */
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.isTest ? 10_000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts — try again later' } },
});

const AVATARS = ['🪖', '🎖️', '🧭', '📡', '⭐', '🛡️', '🦺', '🥾'];

const credentials = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
});

const registerSchema = credentials.extend({
  displayName: z.string().min(1).max(40).trim().optional(),
});

async function issueSession(user: { id: string; email: string }) {
  const { token, hash, expiresAt } = createRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });
  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email }),
    refreshToken: token,
    expiresAt,
  };
}

// ── Register ────────────────────────────────────────────────────────────────
authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict('An account with that email already exists');

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        displayName: displayName || (email.split('@')[0] ?? 'Karys'),
        avatarEmoji: AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? '🪖',
      },
    });

    const session = await issueSession(user);
    res.status(201).json({ user: serializeUser(user), ...session });
  }),
);

// ── Login ───────────────────────────────────────────────────────────────────
authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = credentials.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Same message either way so the endpoint cannot be used to enumerate accounts.
    if (!user?.passwordHash) throw unauthorized('Email or password is incorrect');

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) throw unauthorized('Email or password is incorrect');

    const session = await issueSession(user);
    res.json({ user: serializeUser(user), ...session });
  }),
);

// ── Google sign-in ──────────────────────────────────────────────────────────
authRouter.post(
  '/google',
  authLimiter,
  asyncHandler(async (req, res) => {
    if (!env.googleEnabled) {
      throw badRequest('Google sign-in is not configured on this server');
    }

    const { credential } = z.object({ credential: z.string().min(10) }).parse(req.body);

    const oauth = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await oauth.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) throw unauthorized('Google token was not valid');

    const email = payload.email.toLowerCase();

    // Link by Google id first, then by email so an existing password account
    // can add Google sign-in without creating a duplicate.
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email }] },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          displayName: payload.given_name ?? payload.name ?? email.split('@')[0] ?? 'Karys',
          avatarEmoji: AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? '🪖',
        },
      });
    }

    const session = await issueSession(user);
    res.json({ user: serializeUser(user), ...session });
  }),
);

// ── Refresh ─────────────────────────────────────────────────────────────────
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw unauthorized('Session expired — please sign in again');
    }

    // Rotate: the old token is revoked the moment it is used.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const session = await issueSession(stored.user);
    res.json({ user: serializeUser(stored.user), ...session });
  }),
);

// ── Logout ──────────────────────────────────────────────────────────────────
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const parsed = z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {});
    if (parsed.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(parsed.refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.status(204).end();
  }),
);

// ── Current user ────────────────────────────────────────────────────────────
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
    res.json({ user: serializeUser(user) });
  }),
);

// ── What sign-in methods this server supports ───────────────────────────────
authRouter.get('/config', (_req, res) => {
  res.json({ google: env.googleEnabled, googleClientId: env.GOOGLE_CLIENT_ID || null });
});
