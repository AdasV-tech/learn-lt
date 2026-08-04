#!/usr/bin/env node
/**
 * One-command bootstrap for a fresh clone.
 *
 *   npm run setup
 *
 * Creates .env from the template, starts Postgres via Docker (if available),
 * pushes the Prisma schema and seeds the Lithuanian curriculum.
 */
import { execSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const step = (msg) => console.log(`\n${c.cyan}${c.bold}▸ ${msg}${c.reset}`);
const ok = (msg) => console.log(`  ${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => console.log(`  ${c.yellow}!${c.reset} ${msg}`);
const fail = (msg) => console.log(`  ${c.red}✗${c.reset} ${msg}`);

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

function has(cmd) {
  return spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    stdio: 'ignore',
  }).status === 0;
}

console.log(`${c.bold}\n  Kalba — setup${c.reset}\n  ${c.dim}Lietuvių kalba, nemokamai.${c.reset}`);

// 1. Environment file ────────────────────────────────────────────────────────
step('Environment');
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  ok('.env already exists — leaving it alone');
} else {
  copyFileSync(resolve(root, '.env.example'), envPath);
  // Replace the dev placeholder secrets with real random ones.
  let env = readFileSync(envPath, 'utf8');
  env = env
    .replace(/JWT_ACCESS_SECRET="[^"]*"/, `JWT_ACCESS_SECRET="${randomBytes(48).toString('base64')}"`)
    .replace(
      /JWT_REFRESH_SECRET="[^"]*"/,
      `JWT_REFRESH_SECRET="${randomBytes(48).toString('base64')}"`,
    );
  writeFileSync(envPath, env);
  ok('.env created with freshly generated JWT secrets');
}

// 2. Database ────────────────────────────────────────────────────────────────
step('Database');
let dbReady = false;
if (has('docker')) {
  try {
    run('docker compose up -d postgres');
    process.stdout.write('  waiting for Postgres');
    for (let i = 0; i < 40; i++) {
      const res = spawnSync('docker', ['exec', 'kalba-postgres', 'pg_isready', '-U', 'kalba'], {
        stdio: 'ignore',
      });
      if (res.status === 0) {
        dbReady = true;
        break;
      }
      process.stdout.write('.');
      spawnSync(process.platform === 'win32' ? 'timeout' : 'sleep', ['1'], { stdio: 'ignore' });
    }
    console.log('');
    if (dbReady) ok('Postgres is accepting connections');
    else fail('Postgres did not become ready');
  } catch {
    warn('Could not start Postgres with Docker.');
  }
} else {
  warn('Docker not found — point DATABASE_URL in .env at your own Postgres instance.');
}

// 3. Schema + seed ───────────────────────────────────────────────────────────
if (dbReady) {
  step('Schema & content');
  try {
    run('npm run db:push');
    ok('Schema applied');
    run('npm run db:seed');
    ok('Lithuanian curriculum seeded');
  } catch {
    fail('Migration or seeding failed — see the output above.');
    process.exit(1);
  }
} else {
  warn('Skipping schema/seed. Once your database is up, run:  npm run db:push && npm run db:seed');
}

// 4. Done ────────────────────────────────────────────────────────────────────
console.log(`
${c.green}${c.bold}  Viskas paruošta! (All set!)${c.reset}

  ${c.bold}npm run dev${c.reset}   →  API on ${c.cyan}http://localhost:4000${c.reset}
                   app on ${c.cyan}http://localhost:5173${c.reset}

  ${c.dim}Demo account after seeding:  demo@kalba.app  /  Demo1234!${c.reset}
`);
