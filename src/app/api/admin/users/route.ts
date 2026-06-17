import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAdmin, isSuperAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Список всех пользователей для админ-панели. Только супер-админ.
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const rows = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      username: true,
      shortId: true,
      emailVerified: true,
      twoFactorEnabled: true,
      points: true,
      createdAt: true,
      _count: { select: { messages: true, conversationMembers: true } },
    },
  });

  const users = rows.map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    shortId: u.shortId,
    verified: !!u.emailVerified,
    twoFactor: u.twoFactorEnabled,
    points: u.points,
    createdAt: u.createdAt,
    messages: u._count.messages,
    chats: u._count.conversationMembers,
    isAdmin: isSuperAdmin(u.email),
    isSelf: u.id === admin.id,
  }));

  return NextResponse.json({
    ok: true,
    users,
    stats: {
      total: users.length,
      verified: users.filter((u) => u.verified).length,
      twoFactor: users.filter((u) => u.twoFactor).length,
    },
  });
}
