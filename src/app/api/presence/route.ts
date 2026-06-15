import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Лёгкое присутствие: in-memory карта userId -> последний heartbeat.
// Никакой БД, никакой истории — только текущее число «онлайн». Сбрасывается
// при перезапуске контейнера (это норма). Один инстанс приложения.
const WINDOW_MS = 40_000; // считаем онлайн, если heartbeat был < 40с назад
const seen = new Map<string, number>();

function prune(now: number) {
  for (const [id, ts] of seen) {
    if (now - ts > WINDOW_MS) seen.delete(id);
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const now = Date.now();
  seen.set(session.user.id, now);
  prune(now);
  // Возвращаем только число — никаких email/идентификаторов наружу.
  return NextResponse.json({ ok: true, online: seen.size });
}
