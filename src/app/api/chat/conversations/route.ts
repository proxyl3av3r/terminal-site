import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findOrCreateDM } from "@/lib/chat";

export const runtime = "nodejs";

// Список диалогов текущего пользователя (с участниками и последним сообщением).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  const rows = await db.conversation.findMany({
    where: { members: { some: { userId: me } } },
    select: {
      id: true,
      isGroup: true,
      name: true,
      members: {
        select: {
          userId: true,
          user: { select: { username: true, shortId: true, avatar: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, kind: true, createdAt: true, senderId: true },
      },
    },
  });

  // Сортируем по времени последнего сообщения (свежие сверху).
  const list = rows
    .map((c) => ({
      id: c.id,
      isGroup: c.isGroup,
      name: c.name,
      members: c.members.filter((m) => m.userId !== me).map((m) => m.user),
      last: c.messages[0] ?? null,
    }))
    .sort((a, b) => {
      const ta = a.last ? +new Date(a.last.createdAt) : 0;
      const tb = b.last ? +new Date(b.last.createdAt) : 0;
      return tb - ta;
    });

  return NextResponse.json({ ok: true, conversations: list });
}

// Создать DM (targetUserId) или группу (isGroup + name + memberIds[]).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  let body: { targetUserId?: string; isGroup?: boolean; name?: string; memberIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // ── DM ──
  if (!body.isGroup) {
    const target = String(body.targetUserId ?? "");
    if (!target || target === me) {
      return NextResponse.json({ ok: false, error: "invalid target" }, { status: 400 });
    }
    const exists = await db.user.findUnique({ where: { id: target }, select: { id: true } });
    if (!exists) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });

    const id = await findOrCreateDM(me, target);
    return NextResponse.json({ ok: true, id });
  }

  // ── Группа ──
  const name = String(body.name ?? "").trim().slice(0, 60) || "group";
  const ids = Array.from(new Set([me, ...(body.memberIds ?? []).map(String)]));
  if (ids.length < 2) {
    return NextResponse.json({ ok: false, error: "need at least one other member" }, { status: 400 });
  }
  // Только реально существующие пользователи.
  const valid = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const convo = await db.conversation.create({
    data: {
      isGroup: true,
      name,
      members: {
        create: valid.map((u) => ({
          userId: u.id,
          role: u.id === me ? "owner" : "member",
        })),
      },
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: convo.id });
}
