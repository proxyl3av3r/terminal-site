import { randomInt } from "crypto";
import { db } from "@/lib/db";

// Ник: 3–20 символов, латиница/цифры/подчёркивание, хранится в lowercase.
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
// Зарезервированные ники (системные/опасные).
const RESERVED = new Set([
  "admin", "root", "system", "klebold", "moderator", "support", "null",
  "undefined", "me", "you", "guest",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(name: string): string | null {
  if (!USERNAME_RE.test(name)) {
    return "3–20 chars: latin letters, digits, underscore";
  }
  if (RESERVED.has(name)) return "this username is reserved";
  return null;
}

/** Сгенерировать уникальный 6-значный публичный ID (100000–999999). */
export async function generateShortId(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = String(randomInt(100000, 1000000));
    const exists = await db.user.findUnique({ where: { shortId: candidate } });
    if (!exists) return candidate;
  }
  throw new Error("could not allocate a unique short id");
}
