# ─────────────────────────────────────────────────────────────────────
# Multi-stage сборка Next.js (standalone) + Prisma.
# Стадия `builder` используется ещё и для миграций (в ней есть Prisma CLI).
# ─────────────────────────────────────────────────────────────────────

FROM node:20-slim AS base
# Prisma и argon2 требуют openssl/сборочных утилит в slim-образе.
RUN apt-get update -y && apt-get install -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── deps: установка всех зависимостей ────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── builder: генерация Prisma client + сборка Next ───────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy-значения только на время сборки (реальный connect не выполняется).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder"
RUN npx prisma generate
RUN npm run build

# ── runner: минимальный образ для запуска приложения ─────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Безопасность: не от root.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone-вывод Next уже содержит нужные node_modules (incl. @prisma/client).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
