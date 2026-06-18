import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMembership } from "@/lib/chat";
import { rateLimit } from "@/lib/ratelimit";
import { isAllowedReaction } from "@/lib/reactions";
import { notifyRealtime, convRoom } from "@/lib/realtime";

export const runtime = "nodejs";

// Тоггл эмодзи-реакции на сообщение. Повторный клик той же реакцией её снимает.
// Возвращает свежий список реакций сообщения; realtime рассылает его в комнату.
export async function POST(
  req: Request,
  { params }: { params: { id: string; messageId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  // Реагировать может только участник принятого диалога.
  const me = await getMembership(params.id, session.user.id);
  if (!me || me.state !== "accepted") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const rl = rateLimit(`react:${session.user.id}`, 120, 60 * 1000); // 120/мин
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "slow down" }, { status: 429 });
  }

  let body: { emoji?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const emoji = String(body.emoji ?? "");
  if (!isAllowedReaction(emoji)) {
    return NextResponse.json({ ok: false, error: "bad emoji" }, { status: 400 });
  }

  // Сообщение должно принадлежать этому диалогу.
  const msg = await db.message.findUnique({
    where: { id: params.messageId },
    select: { conversationId: true },
  });
  if (!msg || msg.conversationId !== params.id) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // Toggle: есть моя такая реакция → снять, иначе поставить.
  const existing = await db.messageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId: params.messageId,
        userId: session.user.id,
        emoji,
      },
    },
    select: { id: true },
  });
  if (existing) {
    await db.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await db.messageReaction.create({
      data: { messageId: params.messageId, userId: session.user.id, emoji },
    });
  }

  const reactions = await db.messageReaction.findMany({
    where: { messageId: params.messageId },
    select: { emoji: true, userId: true },
  });

  // Открытым переписям — обновить реакции конкретного сообщения.
  void notifyRealtime([convRoom(params.id)], "reaction", {
    conversationId: params.id,
    messageId: params.messageId,
    reactions,
  });

  return NextResponse.json({ ok: true, reactions });
}
