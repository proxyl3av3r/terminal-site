# Лёгкий realtime-сервис (Socket.IO). Без Next/Prisma — только тонкий fan-out.
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Только prod-зависимости. Если lock-файла нет — npm install сам его разрулит.
RUN npm install --omit=dev

FROM node:20-slim AS runner
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app
# Не от root.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 realtime
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=realtime:nodejs package.json server.mjs ./
USER realtime
EXPOSE 4000
CMD ["node", "server.mjs"]
