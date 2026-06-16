import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMembership, canRemoveMember, canSetRole } from "@/lib/chat";
import { notifyRealtime, convRoom, userRoom } from "@/lib/realtime";

export const runtime = "nodejs";

async function otherMemberRooms(conversationId: string, exceptUserId?: string): Promise<string[]> {
  const members = await db.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members
    .map((m) => m.userId)
    .filter((id) => id !== exceptUserId)
    .map(userRoom);
}

// Удалить участника из группы/канала.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const meId = session.user.id;
  if (params.userId === meId) {
    return NextResponse.json({ ok: false, error: "use leave instead" }, { status: 400 });
  }

  const me = await getMembership(params.id, meId);
  const target = await getMembership(params.id, params.userId);
  if (!me || me.state !== "accepted") return NextResponse.json({ ok: false }, { status: 403 });
  if (!target) return NextResponse.json({ ok: false, error: "not a member" }, { status: 404 });
  if (!canRemoveMember(me.role, target.role)) {
    return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
  }

  await db.conversationMember.delete({
    where: { conversationId_userId: { conversationId: params.id, userId: params.userId } },
  });
  // Удалённому — убрать чат; остальным — обновить состав.
  void notifyRealtime([userRoom(params.userId)], "conversation:removed", {
    conversationId: params.id,
  });
  void notifyRealtime(
    [convRoom(params.id), ...(await otherMemberRooms(params.id, params.userId))],
    "conversation:updated",
    { conversationId: params.id },
  );
  return NextResponse.json({ ok: true });
}

// Сменить роль участника. role === "owner" — передача владения (только owner).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const meId = session.user.id;

  const me = await getMembership(params.id, meId);
  const target = await getMembership(params.id, params.userId);
  if (!me || me.state !== "accepted") return NextResponse.json({ ok: false }, { status: 403 });
  if (!target) return NextResponse.json({ ok: false, error: "not a member" }, { status: 404 });
  if (params.userId === meId) {
    return NextResponse.json({ ok: false, error: "cannot change own role" }, { status: 400 });
  }

  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const newRole = String(body.role ?? "");

  // ── Передача владения ──
  if (newRole === "owner") {
    if (me.role !== "owner") {
      return NextResponse.json({ ok: false, error: "only the owner can transfer" }, { status: 403 });
    }
    await db.$transaction([
      db.conversationMember.update({
        where: { conversationId_userId: { conversationId: params.id, userId: params.userId } },
        data: { role: "owner" },
      }),
      db.conversationMember.update({
        where: { conversationId_userId: { conversationId: params.id, userId: meId } },
        data: { role: "admin" },
      }),
    ]);
  } else {
    if (!canSetRole(me.role, target.role, newRole)) {
      return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
    }
    await db.conversationMember.update({
      where: { conversationId_userId: { conversationId: params.id, userId: params.userId } },
      data: { role: newRole },
    });
  }

  void notifyRealtime(
    [convRoom(params.id), ...(await otherMemberRooms(params.id))],
    "conversation:updated",
    { conversationId: params.id },
  );
  return NextResponse.json({ ok: true });
}
