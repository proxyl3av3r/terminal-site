import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { parseAvatar, validateUnlocked, type AvatarConfig } from "@/lib/avatar";
import { awardBadgeSafe } from "@/lib/award";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatar: true },
  });
  return NextResponse.json({
    ok: true,
    config: parseAvatar(user?.avatar ?? null, session.user.id),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const rl = rateLimit(`avatar:${clientIp(req)}`, 30, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "Too many attempts." }, { status: 429 });
  }

  let body: Partial<AvatarConfig>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Прогоняем через parseAvatar (clamp к валидным индексам), затем проверяем,
  // что выбранные опции доступны (free или разблокированы за баллы).
  const config = parseAvatar(JSON.stringify(body), session.user.id);
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { unlocks: true },
  });
  const locked = validateUnlocked(config, me?.unlocks ?? []);
  if (locked) return NextResponse.json({ ok: false, error: locked }, { status: 403 });

  await db.user.update({
    where: { id: session.user.id },
    data: { avatar: JSON.stringify(config) },
  });
  awardBadgeSafe(session.user.id, "avatar");
  return NextResponse.json({ ok: true, config });
}
