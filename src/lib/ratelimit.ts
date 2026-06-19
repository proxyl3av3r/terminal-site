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

/**
 * IP клиента для rate-limit ключей.
 *
 * ВАЖНО (анти-спуфинг): доверяем ТОЛЬКО заголовкам, которые ставит наш Nginx.
 * Nginx задаёт `X-Real-IP $remote_addr` (реальный адрес, клиент его не
 * контролирует) и `X-Forwarded-For $proxy_add_x_forwarded_for` — последний
 * ДОПИСЫВАЕТ реальный IP в конец к присланному клиентом. Поэтому ПЕРВЫЙ элемент
 * XFF подделывается клиентом (`X-Forwarded-For: 1.2.3.4` → свежий лимит). Берём
 * x-real-ip, а если его нет — ПОСЛЕДНИЙ элемент XFF (ближайший к серверу хоп).
 * Приложение слушает только 127.0.0.1, наружу — только через Nginx.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}
