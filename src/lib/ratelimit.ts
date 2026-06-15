import { LRUCache } from "lru-cache";

// In-memory sliding-window лимитер. Хранит метки времени запросов по ключу.
// Достаточно для одного инстанса. При масштабировании на несколько процессов —
// заменить реализацию на Upstash/Redis, не трогая вызовы в роутах.
const store = new LRUCache<string, number[]>({
  max: 5000,
  ttl: 60 * 60 * 1000, // час — авто-уборка старых ключей
});

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key      уникальный ключ (например `register:<ip>`)
 * @param limit    максимум запросов в окне
 * @param windowMs длина окна в мс
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { success: false, remaining: 0, retryAfterSec };
  }

  hits.push(now);
  store.set(key, hits);
  return { success: true, remaining: limit - hits.length, retryAfterSec: 0 };
}

/** Достаём IP клиента из заголовков прокси (Nginx ставит x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
