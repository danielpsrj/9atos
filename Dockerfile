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

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
