import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAdmin } from "@/lib/admin";
import { awardBadge } from "@/lib/award";
import { BADGES } from "@/lib/badges";

export const runtime = "nodejs";

// Выдать/снять значок пользователю. Только супер-админ.
// body: { key: string, action: "grant" | "revoke" }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  let body: { key?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const key = String(body.key ?? "");
  if (!BADGES[key]) {
    return NextResponse.json({ ok: false, error: "unknown badge" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!target) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  if (body.action === "revoke") {
    await db.userBadge
      .delete({ where: { userId_key: { userId: params.id, key } } })
      .catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // grant (идемпотентно; ачивки начислят points при первой выдаче)
  await awardBadge(params.id, key);
  return NextResponse.json({ ok: true });
}
