-- Ежедневная тривия: набор вопросов дня (с ответами — только сервер) +
-- результат игрока за день (анти-реплей + счёт).
CREATE TABLE "trivia_daily" (
    "day" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trivia_daily_pkey" PRIMARY KEY ("day")
);

CREATE TABLE "trivia_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trivia_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trivia_results_userId_day_key" ON "trivia_results"("userId", "day");
CREATE INDEX "trivia_results_userId_idx" ON "trivia_results"("userId");

ALTER TABLE "trivia_results"
    ADD CONSTRAINT "trivia_results_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
