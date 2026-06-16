import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Sidebar from "@/components/dashboard/Sidebar";
import MobileNav from "@/components/dashboard/MobileNav";
import { parseAvatar } from "@/lib/avatar";

// Защищённый layout. middleware уже не пускает анонимов, но дублируем проверку
// на сервере (defense in depth) и берём профиль для сайдбара.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, username: true, shortId: true, avatar: true },
  });
  const avatarConfig = parseAvatar(user?.avatar ?? null, session.user.id);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        email={user?.email ?? ""}
        username={user?.username ?? null}
        shortId={user?.shortId ?? null}
        avatar={avatarConfig}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          username={user?.username ?? null}
          shortId={user?.shortId ?? null}
          avatar={avatarConfig}
        />
        <div className="flex-1 overflow-x-hidden p-4 pb-20 md:p-8 md:pb-8">
          {!user?.username && (
            <div className="mb-6 rounded-lg border border-accent-amber/40 bg-accent-amber/10 px-4 py-3 text-sm text-accent-amber">
              pick a username to unlock invites & chat →{" "}
              <Link href="/dashboard/settings" className="underline">
                settings
              </Link>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
