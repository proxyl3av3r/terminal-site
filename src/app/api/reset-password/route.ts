import { NextResponse } from "next/server";
import argon2 from "argon2";

import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { hashToken, RESET_PREFIX } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rl = rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: { token?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");

  if (!token || !email) {
    return NextResponse.json({ ok: false, error: "Invalid link." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const identifier = `${RESET_PREFIX}${email}`;
  const record = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: hashToken(token) } },
  });
  if (!record) {
    return NextResponse.json(
      { ok: false, error: "Invalid or already used link." },
      { status: 400 },
    );
  }
  if (record.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { identifier } });
    return NextResponse.json(
      { ok: false, error: "Link expired. Request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.user.update({ where: { email }, data: { passwordHash } });
  await db.verificationToken.deleteMany({ where: { identifier } });

  return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
}
