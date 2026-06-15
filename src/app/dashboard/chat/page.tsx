import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import ChatClient from "@/components/chat/ChatClient";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true },
  });

  // Без ника нельзя общаться (тебя ищут по нему) — направляем в настройки.
  if (!me?.username) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-mono text-xl text-fg">
          <span className="text-accent">$</span> chat
        </h1>
        <p className="mt-3 text-sm text-fg-dim">
          pick a username first so others can find you →{" "}
          <a href="/dashboard/settings" className="text-accent underline">
            settings
          </a>
        </p>
      </div>
    );
  }

  return <ChatClient meId={me.id} meUsername={me.username} />;
}
