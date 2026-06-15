import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { auth } from "@/lib/auth";
import { buildAuthUrl, spotifyConfigured } from "@/lib/spotify";

export const runtime = "nodejs";

// Старт OAuth: ставим CSRF-state в httpOnly-cookie и редиректим в Spotify.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!spotifyConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Spotify не настроен на сервере." },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("spotify_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
