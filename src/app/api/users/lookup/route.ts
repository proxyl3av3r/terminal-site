import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Поиск пользователя для приглашения: по @нику, #shortId или email (точное
// совпадение). Наружу отдаём только публичное (ник, shortId, avatar) — НЕ email.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const rl = rateLimit(`lookup:${clientIp(req)}`, 60, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "Too many lookups." }, { status: 429 });
  }

  const raw = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (raw.length < 3) {
    return NextResponse.json({ ok: false, error: "query too short" }, { status: 400 });
  }

  const q = raw.replace(/^[@#]/, "").toLowerCase();
  const isEmail = raw.includes("@") && raw.includes(".");
  const isShortId = /^\d{6}$/.test(q);

  const user = await db.user.findFirst({
    where: isEmail
      ? { email: q }
      : isShortId
        ? { shortId: q }
        : { username: q },
    select: { id: true, username: true, shortId: true, avatar: true },
  });

  if (!user || user.id === session.user.id) {
    return NextResponse.json({ ok: true, user: null });
  }
  return NextResponse.json({ ok: true, user });
}
