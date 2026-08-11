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
  const day = Math.floor(Date.now() / 86_400_000);
  if (cache && cache.day === day) return cache;

  // UA обязателен (иначе шлюз 403). Реальный NASA_API_KEY снимает блок DEMO_KEY
  // с дата-центровых IP. Таймауты щедрые: тянем раз в сутки, VPS-канал общий.
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  const metaRes = await stage("meta", 15000, `https://api.nasa.gov/planetary/apod?api_key=${key}`, {
    ...UA,
    Accept: "application/json",
  });
  const meta = await metaRes.json();
  // hdurl — версия высокого разрешения (не растянутая на больших экранах);
  // fallback на обычную url. Тянем раз в сутки → размер не критичен.
  const imgUrl: string | undefined = meta.hdurl || meta.url;
  if (meta.media_type !== "image" || !imgUrl) throw new Error("apod not an image today");

  // Хост apod.nasa.gov отдельный от api.nasa.gov и иногда медленный — даём до 30с.
  const imgRes = await stage("image", 30000, imgUrl, UA);
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
    return new Response(null, { status: 204 });
  }
}
