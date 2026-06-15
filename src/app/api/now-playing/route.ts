import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getNowPlaying, spotifyConfigured } from "@/lib/spotify";

export const runtime = "nodejs";

// Короткий per-user кеш, чтобы не дёргать Spotify на каждый поллинг.
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 12_000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const uid = session.user.id;

  // Spotify не настроен на сервере — отдаём флаг, UI спрячет кнопку connect.
  if (!spotifyConfigured()) {
    return NextResponse.json({ ok: true, configured: false, connected: false, isPlaying: false });
  }

  const cached = cache.get(uid);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const user = await db.user.findUnique({
    where: { id: uid },
    select: { spotifyToken: true },
  });
  if (!user?.spotifyToken) {
    const data = { ok: true, configured: true, connected: false, isPlaying: false };
    cache.set(uid, { ts: Date.now(), data });
    return NextResponse.json(data);
  }

  try {
    const np = await getNowPlaying(decrypt(user.spotifyToken));
    const data = { ok: true, configured: true, connected: true, ...np };
    cache.set(uid, { ts: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("now-playing failed:", err);
    return NextResponse.json({ ok: true, connected: true, isPlaying: false });
  }
}
