import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { normalizeUsername } from "@/lib/profile";
import { getNowPlaying, spotifyConfigured } from "@/lib/spotify";

export const runtime = "nodejs";

// Публичный «now playing» для профиля /u/<ник>. Отдаёт ТОЛЬКО трек (title/
// artist/art) и только если владелец включил publicSpotify. Токены наружу не
// уходят. Короткий кеш, чтобы не дёргать Spotify на каждый поллинг зрителей.
const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 12_000;

export async function GET(
  _req: Request,
  { params }: { params: { username: string } },
) {
  const username = normalizeUsername(decodeURIComponent(params.username));
  if (!username || !spotifyConfigured()) {
    return NextResponse.json({ ok: true, isPlaying: false });
  }

  const cached = cache.get(username);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const user = await db.user.findUnique({
    where: { username },
    select: { publicSpotify: true, spotifyToken: true },
  });
  // Профиль скрыл now-playing или Spotify не подключён — ничего не отдаём.
  if (!user?.publicSpotify || !user.spotifyToken) {
    const data = { ok: true, isPlaying: false };
    cache.set(username, { ts: Date.now(), data });
    return NextResponse.json(data);
  }

  try {
    const np = await getNowPlaying(decrypt(user.spotifyToken));
    const data = {
      ok: true,
      isPlaying: np.isPlaying,
      title: np.title,
      artist: np.artist,
      albumArt: np.albumArt,
    };
    cache.set(username, { ts: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: true, isPlaying: false });
  }
}
