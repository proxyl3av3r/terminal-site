import { randomBytes, createHash } from "crypto";

// TTL токена верификации email — 24 часа.
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

// TTL токена сброса пароля — 1 час (короче, т.к. чувствительнее).
export const RESET_TTL_MS = 60 * 60 * 1000;

// Префикс identifier для reset-токенов — чтобы не путать с email-верификацией
// в той же таблице VerificationToken.
export const RESET_PREFIX = "reset:";

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
