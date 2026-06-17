import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayNum, claimReward } from "@/lib/daily";

export const runtime = "nodejs";

// Получить ежедневный бонус. Стрик растёт, если вчера уже забирал; иначе сброс.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { points: true, streak: true, lastClaimAt: true },
  });
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const now = new Date();
  const today = dayNum(now);
  const last = me.lastClaimAt ? dayNum(me.lastClaimAt) : null;

  if (last === today) {
    return NextResponse.json({ ok: false, error: "already claimed today" }, { status: 409 });
  }

  const streak = last === today - 1 ? me.streak + 1 : 1;
  const reward = claimReward(streak);

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { points: { increment: reward }, streak, lastClaimAt: now },
    select: { points: true, streak: true },
  });

  return NextResponse.json({
    ok: true,
    reward,
    points: updated.points,
    streak: updated.streak,
  });
}
