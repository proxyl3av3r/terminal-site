import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMembership, canManage, newInviteToken } from "@/lib/chat";

export const runtime = "nodejs";

// Сгенерировать (или перегенерировать → отозвать старую) invite-ссылку. admin+.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
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

  // Уникальность гарантирует @unique-индекс; на редкую коллизию — пара ретраев.
  let token = newInviteToken();
  for (let i = 0; i < 3; i++) {
    try {
      await db.conversation.update({ where: { id: params.id }, data: { inviteToken: token } });
      return NextResponse.json({ ok: true, token });
    } catch {
      token = newInviteToken();
    }
  }
  return NextResponse.json({ ok: false, error: "try again" }, { status: 500 });
}

// Отозвать invite-ссылку. admin+.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const me = await getMembership(params.id, session.user.id);
  if (!me || me.state !== "accepted") return NextResponse.json({ ok: false }, { status: 403 });
  if (!canManage(me.role)) {
    return NextResponse.json({ ok: false, error: "not allowed" }, { status: 403 });
  }

  await db.conversation.update({ where: { id: params.id }, data: { inviteToken: null } });
  return NextResponse.json({ ok: true });
}
