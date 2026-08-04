import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// The .env lives at the repo root so a single file configures every workspace.
// Walk up from this file until we find one; fall back to real env vars (which
// is what happens in CI and in production).
const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  resolve(here, '../../.env'),
  resolve(here, '../../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env'),
]) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required — see .env.example'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n  Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`    ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\n  Copy .env.example to .env and fill it in (or run: npm run setup)\n');
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** Google sign-in is optional; email/password always works without it. */
  googleEnabled: raw.GOOGLE_CLIENT_ID.length > 0,
  /** Without a key the AI tutor falls back to a local rule-based coach. */
  aiEnabled: raw.ANTHROPIC_API_KEY.length > 0,
};

export type Env = typeof env;
