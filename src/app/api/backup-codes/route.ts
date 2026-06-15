import { NextResponse } from "next/server";
import argon2 from "argon2";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateBackupCodes } from "@/lib/2fa";

export const runtime = "nodejs";

// Перевыпуск backup-кодов (старые аннулируются). Требует включённую 2FA.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.twoFactorEnabled) {
    return NextResponse.json({ ok: false, error: "2FA не включена." }, { status: 400 });
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
