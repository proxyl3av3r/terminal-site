import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import {
  createVerificationToken,
  RESET_TTL_MS,
  RESET_PREFIX,
} from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Нейтральный ответ — не раскрываем, есть ли такой аккаунт (анти-enumeration).
const NEUTRAL = NextResponse.json({
  ok: true,
  message: "If the account exists, a reset link has been sent.",
});

export async function POST(req: Request) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const email = String(body.email ?? "").toLowerCase().trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  // Нет аккаунта или пароль не задан — молча отдаём нейтральный ответ.
  if (!user?.passwordHash) return NEUTRAL;

  const identifier = `${RESET_PREFIX}${email}`;
  const { token, tokenHash } = createVerificationToken();
  await db.verificationToken.deleteMany({ where: { identifier } });
  await db.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${base}/reset?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (err) {
    console.error("sendPasswordResetEmail failed:", err);
    await db.verificationToken.deleteMany({ where: { identifier } });
    return NextResponse.json(
      { ok: false, error: "Could not send the email. Check the mail settings." },
      { status: 500 },
    );
  }

  return NEUTRAL;
}
