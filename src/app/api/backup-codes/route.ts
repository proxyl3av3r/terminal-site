import { NextResponse } from "next/server";
import argon2 from "argon2";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateBackupCodes, verifyTOTP } from "@/lib/2fa";

export const runtime = "nodejs";

// Перевыпуск backup-кодов (старые аннулируются). Требует включённую 2FA И
// действующий TOTP-код — иначе тот, у кого просто украдена сессия, мог бы
// выпустить себе новые коды и получить постоянный обход 2FA. Тот же уровень
// проверки, что и /api/2fa/disable.
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
    return NextResponse.json({ ok: false, error: "2FA is not enabled." }, { status: 400 });
  }
  if (!verifyTOTP(code, user.twoFactorSecret)) {
    return NextResponse.json({ ok: false, error: "Invalid code." }, { status: 400 });
  }

  const plainCodes = generateBackupCodes();
  const hashes = await Promise.all(
    plainCodes.map((c) => argon2.hash(c, { type: argon2.argon2id })),
  );

  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId: user.id } }),
    db.backupCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
  ]);

  return NextResponse.json({ ok: true, backupCodes: plainCodes });
}
