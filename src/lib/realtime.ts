// Тонкий клиент к realtime-сервису (Socket.IO) для серверных ручек Next.
// REST остаётся источником истины: сначала пишем в БД, ПОТОМ дёргаем сюда,
// чтобы разослать событие подключённым клиентам. Если realtime недоступен —
// молча игнорируем (чат продолжит работать на fallback-поллинге).

const INTERNAL_URL = process.env.REALTIME_INTERNAL_URL || "http://realtime:4000";
const SECRET = process.env.REALTIME_SECRET;

export const userRoom = (userId: string) => `user:${userId}`;
export const convRoom = (conversationId: string) => `conv:${conversationId}`;

/**
 * Разослать событие в указанные комнаты realtime-сервиса.
 * Fire-and-forget: с коротким таймаутом и без выброса ошибок наружу.
 */
export async function notifyRealtime(
  rooms: string[],
  event: string,
  payload: unknown,
): Promise<void> {
  if (!SECRET || rooms.length === 0) return;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 1500);
  try {
    await fetch(`${INTERNAL_URL}/emit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-realtime-secret": SECRET,
      },
      body: JSON.stringify({ rooms, event, payload }),
      signal: ac.signal,
    });
  } catch {
    // realtime лежит/недоступен — не критично, клиенты переживут на поллинге
  } finally {
    clearTimeout(t);
  }
}
