import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMembership, canDeleteMessage } from "@/lib/chat";
import { notifyRealtime, convRoom, userRoom } from "@/lib/realtime";

export const runtime = "nodejs";

// Удалить сообщение. Своё — всегда; чужое — moderator+.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; messageId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = await getMembership(params.id, session.user.id);
  if (!me || me.state !== "accepted") return NextResponse.json({ ok: false }, { status: 403 });

  const msg = await db.message.findUnique({
    where: { id: params.messageId },
    select: { id: true, senderId: true, conversationId: true },
  });
  if (!msg || msg.conversationId !== params.id) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  const isOwn = msg.senderId === session.user.id;
  if (!canDeleteMessage(me.role, isOwn)) {
    return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
  }

  await db.message.delete({ where: { id: params.messageId } });

  // Открытым переписям — убрать сообщение; всем — обновить превью в списке.
  void notifyRealtime([convRoom(params.id)], "message:deleted", {
    conversationId: params.id,
    messageId: params.messageId,
  });
  const members = await db.conversationMember.findMany({
    where: { conversationId: params.id },
    select: { userId: true },
  });
  void notifyRealtime(
    members.map((m) => userRoom(m.userId)),
    "conversation:bump",
    { conversationId: params.id, senderId: session.user.id, last: null },
  );
  return NextResponse.json({ ok: true });
}
