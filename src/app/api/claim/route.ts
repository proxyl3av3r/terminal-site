import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayNum, claimReward, startOfUtcDay } from "@/lib/daily";

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

  // Атомарная защита от гонки (double-spend): начисляем ТОЛЬКО если в БД
  // lastClaimAt всё ещё до начала сегодняшних суток (или null). Параллельные
  // запросы сериализуются на блокировке строки — выигрывает ровно один,
  // остальные получают count === 0.
  const res = await db.user.updateMany({
    where: {
      id: session.user.id,
      OR: [{ lastClaimAt: null }, { lastClaimAt: { lt: startOfUtcDay(now) } }],
    },
    data: { points: { increment: reward }, streak, lastClaimAt: now },
  });

  if (res.count === 0) {
    return NextResponse.json({ ok: false, error: "already claimed today" }, { status: 409 });
  }

  const updated = await db.user.findUnique({
    where: { id: session.user.id },
    select: { points: true, streak: true },
  });

  return NextResponse.json({
    ok: true,
    reward,
    points: updated?.points ?? me.points + reward,
    streak: updated?.streak ?? streak,
  });
}
