import { db } from "@/lib/db";
import { BADGES } from "@/lib/badges";

/**
 * Выдать значок (идемпотентно). Ачивки при ПЕРВОЙ выдаче начисляют points.
 * Возвращает true, если значок выдан только что (для опц. уведомлений).
 * Никогда не бросает — побочный эффект не должен ронять основное действие.
 */
export async function awardBadge(userId: string, key: string): Promise<boolean> {
  const def = BADGES[key];
  if (!def || !userId) return false;

  // Уже есть? — выходим (дешёвый индексированный select, не спамим insert'ами).
  const exists = await db.userBadge
    .findUnique({ where: { userId_key: { userId, key } }, select: { id: true } })
    .catch(() => null);
  if (exists) return false;

  try {
    await db.userBadge.create({ data: { userId, key } });
  } catch {
    return false; // гонка/дубль — unique-индекс уже защитил
  }

  if (def.points > 0) {
    await db.user
      .update({ where: { id: userId }, data: { points: { increment: def.points } } })
      .catch(() => {});
  }
  return true;
}

/** Тихая обёртка для fire-and-forget в роутах (не ждём и не валим запрос). */
export function awardBadgeSafe(userId: string, key: string): void {
  void awardBadge(userId, key).catch(() => {});
}
