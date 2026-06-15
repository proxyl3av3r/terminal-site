-- Аватар (JSON-конфиг) и игровые очки пользователя.
ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
ALTER TABLE "users" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;
