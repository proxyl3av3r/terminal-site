import { errText } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Astronomy Picture of the Day (NASA) для фонового слоя главной. Кешируем на
// СУТКИ в памяти процесса: к NASA ходим раз в день, всем отдаём байты сами
// (браузер грузит с нашего домена → CSP img-src не трогаем). В видео-дни или
// при сбое отдаём 204 — фон просто не появляется.

let cache: { day: number; bytes: Uint8Array; type: string } | null = null;

const UA = { "User-Agent": "bash-app.com (+https://bash-app.com)" };

// Запрос с таймаутом и меткой стадии (видно в логах, что именно тормозит).
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

async function getApod(): Promise<{ bytes: Uint8Array; type: string }> {
  // Сдвиг ~5ч: NASA публикует новый APOD в полночь US Eastern (~04-05:00 UTC),
  // а не в 00:00 UTC. Считаем «сутки» от 05:00 UTC — так кеш флипается уже после
  // публикации, без окна «вчерашней» картинки.
  const day = Math.floor((Date.now() - 5 * 3_600_000) / 86_400_000);
  if (cache && cache.day === day) return cache;

  // UA обязателен (иначе шлюз 403). Реальный NASA_API_KEY снимает блок DEMO_KEY
  // с дата-центровых IP. Таймауты щедрые: тянем раз в сутки, VPS-канал общий.
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  const metaRes = await stage("meta", 15000, `https://api.nasa.gov/planetary/apod?api_key=${key}`, {
    ...UA,
    Accept: "application/json",
  });
  const meta = await metaRes.json();
  if (meta.media_type !== "image" || !meta.url) throw new Error("apod not an image today");

  // Берём hi-res (hdurl), но с подстраховкой: если он падает по таймауту ИЛИ
  // слишком тяжёлый (панорамы бывают по 30+ МБ) — откатываемся на обычную url,
  // чтобы фон не пропадал. Хост apod.nasa.gov отдельный и иногда медленный.
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
    imgRes = await grab(std, "image-std"); // фолбэк на стандартное разрешение
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
        // сутки в CDN/браузере — картинка одна на весь день
        "Cache-Control": "public, max-age=21600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("apod failed:", errText(err));
    // no-store: разовый сбой НЕ должен залипать в кеше браузера/Cloudflare под
    // сегодняшним URL — иначе фон пропадёт на весь день.
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
}
