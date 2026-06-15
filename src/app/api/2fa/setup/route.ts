import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSecret, buildOtpAuthUrl } from "@/lib/2fa";

export const runtime = "nodejs";

// Шаг 1 включения 2FA: генерируем секрет, отдаём QR + текстовый ключ.
// Секрет сохраняем, но twoFactorEnabled НЕ трогаем — включится после confirm.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (user.twoFactorEnabled) {
    return NextResponse.json(
      { ok: false, error: "2FA is already enabled. Disable it first." },
      { status: 400 },
    );
  }

  const secret = generateSecret();
  await db.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret },
  });

  const otpauthUrl = buildOtpAuthUrl(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    margin: 1,
    color: { dark: "#39ff14", light: "#0a0a0a" },
  });

  return NextResponse.json({
    ok: true,
    qr: qrDataUrl, // data:image/png;base64 — рисуем в <img>
    manualKey: secret, // для ручного ввода в Bitwarden
    otpauthUrl,
  });
}
