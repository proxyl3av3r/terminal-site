import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { clientIp } from "@/lib/ratelimit";
import { errText } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Единый прокси-шлюз к бесплатным сторонним API. Браузер ходит только к нам
// (CSP connect-src 'self' не трогаем), внешние вызовы делает сервер. Каждая
// команда нормализуется в { ok, text } — клиенту остаётся просто напечатать text.

async function fetchJson(url: string, opts: RequestInit = {}): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { "User-Agent": "bash-app.com terminal", ...(opts.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// WMO weather codes → короткий человекочитаемый текст.
const WMO: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "rain showers", 81: "rain showers", 82: "violent showers",
  85: "snow showers", 86: "snow showers", 95: "thunderstorm", 96: "thunderstorm + hail", 99: "thunderstorm + hail",
};

async function geoByIp(ip: string): Promise<{ lat: number; lon: number; city: string; country: string; isp: string } | null> {
  // ip-api: бесплатно, без ключа, non-commercial. Локальные адреса пропускаем.
  if (!ip || ip.startsWith("127.") || ip.startsWith("::1") || ip.startsWith("10.") || ip.startsWith("192.168.")) return null;
  const d = await fetchJson(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,lat,lon,isp`);
  if (d.status !== "success") return null;
  return { lat: d.lat, lon: d.lon, city: d.city, country: d.country, isp: d.isp };
}

async function handle(cmd: string, arg: string, req: Request): Promise<string> {
  switch (cmd) {
    case "joke": {
      const d = await fetchJson("https://icanhazdadjoke.com/", { headers: { Accept: "application/json" } });
      return d.joke ?? "…no joke landed. tough crowd.";
    }
    case "advice": {
      const d = await fetchJson(`https://api.adviceslip.com/advice?_=${Date.now()}`);
      return d?.slip?.advice ? `“${d.slip.advice}”` : "no advice today. improvise.";
    }
    case "iss": {
      const d = await fetchJson("https://api.wheretheiss.at/v1/satellites/25544");
      const lat = Number(d.latitude).toFixed(2);
      const lon = Number(d.longitude).toFixed(2);
      const spd = Math.round(Number(d.velocity));
      const alt = Math.round(Number(d.altitude));
      return `ISS now at ${lat}, ${lon} · alt ${alt} km · speed ${spd.toLocaleString()} km/h. Someone up there is having a better view than you.`;
    }
    case "define": {
      const w = arg.trim().toLowerCase();
      if (!w) return "usage: define <word>";
      try {
        const d = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
        const meaning = d?.[0]?.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition;
        if (!def) return `no definition found for "${w}".`;
        const pos = meaning.partOfSpeech ? ` (${meaning.partOfSpeech})` : "";
        return `${w}${pos}: ${def}`;
      } catch {
        return `no definition found for "${w}".`;
      }
    }
    case "whereami": {
      const geo = await geoByIp(clientIp(req));
      if (!geo) return "can't locate you (local network or private IP). you're a ghost. respect.";
      return `${geo.city}, ${geo.country} · ${geo.isp}. (this is just your public IP talking — no magic.)`;
    }
    case "weather": {
      let lat: number, lon: number, place: string;
      if (arg.trim()) {
        const g = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(arg.trim())}&count=1`);
        const r = g?.results?.[0];
        if (!r) return `city not found: "${arg.trim()}".`;
        lat = r.latitude; lon = r.longitude; place = `${r.name}${r.country_code ? ", " + r.country_code : ""}`;
      } else {
        const geo = await geoByIp(clientIp(req));
        if (!geo) return "usage: weather <city> (couldn't auto-detect your location).";
        lat = geo.lat; lon = geo.lon; place = `${geo.city}, ${geo.country}`;
      }
      const w = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m`);
      const c = w?.current;
      if (!c) return "weather service unavailable right now.";
      const desc = WMO[c.weather_code] ?? "unknown sky";
      return `${place}: ${Math.round(c.temperature_2m)}°C, ${desc}, wind ${Math.round(c.wind_speed_10m)} km/h.`;
    }
    default:
      return `unknown tool: ${cmd}`;
  }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, text: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const cmd = (url.searchParams.get("cmd") ?? "").toLowerCase();
  const arg = url.searchParams.get("arg") ?? "";
  try {
    const text = await handle(cmd, arg, req);
    return NextResponse.json({ ok: true, text });
  } catch (err) {
    console.error(`tools/${cmd} failed:`, errText(err));
    return NextResponse.json({ ok: true, text: "the network hiccuped — try again in a sec." });
  }
}
