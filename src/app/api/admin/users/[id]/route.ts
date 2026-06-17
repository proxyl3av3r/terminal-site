import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAdmin, isSuperAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Удалить учётку пользователя. Только супер-админ; нельзя удалить себя или
// другого супер-админа. Каскадом снесёт сообщения/членства/2FA/сессии.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  if (params.id === admin.id) {
    return NextResponse.json({ ok: false, error: "cannot delete yourself" }, { status: 400 });
  }

  const target = await db.user.findUnique({
    where: { id: params.id },
    select: { email: true },
  });
  if (!target) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (isSuperAdmin(target.email)) {
    return NextResponse.json({ ok: false, error: "cannot delete another admin" }, { status: 403 });
  }

  // verification_tokens привязаны по email (без FK) — чистим вручную.
  await db.verificationToken.deleteMany({ where: { identifier: target.email } });
  await db.user.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
