import { errText } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Astronomy Picture of the Day (NASA) для фонового слоя главной.
// Дата в ПУТИ (/api/apod/2026-08-15) — cache-buster: Cloudflare всегда учитывает
// путь в ключе кеша (query — не всегда). Значение для логики НЕ используется.
// Кешируем байты на сутки в памяти процесса; при сбое NASA отдаём вчерашний
// кадр (лучше, чем пустой фон). В видео-дни берём последнюю картинку.

let cache: { day: number; bytes: Uint8Array; type: string } | null = null;
let lastFail = 0;

const UA = { "User-Agent": "bash-app.com (+https://bash-app.com)" };

async function stage(label: string, ms: number, url: string, headers: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    // cache: "no-store" — иначе Next.js Data Cache отдаёт вчерашний ответ NASA.
    const res = await fetch(url, { signal: ctrl.signal, headers, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status}`);
    return res;
  } catch (e) {
    throw new Error(`apod ${label}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

// Метаданные APOD за дату (или сегодня). api.nasa.gov бывает медленным с VPS —
// таймаут 20с и один ретрай.
async function fetchMeta(key: string, date?: string): Promise<any> {
  const url = `https://api.nasa.gov/planetary/apod?api_key=${key}${date ? `&date=${date}` : ""}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await stage("meta", 20000, url, { ...UA, Accept: "application/json" });
      return await res.json();
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
}

// Ищем день с картинкой: сегодня, а если видео-день — шагаем назад до 6 дней.
async function findImageMeta(key: string): Promise<any> {
  const today = await fetchMeta(key);
  if (today.media_type === "image" && today.url) return today;
  for (let i = 1; i <= 6; i++) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    try {
      const prev = await fetchMeta(key, d);
      if (prev.media_type === "image" && prev.url) return prev;
    } catch {
      /* пропускаем недоступный день */
    }
  }
  throw new Error("no recent apod image (video days?)");
}

async function fetchFresh(day: number): Promise<{ bytes: Uint8Array; type: string }> {
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  const meta = await findImageMeta(key);

  const hd: string | undefined = meta.hdurl;
  const std: string = meta.url;

  async function grab(url: string, label: string): Promise<Response> {
    const res = await stage(label, 18000, url, UA);
    const len = Number(res.headers.get("content-length") || "0");
    if (len > 12_000_000) throw new Error(`${label} too large (${len})`);
    return res;
  }

  let imgRes: Response;
  try {
    imgRes = hd ? await grab(hd, "image-hd") : await grab(std, "image-std");
  } catch {
    imgRes = await grab(std, "image-std");
  }

  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  cache = { day, bytes, type: imgRes.headers.get("content-type") ?? "image/jpeg" };
  return cache;
}

async function getApod(): Promise<{ bytes: Uint8Array; type: string; stale: boolean }> {
  // Граница суток со сдвигом ~5ч (NASA публикует в полночь US Eastern).
  const day = Math.floor((Date.now() - 5 * 3_600_000) / 86_400_000);
  if (cache && cache.day === day) return { ...cache, stale: false };

  // Во время сбоя NASA не долбим его каждым запросом: недавно не вышло + есть
  // старый кадр → отдаём вчерашний.
  if (cache && Date.now() - lastFail < 300_000) return { ...cache, stale: true };

  try {
    const fresh = await fetchFresh(day);
    return { ...fresh, stale: false };
  } catch (e) {
    lastFail = Date.now();
    if (cache) return { ...cache, stale: true }; // вчерашний вместо пустоты
    throw e;
  }
}

export async function GET() {
  try {
    const a = await getApod();
    return new Response(a.bytes, {
      headers: {
        "Content-Type": a.type,
        // Свежий кадр кешируем на сутки; «вчерашний» (stale) — лишь на 5 мин,
        // чтобы кеши быстро подхватили свежий, когда NASA очнётся.
        "Cache-Control": a.stale
          ? "public, max-age=300"
          : "public, max-age=21600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("apod failed:", errText(err));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
}
