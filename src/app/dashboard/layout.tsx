import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Sidebar from "@/components/dashboard/Sidebar";

// Защищённый layout. middleware уже не пускает анонимов, но дублируем проверку
// на сервере (defense in depth) и берём email для сайдбара.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <div className="flex min-h-screen">
      <Sidebar email={session.user.email ?? ""} />
      <div className="flex-1 overflow-x-hidden p-8">{children}</div>
    </div>
  );
}
