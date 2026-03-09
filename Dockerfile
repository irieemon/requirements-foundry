# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Stage 2: Build application
FROM node:22-alpine AS builder
WORKDIR /app
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && DATABASE_URL="postgresql://build:build@localhost:5432/build" npx next build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma

# Overlay full node_modules from deps stage (ensures prisma CLI + all deps available)
# Standalone's traced node_modules gets overwritten but all runtime deps are superset
COPY --from=deps /app/node_modules ./node_modules

# Copy entrypoint script, migration files, and Prisma config
COPY entrypoint.js ./
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/prisma.config.ts ./

USER nextjs

EXPOSE 3000

CMD ["node", "entrypoint.js"]
