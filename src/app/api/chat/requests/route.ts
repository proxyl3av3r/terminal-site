import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Входящие запросы на чат: диалоги, где моё участие ещё pending.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = session.user.id;

  const rows = await db.conversation.findMany({
    where: { members: { some: { userId: me, state: "pending" } } },
    select: {
      id: true,
      isGroup: true,
      name: true,
      members: {
        where: { userId: { not: me } },
        select: {
          user: { select: { username: true, shortId: true, avatar: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, kind: true, createdAt: true },
      },
    },
  });

  const requests = rows.map((c) => ({
    id: c.id,
    isGroup: c.isGroup,
    name: c.name,
    from: c.members.map((m) => m.user),
    last: c.messages[0] ?? null,
  }));

  return NextResponse.json({ ok: true, requests });
}
