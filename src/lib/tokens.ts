import { randomBytes, createHash } from "crypto";

// TTL токена верификации email — 24 часа.
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Генерируем криптослучайный токен. В письмо/ссылку уходит СЫРОЙ токен,
 * а в БД кладём только его sha256-хеш — утечка БД не даёт готовых токенов.
 */
export function createVerificationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

/** sha256-хеш токена (для сравнения с тем, что в БД). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
