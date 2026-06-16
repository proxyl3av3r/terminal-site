import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyRealtime, convRoom, userRoom } from "@/lib/realtime";

export const runtime = "nodejs";

// Превью по invite-токену: имя, тип, число участников, состою ли уже.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const convo = await db.conversation.findUnique({
    where: { inviteToken: params.token },
    select: {
      id: true,
      kind: true,
      name: true,
      _count: { select: { members: true } },
      members: { where: { userId: session.user.id }, select: { userId: true } },
    },
  });
  if (!convo) return NextResponse.json({ ok: false, error: "invalid or revoked link" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    chat: {
      kind: convo.kind,
      name: convo.name,
      memberCount: convo._count.members,
      alreadyMember: convo.members.length > 0,
    },
  });
}

// Вступить по invite-токену. Возвращает id чата.
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  const convo = await db.conversation.findUnique({
    where: { inviteToken: params.token },
    select: { id: true, kind: true },
  });
  if (!convo || convo.kind === "dm") {
    return NextResponse.json({ ok: false, error: "invalid or revoked link" }, { status: 404 });
  }

  const existing = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: convo.id, userId: me } },
    select: { userId: true },
  });
  if (existing) return NextResponse.json({ ok: true, id: convo.id, joined: false });

  await db.conversationMember.create({
    data: { conversationId: convo.id, userId: me, role: "member" },
  });
  // Мне — чат в список; остальным — обновить состав.
  void notifyRealtime([userRoom(me)], "conversation:bump", {
    conversationId: convo.id,
    senderId: me,
    last: null,
  });
  void notifyRealtime([convRoom(convo.id)], "conversation:updated", { conversationId: convo.id });
  return NextResponse.json({ ok: true, id: convo.id, joined: true });
}
