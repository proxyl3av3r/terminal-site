-- Лог ежедневной активности для графа-хитмапа (claim, сообщения и т.п.).
CREATE TABLE "activity_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "activity_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "activity_days_userId_day_key" ON "activity_days"("userId", "day");
CREATE INDEX "activity_days_userId_idx" ON "activity_days"("userId");

ALTER TABLE "activity_days"
    ADD CONSTRAINT "activity_days_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
