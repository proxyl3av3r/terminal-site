import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import JoinInvite from "@/components/chat/JoinInvite";

// Страница вступления по invite-ссылке. Под /dashboard → middleware требует вход.
export default async function JoinPage({ params }: { params: { token: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return (
    <div className="mx-auto max-w-md">
      <JoinInvite token={params.token} />
    </div>
  );
}
