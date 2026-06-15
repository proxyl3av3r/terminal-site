import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Сколько диалогов с непрочитанными (последнее сообщение от другого новее
// моего lastReadAt). Лёгкий запрос для бейджа в сайдбаре.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  const members = await db.conversationMember.findMany({
    where: { userId: me },
    select: { conversationId: true, lastReadAt: true },
  });

  let count = 0;
  for (const m of members) {
    const latest = await db.message.findFirst({
      where: { conversationId: m.conversationId, senderId: { not: me } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (latest && (!m.lastReadAt || latest.createdAt > m.lastReadAt)) count++;
  }

  return NextResponse.json({ ok: true, count });
}
