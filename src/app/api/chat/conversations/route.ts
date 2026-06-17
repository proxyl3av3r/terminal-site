import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findOrCreateDM } from "@/lib/chat";
import { notifyRealtime, userRoom } from "@/lib/realtime";
import { awardBadgeSafe } from "@/lib/award";

export const runtime = "nodejs";

// Список диалогов текущего пользователя (с участниками и последним сообщением).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  const rows = await db.conversation.findMany({
    // только принятые мной диалоги (входящие запросы — в /api/chat/requests)
    where: { members: { some: { userId: me, state: "accepted" } } },
    select: {
      id: true,
      isGroup: true,
      kind: true,
      name: true,
      members: {
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              username: true,
              shortId: true,
              avatar: true,
              badges: { select: { key: true } },
            },
          },
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
      kind: c.kind,
      name: c.name,
      // Моя роль — чтобы клиент решал, показывать ли композер/шестерёнку.
      myRole: c.members.find((m) => m.userId === me)?.role ?? "member",
      memberCount: c.members.length,
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

// Создать DM (targetUserId) или группу/канал (kind + name + memberIds[]).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  let body: {
    targetUserId?: string;
    isGroup?: boolean;
    kind?: string;
    name?: string;
    memberIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Тип: dm по умолчанию; group/channel — если явно передан (isGroup — legacy).
  const kind =
    body.kind === "channel" ? "channel" : body.kind === "group" || body.isGroup ? "group" : "dm";

  // ── DM ──
  if (kind === "dm") {
    const target = String(body.targetUserId ?? "");
    if (!target || target === me) {
      return NextResponse.json({ ok: false, error: "invalid target" }, { status: 400 });
    }
    const exists = await db.user.findUnique({ where: { id: target }, select: { id: true } });
    if (!exists) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });

    const { id, created } = await findOrCreateDM(me, target);
    // Новый запрос → у получателя обновляем вкладку requests и бейдж.
    if (created) void notifyRealtime([userRoom(target)], "request:new", { id });
    return NextResponse.json({ ok: true, id });
  }

  // ── Группа / канал ──
  const name = String(body.name ?? "").trim().slice(0, 60) || (kind === "channel" ? "channel" : "group");
  const ids = Array.from(new Set([me, ...(body.memberIds ?? []).map(String)]));
  if (ids.length < 2) {
    return NextResponse.json({ ok: false, error: "need at least one other member" }, { status: 400 });
  }
  // Только реально существующие пользователи.
  const valid = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const convo = await db.conversation.create({
    data: {
      isGroup: true,
      kind,
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
  // Участникам — обновить список диалогов.
  void notifyRealtime(
    valid.filter((u) => u.id !== me).map((u) => userRoom(u.id)),
    "conversation:bump",
    { conversationId: convo.id, senderId: me, last: null },
  );
  awardBadgeSafe(me, "group-founder");
  return NextResponse.json({ ok: true, id: convo.id });
}
