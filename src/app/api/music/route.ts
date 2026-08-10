import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { errText } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Прокси к бесплатным музыкальным источникам: интернет-радио (Radio Browser)
// и Audius (открытый стриминг «как SoundCloud»). Браузер ходит только к нам за
// списками (connect-src 'self'); сам звук <audio> тянет с https-хоста
// напрямую (CSP media-src https:).

interface Track {
  title: string;
  subtitle: string;
  stream: string;
}

async function fetchJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "bash-app.com music", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ── Интернет-радио (несколько зеркал с фолбэком) ──
const RADIO_HOSTS = [
  "https://de1.api.radio-browser.info",
  "https://fi1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
];

async function radio(path: string): Promise<any> {
  for (const host of RADIO_HOSTS) {
    try {
      return await fetchJson(host + path);
    } catch {
      /* пробуем следующее зеркало */
    }
  }
  throw new Error("radio unavailable");
}

async function radioStations(tag: string, q: string): Promise<Track[]> {
  const path = q
    ? `/json/stations/byname/${encodeURIComponent(q)}?limit=40&hidebroken=true&order=votes&reverse=true`
    : `/json/stations/bytag/${encodeURIComponent(tag || "lofi")}?limit=40&hidebroken=true&order=clickcount&reverse=true`;
  const list: any[] = await radio(path);
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const s of list) {
    const url = String(s.url_resolved || "");
    // только https — иначе смешанный контент на нашем https-сайте
    if (!url.startsWith("https://")) continue;
    const name = String(s.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const bits = [s.bitrate ? `${s.bitrate}k` : null, s.countrycode || null].filter(Boolean).join(" · ");
    out.push({ title: name, subtitle: bits || "radio", stream: url });
    if (out.length >= 20) break;
  }
  return out;
}

// ── Audius (открытый стриминг) ──
let audiusHost = "";
async function audiusGetHost(): Promise<string> {
  if (audiusHost) return audiusHost;
  const d = await fetchJson("https://api.audius.co");
  const host = Array.isArray(d?.data) ? d.data[0] : null;
  if (!host) throw new Error("audius host unavailable");
  audiusHost = host;
  return host;
}

async function audiusSearch(q: string): Promise<Track[]> {
  if (!q.trim()) return [];
  const host = await audiusGetHost();
  const d = await fetchJson(`${host}/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=bashapp`);
  const items: any[] = Array.isArray(d?.data) ? d.data : [];
  return items.slice(0, 20).map((t): Track => ({
    title: String(t.title || "untitled"),
    subtitle: String(t?.user?.name || t?.user?.handle || "unknown"),
    stream: `${host}/v1/tracks/${t.id}/stream?app_name=bashapp`,
  }));
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const src = (url.searchParams.get("src") ?? "radio").toLowerCase();
  const tag = url.searchParams.get("tag") ?? "";
  const q = url.searchParams.get("q") ?? "";
  try {
    const items = src === "audius" ? await audiusSearch(q) : await radioStations(tag, q);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error(`music/${src} failed:`, errText(err));
    return NextResponse.json({ ok: false, error: "music source unavailable", items: [] }, { status: 200 });
  }
}
