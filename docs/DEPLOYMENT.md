# Deployment

Kalba is two deployables: a static PWA and a Node API with a Postgres database.

---

## Environment

Everything is configured through `.env` at the repo root. See `.env.example`.

| Variable             | Required         | Notes                                    |
| -------------------- | ---------------- | ---------------------------------------- |
| `DATABASE_URL`       | ✅               | Postgres 14+ connection string           |
| `JWT_ACCESS_SECRET`  | ✅               | ≥16 chars. `openssl rand -base64 48`     |
| `JWT_REFRESH_SECRET` | ✅               | Different from the access secret         |
| `CORS_ORIGIN`        | ✅ in production | Comma-separated list of allowed origins  |
| `PORT`               |                  | Default 4000                             |
| `NODE_ENV`           |                  | `production` in production               |
| `GOOGLE_CLIENT_ID`   |                  | Omit to disable Google sign-in           |
| `ANTHROPIC_API_KEY`  |                  | Omit to run the AI tutor's offline coach |
| `ANTHROPIC_MODEL`    |                  | Default `claude-opus-5`                  |
| `VITE_API_URL`       | build time       | Where the app should call the API        |
| `VITE_BASE`          | build time       | Sub-path when serving from `/repo/`      |

The API validates its config with Zod at boot and **exits with a readable list of
problems** rather than starting half-configured.

### Before going public

- [ ] Both JWT secrets regenerated — never the `.env.example` placeholders
- [ ] `CORS_ORIGIN` set to your real origins only
- [ ] `NODE_ENV=production` (stops error details leaking into responses)
- [ ] TLS terminated in front of the API
- [ ] Database backups scheduled
- [ ] Demo account removed or its password changed

---

## The frontend

### GitHub Pages (configured out of the box)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.

1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions → Variables**, add:
   - `API_URL` — e.g. `https://kalba-api.fly.dev`
   - `GOOGLE_CLIENT_ID` — optional
3. Push to `main`.

The workflow sets `VITE_BASE` to `/<repo>/`, copies `index.html` to `404.html` so deep
links survive Pages' lack of rewrites, and adds `.nojekyll`.

### Anywhere else

```bash
cd frontend
VITE_API_URL=https://your-api.example.com npm run build
```

`frontend/dist/` is a static bundle — Netlify, Vercel, Cloudflare Pages, S3, nginx.
Configure an SPA fallback to `index.html` for any path that isn't a file.

---

## The API

### Docker (recommended)

`backend/Dockerfile` is a multi-stage build; **the build context is the repo root**
because the API depends on the `@kalba/content` workspace.

```bash
docker build -f backend/Dockerfile -t kalba-api .

docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://…" \
  -e JWT_ACCESS_SECRET="…" \
  -e JWT_REFRESH_SECRET="…" \
  -e CORS_ORIGIN="https://you.github.io" \
  -e NODE_ENV=production \
  kalba-api
```

The image runs as `node` (never root), uses `tini` so `SIGTERM` reaches the process, and
ships a `HEALTHCHECK` that hits `/api/health`.

`deploy.yml` publishes this image to `ghcr.io/<owner>/<repo>-api:latest` on every push.

### Fly.io

```bash
fly launch --no-deploy --dockerfile backend/Dockerfile
fly postgres create --name kalba-db
fly postgres attach kalba-db          # sets DATABASE_URL

fly secrets set \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  CORS_ORIGIN="https://you.github.io" \
  NODE_ENV=production

fly deploy
fly ssh console -C "npx prisma db push --schema backend/prisma/schema.prisma"
fly ssh console -C "node backend/dist/seed.js"   # or run the seed locally against the prod URL
```

Add to `fly.toml`:

```toml
[http_service]
  internal_port = 4000
  force_https = true

  [[http_service.http_checks]]
    path = "/api/health"
    interval = "30s"
```

### Render

New → Web Service → Docker, root directory `.`, Dockerfile `backend/Dockerfile`.
Add a Render Postgres instance and set the environment variables above. Health check
path: `/api/health`.

### Railway

`railway init && railway add postgresql && railway up`. Railway injects `DATABASE_URL`;
set the rest with `railway variables set`.

### A plain VPS

```bash
git clone … && cd kalba && npm ci
npm run build
cp .env.example .env   # then edit it
npm run db:push && npm run db:seed
node backend/dist/index.js   # behind systemd or pm2
```

nginx in front:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The API sets `trust proxy`, so rate limiting sees the real client IP through
`X-Forwarded-For`.

---

## Database

### First deploy

```bash
npm run db:push    # apply the schema
npm run db:seed    # load the curriculum
```

### Migrations

For a production database with data in it, use migrations rather than `db push`:

```bash
npm run db:migrate -- --name add_something   # generates a migration locally
npx prisma migrate deploy                     # applies it in CI/production
```

### Updating the curriculum

`db:seed` is safe to re-run at any time. It rebuilds the **content** tables only —
users, progress, streaks and achievements are untouched.

One caveat: flashcards reference words, so the seeder clears the flashcard table when
rebuilding vocabulary. Learners keep their XP, streaks and lesson history; their review
schedule restarts. If that matters for your deployment, seed during a quiet window.

### Backups

```bash
pg_dump "$DATABASE_URL" | gzip > kalba-$(date +%F).sql.gz
```

Only user data needs backing up — the curriculum can always be regenerated from the repo.

---

## Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Web
2. Authorised JavaScript origins: your frontend URL
3. Set `GOOGLE_CLIENT_ID` on the API **and** `VITE_GOOGLE_CLIENT_ID` at build time

Leave both blank and the Google button never renders. Email/password is unaffected.

---

## Kalba AI

Optional. With `ANTHROPIC_API_KEY` set, the tutor uses Claude; without it, it answers
from the course data locally.

Cost control is built in: the tutor runs at low effort with a 2,048-token ceiling, and
history is capped at ten turns.

---

## Monitoring

`GET /api/health` returns `200` when healthy, `503` when the database is unreachable —
point your uptime check at it.

Logs go to stdout in `combined` format under `NODE_ENV=production`.

---

## Troubleshooting

**`Environment variable not found: DATABASE_URL`** — Prisma looks for `.env` next to the
schema. The npm scripts already load the root `.env` via `dotenv-cli`; run them
(`npm run db:push`) rather than calling `prisma` directly.

**CORS errors** — `CORS_ORIGIN` must list the exact origin, scheme included, with no
trailing slash.

**Deep links 404 on the frontend** — the SPA fallback is missing. Pages needs
`404.html`; other hosts need a rewrite to `index.html`.

**Audio mispronounces everything** — the device has no `lt-LT` voice. The app detects
this and warns; adding one is a system-level setting, not something the app can fix.

**Speech recognition does nothing** — it needs Chrome or Edge and a network connection.
Speaking exercises always offer a skip.
