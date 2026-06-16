import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMembership } from "@/lib/chat";
import { notifyRealtime, convRoom, userRoom } from "@/lib/realtime";

export const runtime = "nodejs";

// Выйти из чата. DM — удаляет диалог целиком. Группа/канал — снимает членство;
// owner не может выйти, пока есть другие участники (сначала передай владение
// или удали чат). Если участников не осталось — чат удаляется.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  const membership = await getMembership(params.id, me);
  if (!membership) return NextResponse.json({ ok: false }, { status: 403 });

  const convo = await db.conversation.findUnique({
    where: { id: params.id },
    select: { kind: true, members: { select: { userId: true } } },
  });
  if (!convo) return NextResponse.json({ ok: false }, { status: 404 });

  const otherIds = convo.members.map((m) => m.userId).filter((id) => id !== me);

  // DM или последний участник → удаляем чат целиком.
  if (convo.kind === "dm" || otherIds.length === 0) {
    await db.conversation.delete({ where: { id: params.id } });
    void notifyRealtime(
      [convRoom(params.id), userRoom(me), ...otherIds.map(userRoom)],
      "conversation:removed",
      { conversationId: params.id },
    );
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Owner с другими участниками — выйти нельзя (передай владение/удали).
  if (membership.role === "owner") {
    return NextResponse.json(
      { ok: false, error: "transfer ownership or delete the chat first" },
      { status: 409 },
    );
  }

  await db.conversationMember.delete({
    where: { conversationId_userId: { conversationId: params.id, userId: me } },
  });
  // Мне (на всех устройствах) — убрать из списка; остальным — обновить состав.
  void notifyRealtime([userRoom(me)], "conversation:removed", { conversationId: params.id });
  void notifyRealtime(
    [convRoom(params.id), ...otherIds.map(userRoom)],
    "conversation:updated",
    { conversationId: params.id },
  );
  return NextResponse.json({ ok: true });
}
