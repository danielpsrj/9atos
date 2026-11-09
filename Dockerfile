# syntax=docker/dockerfile:1

# ── Stage 1: deps ────────────────────────────────────────────────────────────
# Install dependencies with layer caching (lockfile copied before source).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
# Generate the Prisma client and build the Next.js standalone output.
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Generate the Prisma client against the schema so the engine is present
# for the standalone trace (no-op until the schema has models).
RUN npx prisma generate || true
RUN npm run build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
# Minimal production image: standalone server + static assets + public,
# running as a non-root user.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Public assets (images, favicon, etc.)
COPY --from=build /app/public ./public

# Standalone server (includes traced node_modules + Prisma engine)
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
# Static build output (not included in standalone)
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Full node_modules from the deps stage: the standalone trace only includes
# modules imported at runtime, but startup needs the `prisma` CLI (migrate
# deploy) and `tsx` (to run the seed script). Copying the full tree provides
# both without a separate migration container.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
# Prisma schema + migrations + seed (needed by the startup migrate/seed).
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000
# Apply migrations and seed (both idempotent) before starting the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node server.js"]
