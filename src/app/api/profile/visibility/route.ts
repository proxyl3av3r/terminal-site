import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Переключить видимость «now playing» на публичном профиле.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { publicSpotify?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (typeof body.publicSpotify !== "boolean") {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { publicSpotify: body.publicSpotify },
    select: { publicSpotify: true },
  });
  return NextResponse.json({ ok: true, ...updated });
}
