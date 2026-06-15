import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Симметричное шифрование чувствительных строк (Spotify refresh-токен) для
// хранения в БД. AES-256-GCM: даёт и конфиденциальность, и проверку целостности.
// Ключ — TOKEN_ENC_KEY (64 hex = 32 байта). Сгенерировать: openssl rand -hex 32

function key(): Buffer {
  const hex = process.env.TOKEN_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_ENC_KEY должен быть 64 hex-символа (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

// Формат: base64( iv(12) | authTag(16) | ciphertext )
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
