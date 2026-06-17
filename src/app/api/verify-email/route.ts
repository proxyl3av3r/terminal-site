import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";

type VerifyStatus = "success" | "expired" | "invalid";

// Само подтверждение (побочный эффект). Вызывается ТОЛЬКО из POST (из браузера),
// чтобы префетч/сканеры почты, дёргающие ссылку GET-ом, не «съедали» токен.
async function verifyEmailToken(email: string, token: string): Promise<VerifyStatus> {
  if (!token || !email) return "invalid";

  const record = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: hashToken(token) } },
  });
  if (!record) return "invalid";

  if (record.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { identifier: email } });
    return "expired";
  }

  await db.user.update({ where: { email }, data: { emailVerified: new Date() } });
  await db.verificationToken.deleteMany({ where: { identifier: email } });
  return "success";
}

// GET — БЕЗ побочного эффекта: просто ведём на страницу подтверждения /verify.
// (Старые письма ссылались сюда; теперь это безопасный редирект, не трата токена.)
export async function GET(req: Request) {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const email = (url.searchParams.get("email") ?? "").toLowerCase().trim();
  const qs = new URLSearchParams({ token, email }).toString();
  return NextResponse.redirect(`${base}/verify?${qs}`);
}

// POST — фактическое подтверждение (дёргает страница /verify из браузера).
export async function POST(req: Request) {
  const rl = rateLimit(`verify:${clientIp(req)}`, 20, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ ok: false, status: "ratelimited" }, { status: 429 });
  }

  let body: { token?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, status: "invalid" }, { status: 400 });
  }

  const email = String(body.email ?? "").toLowerCase().trim();
  const token = String(body.token ?? "");
  const status = await verifyEmailToken(email, token);
  return NextResponse.json({ ok: status === "success", status });
}
