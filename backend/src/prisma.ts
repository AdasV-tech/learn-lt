import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * A single Prisma client for the process.
 *
 * `tsx watch` re-evaluates modules on every save, which would otherwise open a
 * new connection pool each time and exhaust Postgres within a few edits.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;
