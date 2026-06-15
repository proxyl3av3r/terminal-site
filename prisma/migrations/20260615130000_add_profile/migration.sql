-- Профиль пользователя: публичный ник и короткий 6-значный ID.
ALTER TABLE "users" ADD COLUMN "username" TEXT;
ALTER TABLE "users" ADD COLUMN "shortId" TEXT;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_shortId_key" ON "users"("shortId");
