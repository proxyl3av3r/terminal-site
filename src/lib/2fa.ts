import { authenticator } from "otplib";
import { randomBytes } from "crypto";

export const BACKUP_CODES_COUNT = 10;

// Совместимость с Google Authenticator / Bitwarden: стандартный TOTP,
// 6 цифр, шаг 30с. window:1 — допускаем соседний интервал (±30с) на случай
// рассинхрона часов телефона.
authenticator.options = { digits: 6, step: 30, window: 1 };

/** Сгенерировать новый base32-секрет для пользователя. */
export function generateSecret(): string {
  return authenticator.generateSecret();
}

/**
 * otpauth://-URI для QR-кода. issuer/label видны в приложении-аутентификаторе.
 * Пример: yourname.dev (you@email).
 */
export function buildOtpAuthUrl(email: string, secret: string): string {
  const issuer = process.env.SITE_NAME ?? "terminal-site";
  return authenticator.keyuri(email, issuer, secret);
}

/** Проверить 6-значный TOTP-код против секрета. */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Сгенерировать одноразовые backup-коды вида "a1b2-c3d4" (читаемо, без 0/O/1/l).
 * Возвращает СЫРЫЕ коды — показать пользователю один раз; в БД кладём argon2-хеши.
 */
export function generateBackupCodes(count = BACKUP_CODES_COUNT): string[] {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // без похожих символов
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(8);
    let s = "";
    for (let j = 0; j < 8; j++) {
      s += alphabet[bytes[j] % alphabet.length];
      if (j === 3) s += "-";
    }
    codes.push(s);
  }
  return codes;
}
