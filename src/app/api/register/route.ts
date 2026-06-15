import { NextResponse } from "next/server";
import argon2 from "argon2";

import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { createVerificationToken, VERIFICATION_TTL_MS } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs"; // argon2 — нативный модуль, нужен Node-рантайм

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Единый нейтральный ответ — не раскрываем, занят ли email (анти-enumeration).
const NEUTRAL = NextResponse.json({
  ok: true,
  message: "Если адрес свободен, на него отправлено письмо с подтверждением.",
});

export async function POST(req: Request) {
  // Rate limit: 5 регистраций в час на IP.
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Слишком много попыток. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Некорректный email." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Пароль — минимум 8 символов." },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({ where: { email } });

  // Уже есть и подтверждён — молча отдаём нейтральный ответ (не палим аккаунт).
  if (existing?.emailVerified) return NEUTRAL;

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // Создаём нового либо обновляем хеш у неподтверждённого (повторная попытка).
  const user = existing
    ? await db.user.update({ where: { email }, data: { passwordHash } })
    : await db.user.create({ data: { email, passwordHash } });

  // Свежий токен: старые для этого email удаляем.
  const { token, tokenHash } = createVerificationToken();
  await db.verificationToken.deleteMany({ where: { identifier: email } });
  await db.verificationToken.create({
    data: {
      identifier: email,
      token: tokenHash,
      expires: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  });

  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${base}/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    // Если SMTP не настроен/упал — откатываем токен, сообщаем честно.
    console.error("sendVerificationEmail failed:", err);
    await db.verificationToken.deleteMany({ where: { identifier: email } });
    return NextResponse.json(
      { ok: false, error: "Не удалось отправить письмо. Проверьте настройки почты." },
      { status: 500 },
    );
  }

  void user;
  return NEUTRAL;
}
