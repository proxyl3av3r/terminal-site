import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Супер-админы задаются переменной окружения SUPER_ADMIN_EMAILS (через запятую,
// регистронезависимо). НЕ хардкодим email в коде — репозиторий публичный.
// Права супер-админа = его аккаунт (с обычным логином + 2FA) совпадает по email.
const ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Проверка текущей сессии на супер-админа. Email берём из БД по id (надёжнее,
 * чем доверять токену). Возвращает { id, email } или null.
 */
export async function getAdmin(): Promise<{ id: string; email: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!u || !isSuperAdmin(u.email)) return null;
  return { id: session.user.id, email: u.email };
}
