import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CAT_OPTIONS, optionKey, type AvatarCat } from "@/lib/avatar";

export const runtime = "nodejs";

const CATS: AvatarCat[] = ["color", "bg", "eyes", "mouth"];

// Разблокировать платную опцию аватара за баллы. Списывает cost, добавляет ключ.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { cat?: string; index?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const cat = body.cat as AvatarCat;
  const index = Number(body.index);
  if (!CATS.includes(cat) || !Number.isInteger(index)) {
    return NextResponse.json({ ok: false, error: "bad option" }, { status: 400 });
  }
  const option = CAT_OPTIONS[cat][index];
  if (!option) return NextResponse.json({ ok: false, error: "no such option" }, { status: 400 });
  if (option.free) return NextResponse.json({ ok: false, error: "already free" }, { status: 400 });

  const key = optionKey(cat, index);
  const cost = option.cost ?? 0;

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { points: true, unlocks: true },
  });
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  if (me.unlocks.includes(key)) {
    return NextResponse.json({ ok: true, points: me.points, unlocks: me.unlocks });
  }
  if (me.points < cost) {
    return NextResponse.json({ ok: false, error: "not enough points" }, { status: 402 });
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { points: { decrement: cost }, unlocks: { push: key } },
    select: { points: true, unlocks: true },
  });

  return NextResponse.json({ ok: true, points: updated.points, unlocks: updated.unlocks });
}
