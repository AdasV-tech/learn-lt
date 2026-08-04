# Kalba API — multi-stage build.
#
# Build context is the repo root, because the API depends on the @kalba/content
# workspace:  docker build -f backend/Dockerfile .

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copy manifests first so the dependency layer is cached until they change.
COPY package.json package-lock.json ./
COPY database/package.json ./database/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci --workspace @kalba/content --workspace @kalba/backend --include-workspace-root

COPY database ./database
COPY backend ./backend

RUN npm run build --workspace @kalba/content \
  && npx prisma generate --schema backend/prisma/schema.prisma \
  && npm run build --workspace @kalba/backend

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Prisma needs OpenSSL at runtime on Alpine.
RUN apk add --no-cache openssl tini

COPY package.json package-lock.json ./
COPY database/package.json ./database/
COPY backend/package.json ./backend/

RUN npm ci --omit=dev --workspace @kalba/content --workspace @kalba/backend --include-workspace-root \
  && npm cache clean --force

COPY --from=build /app/database/dist ./database/dist
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Never run as root.
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombies and forwards signals so SIGTERM reaches Node.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/index.js"]
