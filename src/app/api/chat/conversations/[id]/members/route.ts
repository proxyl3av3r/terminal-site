import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMembership, canManage } from "@/lib/chat";
import { notifyRealtime, convRoom, userRoom } from "@/lib/realtime";

export const runtime = "nodejs";

// Добавить участников в группу/канал. admin+.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = await getMembership(params.id, session.user.id);
  if (!me || me.state !== "accepted") return NextResponse.json({ ok: false }, { status: 403 });
  if (!canManage(me.role)) {
    return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
  }

  const convo = await db.conversation.findUnique({
    where: { id: params.id },
    select: { kind: true },
  });
  if (!convo || convo.kind === "dm") {
    return NextResponse.json({ ok: false, error: "not a group" }, { status: 400 });
  }

  let body: { memberIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const ids = Array.from(new Set((body.memberIds ?? []).map(String))).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "no users" }, { status: 400 });
  }

  // Только реально существующие и ещё-не-участники.
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const existing = await db.conversationMember.findMany({
    where: { conversationId: params.id, userId: { in: ids } },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((m) => m.userId));
  const toAdd = users.map((u) => u.id).filter((id) => !existingSet.has(id));
  if (toAdd.length === 0) {
    return NextResponse.json({ ok: true, added: 0 });
  }

  await db.conversationMember.createMany({
    data: toAdd.map((userId) => ({ conversationId: params.id, userId, role: "member" })),
  });

  // Новым — чат появляется в списке; всем — обновить состав.
  void notifyRealtime(
    toAdd.map(userRoom),
    "conversation:bump",
    { conversationId: params.id, senderId: session.user.id, last: null },
  );
  void notifyRealtime(
    [convRoom(params.id)],
    "conversation:updated",
    { conversationId: params.id },
  );
  return NextResponse.json({ ok: true, added: toAdd.length });
}
