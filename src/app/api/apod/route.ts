import { errText } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Astronomy Picture of the Day (NASA) для фонового слоя главной. Кешируем на
// СУТКИ в памяти процесса: к NASA ходим раз в день, всем отдаём байты сами
// (браузер грузит с нашего домена → CSP img-src не трогаем). В видео-дни или
// при сбое отдаём 204 — фон просто не появляется.

let cache: { day: number; bytes: Uint8Array; type: string } | null = null;

async function getApod(): Promise<{ bytes: Uint8Array; type: string }> {
  const day = Math.floor(Date.now() / 86_400_000);
  if (cache && cache.day === day) return cache;

  const key = process.env.NASA_API_KEY ?? "DEMO_KEY";
  const metaRes = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`, {
    signal: AbortSignal.timeout(7000),
  });
  if (!metaRes.ok) throw new Error(`apod meta ${metaRes.status}`);
  const meta = await metaRes.json();
  if (meta.media_type !== "image" || !meta.url) throw new Error("apod not an image today");

  const imgRes = await fetch(meta.url, { signal: AbortSignal.timeout(9000) });
  if (!imgRes.ok) throw new Error(`apod image ${imgRes.status}`);
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
