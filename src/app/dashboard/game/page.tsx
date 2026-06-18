import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import GameClient from "@/components/game/GameClient";

export default async function GamePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true },
  });

  // Игра использует ник для скорборда — без ника отправляем в настройки.
  if (!me?.username) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-mono text-xl text-fg">
          <span className="text-accent">$</span> рисуй и угадывай
        </h1>
        <p className="mt-3 text-sm text-fg-dim">
          сначала выбери ник, чтобы другие видели, кто рисует →{" "}
          <a href="/dashboard/settings" className="text-accent underline">
            настройки
          </a>
        </p>
      </div>
    );
  }

  return <GameClient meId={me.id} />;
}
