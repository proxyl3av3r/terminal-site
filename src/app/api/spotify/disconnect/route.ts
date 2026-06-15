import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Отключение Spotify: стираем токен из БД.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { spotifyToken: null },
  });
  return NextResponse.json({ ok: true });
}
