# Find My Bay backend — production container.
#
# Multi-stage build keeps the runner image small (~150 MB) by leaving
# devDependencies and the TypeScript toolchain behind in the builder.
# Runs as non-root, has a /health probe, and applies pending Prisma
# migrations on startup so deploys never need a separate migrate step.

# ─── Stage 1: builder ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# OpenSSL is required by Prisma's binary engine on Alpine.
RUN apk add --no-cache openssl

# Install deps with cache-friendly layering.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest. We need the prisma schema before "prisma generate" can
# materialise the client into node_modules/.prisma.
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# Generate the Prisma client + compile TypeScript.
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

# ─── Stage 2: runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl wget

# Drop root.
RUN addgroup -g 1001 -S nodejs && adduser -S fmb -u 1001 -G nodejs

# Copy production artifacts only — no source, no devDeps.
COPY --from=builder --chown=fmb:nodejs /app/package.json ./
COPY --from=builder --chown=fmb:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=fmb:nodejs /app/dist ./dist
COPY --from=builder --chown=fmb:nodejs /app/prisma ./prisma

USER fmb

EXPOSE 3000

# Health probe used by Azure App Service / Container Apps to decide
# when the instance is ready and whether to keep it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# `prisma migrate deploy` is idempotent — it applies any pending
# migrations and exits cleanly if there's nothing to do. Then we boot
# the API. If the migrate step fails the container exits and Azure
# restarts it; over and over a serious DB drift will visibly fail.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
