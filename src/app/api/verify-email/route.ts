import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";

// Подтверждение по ссылке из письма. Редиректим на главную с ?verified=...,
// чтобы терминал на главной показал результат.
export async function GET(req: Request) {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const redirect = (status: string) =>
    NextResponse.redirect(`${base}/?verified=${status}`);

  const rl = rateLimit(`verify:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!rl.success) return redirect("ratelimited");

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const email = (url.searchParams.get("email") ?? "").toLowerCase().trim();
  if (!token || !email) return redirect("invalid");

  const record = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: hashToken(token) } },
  });
  if (!record) return redirect("invalid");

  // Просрочен — чистим и сообщаем.
  if (record.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { identifier: email } });
    return redirect("expired");
  }

  await db.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });
  await db.verificationToken.deleteMany({ where: { identifier: email } });

  return redirect("success");
}
