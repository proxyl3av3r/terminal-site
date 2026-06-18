-- Тумблер: показывать ли «now playing» из Spotify на публичном профиле.
ALTER TABLE "users" ADD COLUMN "publicSpotify" BOOLEAN NOT NULL DEFAULT false;
