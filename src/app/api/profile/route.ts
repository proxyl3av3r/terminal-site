import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import {
  normalizeUsername,
  validateUsername,
  generateShortId,
} from "@/lib/profile";

export const runtime = "nodejs";

// Текущий профиль.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, shortId: true, email: true },
  });
  return NextResponse.json({ ok: true, ...user });
}

// Установить/сменить ник. При первой установке выдаём короткий ID.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rl = rateLimit(`profile:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const username = normalizeUsername(String(body.username ?? ""));
  const err = validateUsername(username);
  if (err) return NextResponse.json({ ok: false, error: err }, { status: 400 });

  // Занятость ника (не считая самого себя).
  const taken = await db.user.findUnique({ where: { username } });
  if (taken && taken.id !== session.user.id) {
    return NextResponse.json(
      { ok: false, error: "username already taken" },
      { status: 409 },
    );
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { shortId: true },
  });
  const shortId = me?.shortId ?? (await generateShortId());

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { username, shortId },
    select: { username: true, shortId: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
