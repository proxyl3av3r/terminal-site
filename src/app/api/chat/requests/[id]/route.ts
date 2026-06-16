import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberState } from "@/lib/chat";

export const runtime = "nodejs";

// Принять или отклонить входящий запрос на чат.
// body: { action: "accept" | "decline" }
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  // Действие доступно только если у меня действительно pending-запрос.
  if ((await memberState(params.id, me)) !== "pending") {
    return NextResponse.json({ ok: false, error: "no such request" }, { status: 404 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (body.action === "accept") {
    await db.conversationMember.update({
      where: { conversationId_userId: { conversationId: params.id, userId: me } },
      data: { state: "accepted" },
    });
    return NextResponse.json({ ok: true, accepted: true });
  }

  if (body.action === "decline") {
    // Отклоняем DM-запрос — удаляем диалог целиком (каскадом и сообщения).
    await db.conversation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true, declined: true });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
