import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import TwoFactorSetup from "@/components/dashboard/TwoFactorSetup";

// Серверный компонент: берём актуальный статус 2FA и отдаём клиентскому UI.
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-mono text-xl text-fg">
          <span className="text-accent">$</span> settings
        </h1>
        <p className="mt-1 text-sm text-fg-dim">безопасность аккаунта</p>
      </header>

      <TwoFactorSetup initialEnabled={user?.twoFactorEnabled ?? false} />
    </div>
  );
}
