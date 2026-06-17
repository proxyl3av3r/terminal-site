-- Экономика баллов: дневной стрик + разблокировки аватара.
ALTER TABLE "users" ADD COLUMN "streak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "lastClaimAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "unlocks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
