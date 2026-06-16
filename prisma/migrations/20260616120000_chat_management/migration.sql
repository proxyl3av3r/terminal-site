-- Управление чатами: типы (dm/group/channel) и ссылки-приглашения.

-- Тип чата. Бэкфилл из legacy-флага isGroup: true → group, false → dm.
ALTER TABLE "conversations" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'dm';
UPDATE "conversations" SET "kind" = 'group' WHERE "isGroup" = true;

-- Публичный токен-приглашение (одна активная ссылка на чат).
ALTER TABLE "conversations" ADD COLUMN "inviteToken" TEXT;
CREATE UNIQUE INDEX "conversations_inviteToken_key" ON "conversations"("inviteToken");
