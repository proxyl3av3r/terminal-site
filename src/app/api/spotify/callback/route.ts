import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { exchangeCode } from "@/lib/spotify";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";

// Callback OAuth: проверяем CSRF-state, меняем code на refresh-токен,
// шифруем и кладём в БД. Редиректим обратно в панель.
export async function GET(req: Request) {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const back = (s: string) => NextResponse.redirect(`${base}/dashboard?spotify=${s}`);

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${base}/`);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)spotify_state=([^;]+)/)?.[1];

  // CSRF-защита: state из ссылки должен совпасть с тем, что в cookie.
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("error");
  }

  try {
    const refreshToken = await exchangeCode(code);
    await db.user.update({
      where: { id: session.user.id },
      data: { spotifyToken: encrypt(refreshToken) },
    });
  } catch (err) {
    console.error("spotify callback failed:", err);
    return back("error");
  }

  const res = back("connected");
  res.cookies.delete("spotify_state");
  return res;
}
