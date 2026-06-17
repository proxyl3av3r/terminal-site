import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAvatar } from "@/lib/avatar";
import AvatarEditor from "@/components/dashboard/AvatarEditor";

export default async function AvatarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatar: true, points: true, unlocks: true },
  });
  const config = parseAvatar(user?.avatar ?? null, session.user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl text-fg">
            <span className="text-accent">$</span> avatar
          </h1>
          <p className="mt-1 text-sm text-fg-dim">
            customize your character. some options unlock with points.
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-bg-soft/50 px-4 py-2 font-mono text-sm">
          <span className="text-accent-amber">{user?.points ?? 0}</span>{" "}
          <span className="text-fg-dim">pts</span>
        </div>
      </header>

      <AvatarEditor
        initial={config}
        points={user?.points ?? 0}
        unlocks={user?.unlocks ?? []}
      />
    </div>
  );
}
