import { errText } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Astronomy Picture of the Day (NASA) для фонового слоя главной.
// Дата в ПУТИ (/api/apod/2026-08-15) — чисто cache-buster: Cloudflare всегда
// учитывает путь в ключе кеша (query string — не всегда), поэтому каждый день
// это гарантированно новый ресурс и фон обновляется. Значение day для логики НЕ
// используется — «сегодня» сервер считает сам. Кешируем байты на сутки в памяти
// процесса (к NASA ходим раз в день). В видео-дни берём последнюю картинку.

let cache: { day: number; bytes: Uint8Array; type: string } | null = null;

const UA = { "User-Agent": "bash-app.com (+https://bash-app.com)" };

async function stage(label: string, ms: number, url: string, headers: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`${res.status}`);
    return res;
  } catch (e) {
    throw new Error(`apod ${label}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMeta(key: string, date?: string): Promise<any> {
  const url = `https://api.nasa.gov/planetary/apod?api_key=${key}${date ? `&date=${date}` : ""}`;
  const res = await stage("meta", 15000, url, { ...UA, Accept: "application/json" });
  return res.json();
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

async function getApod(): Promise<{ bytes: Uint8Array; type: string }> {
  // Граница суток со сдвигом ~5ч (NASA публикует в полночь US Eastern).
  const day = Math.floor((Date.now() - 5 * 3_600_000) / 86_400_000);
  if (cache && cache.day === day) return cache;

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

export async function GET() {
  try {
    const a = await getApod();
    return new Response(a.bytes, {
      headers: {
        "Content-Type": a.type,
        // URL меняется каждый день → можно кешировать сутки.
        "Cache-Control": "public, max-age=21600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("apod failed:", errText(err));
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
}
