import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`\n  Kalba API  →  http://localhost:${env.PORT}`);
  console.info(`  health     →  http://localhost:${env.PORT}/api/health`);
  console.info(`  mode       →  ${env.NODE_ENV}`);
  console.info(`  Kalba AI   →  ${env.aiEnabled ? 'Claude' : 'offline coach (no API key)'}\n`);
});

async function shutdown(signal: string) {
  console.info(`\n  ${signal} received — shutting down`);
  server.close(() => {
    void prisma.$disconnect().then(() => process.exit(0));
  });
  // Don't hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
