import { NextResponse } from "next/server";
import argon2 from "argon2";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTOTP, generateBackupCodes } from "@/lib/2fa";

export const runtime = "nodejs";

// Шаг 2 включения 2FA: проверяем первый код, включаем 2FA, выдаём backup-коды.
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
  if (!user?.twoFactorSecret) {
    return NextResponse.json(
      { ok: false, error: "Сначала запросите настройку (setup)." },
      { status: 400 },
    );
  }
  if (user.twoFactorEnabled) {
    return NextResponse.json({ ok: false, error: "2FA уже включена." }, { status: 400 });
  }
  if (!verifyTOTP(code, user.twoFactorSecret)) {
    return NextResponse.json(
      { ok: false, error: "Неверный код. Проверьте время на устройстве." },
      { status: 400 },
    );
  }

  // Генерируем и сохраняем backup-коды (хеши). Сырые отдаём один раз.
  const plainCodes = generateBackupCodes();
  const hashes = await Promise.all(
    plainCodes.map((c) => argon2.hash(c, { type: argon2.argon2id })),
  );

  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId: user.id } }),
    db.backupCode.createMany({
      data: hashes.map((codeHash) => ({ userId: user.id, codeHash })),
    }),
    db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    }),
  ]);

  return NextResponse.json({ ok: true, backupCodes: plainCodes });
}
