import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isMember, MAX_TEXT, MAX_ASCII } from "@/lib/chat";

export const runtime = "nodejs";

// История сообщений (новые внизу). ?before=<iso> для подгрузки старых.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  if (!(await isMember(params.id, session.user.id))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const before = new URL(req.url).searchParams.get("before");
  const messages = await db.message.findMany({
    where: {
      conversationId: params.id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      senderId: true,
      sender: { select: { username: true, shortId: true, avatar: true } },
    },
  });

  // Отметим прочтение.
  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true, messages: messages.reverse() });
}

// Отправить сообщение (text | ascii). Возвращает созданное сообщение.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  if (!(await isMember(params.id, session.user.id))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const rl = rateLimit(`msg:${session.user.id}`, 60, 60 * 1000); // 60/мин
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "slow down" }, { status: 429 });
  }

  let body: { kind?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const kind = body.kind === "ascii" ? "ascii" : "text";
  const text = String(body.body ?? "");
  const limit = kind === "ascii" ? MAX_ASCII : MAX_TEXT;
  if (!text.trim() || text.length > limit) {
    return NextResponse.json({ ok: false, error: "empty or too long" }, { status: 400 });
  }

  const msg = await db.message.create({
    data: { conversationId: params.id, senderId: session.user.id, kind, body: text },
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      senderId: true,
      sender: { select: { username: true, shortId: true, avatar: true } },
    },
  });

  return NextResponse.json({ ok: true, message: msg });
}
