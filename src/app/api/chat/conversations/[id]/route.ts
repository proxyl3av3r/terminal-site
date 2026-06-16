import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMembership, canManage, canRename, canDeleteConversation } from "@/lib/chat";
import { notifyRealtime, convRoom, userRoom } from "@/lib/realtime";

export const runtime = "nodejs";

/** userId всех участников (для адресной рассылки в их user-комнаты). */
async function memberRooms(conversationId: string): Promise<string[]> {
  const members = await db.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => userRoom(m.userId));
}

// Детали чата: тип, имя, участники с ролями, моя роль, invite-ссылка (admin+).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = await getMembership(params.id, session.user.id);
  if (!me || me.state !== "accepted") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const convo = await db.conversation.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      kind: true,
      isGroup: true,
      name: true,
      inviteToken: true,
      members: {
        select: {
          userId: true,
          role: true,
          user: { select: { username: true, shortId: true, avatar: true } },
        },
      },
    },
  });
  if (!convo) return NextResponse.json({ ok: false }, { status: 404 });

  return NextResponse.json({
    ok: true,
    conversation: {
      id: convo.id,
      kind: convo.kind,
      isGroup: convo.isGroup,
      name: convo.name,
      myRole: me.role,
      // Токен видят только те, кто может управлять (admin+).
      inviteToken: canManage(me.role) ? convo.inviteToken : null,
      members: convo.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        username: m.user.username,
        shortId: m.user.shortId,
        avatar: m.user.avatar,
      })),
    },
  });
}

// Переименовать группу/канал. admin+.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = await getMembership(params.id, session.user.id);
  if (!me || me.state !== "accepted") return NextResponse.json({ ok: false }, { status: 403 });
  if (!canRename(me.role)) {
    return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ ok: false, error: "empty name" }, { status: 400 });

  await db.conversation.update({ where: { id: params.id }, data: { name } });
  void notifyRealtime(
    [convRoom(params.id), ...(await memberRooms(params.id))],
    "conversation:updated",
    { conversationId: params.id },
  );
  return NextResponse.json({ ok: true, name });
}

// Удалить чат целиком. DM — любой участник; группа/канал — только owner.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = await getMembership(params.id, session.user.id);
  if (!me || me.state !== "accepted") return NextResponse.json({ ok: false }, { status: 403 });

  const convo = await db.conversation.findUnique({
    where: { id: params.id },
    select: { kind: true },
  });
  if (!convo) return NextResponse.json({ ok: false }, { status: 404 });
  if (!canDeleteConversation(convo.kind, me.role)) {
    return NextResponse.json({ ok: false, error: "only the owner can delete" }, { status: 403 });
  }

  const rooms = await memberRooms(params.id);
  await db.conversation.delete({ where: { id: params.id } }); // каскадом удалит сообщения/участников
  void notifyRealtime([convRoom(params.id), ...rooms], "conversation:removed", {
    conversationId: params.id,
  });
  return NextResponse.json({ ok: true });
}
