-- Статус участника диалога: accepted (обычный) / pending (входящий запрос).
ALTER TABLE "conversation_members" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'accepted';
