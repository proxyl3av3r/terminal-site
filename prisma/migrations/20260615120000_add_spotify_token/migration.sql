-- Добавляем зашифрованный Spotify refresh-токен пользователю.
ALTER TABLE "users" ADD COLUMN "spotifyToken" TEXT;
