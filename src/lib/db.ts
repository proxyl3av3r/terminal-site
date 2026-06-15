import { PrismaClient } from "@prisma/client";

// В dev Next.js перезагружает модули при каждом изменении. Без кеша в global
// это плодило бы новые PrismaClient'ы и исчерпало пул подключений к Postgres.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
