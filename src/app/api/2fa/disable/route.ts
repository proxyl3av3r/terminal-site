import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTOTP } from "@/lib/2fa";

export const runtime = "nodejs";

// Отключение 2FA: требуем действующий TOTP-код, чтобы это не мог сделать
// кто-то с просто открытой сессией. Чистим секрет и все backup-коды.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const code = String(body.code ?? "").replace(/\s+/g, "");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ ok: false, error: "2FA не включена." }, { status: 400 });
  }
  if (!verifyTOTP(code, user.twoFactorSecret)) {
    return NextResponse.json({ ok: false, error: "Неверный код." }, { status: 400 });
  }

  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
