import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Начислить/списать баллы пользователю (тест/модерация). Только супер-админ.
// body: { amount: number } — может быть отрицательным; итог не уходит ниже 0.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const amount = Math.trunc(Number(body.amount));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000) {
    return NextResponse.json({ ok: false, error: "bad amount" }, { status: 400 });
  }

  const target = await db.user.findUnique({
    where: { id: params.id },
    select: { points: true },
  });
  if (!target) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const points = Math.max(0, target.points + amount);
  await db.user.update({ where: { id: params.id }, data: { points } });

  return NextResponse.json({ ok: true, points });
}
