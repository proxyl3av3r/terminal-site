import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import TwoFactorSetup from "@/components/dashboard/TwoFactorSetup";
import ProfileSettings from "@/components/dashboard/ProfileSettings";
import SpotifyVisibilityToggle from "@/components/dashboard/SpotifyVisibilityToggle";

// Серверный компонент: берём актуальный статус 2FA и отдаём клиентскому UI.
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      twoFactorEnabled: true,
      username: true,
      shortId: true,
      publicSpotify: true,
      spotifyToken: true,
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-mono text-xl text-fg">
          <span className="text-accent">$</span> settings
        </h1>
        <p className="mt-1 text-sm text-fg-dim">account security</p>
      </header>

      <ProfileSettings
        initialUsername={user?.username ?? null}
        initialShortId={user?.shortId ?? null}
      />

      <section className="rounded-lg border border-white/10 bg-bg-soft/50 p-5">
        <h2 className="mb-1 font-mono text-sm text-fg">public profile</h2>
        {user?.username ? (
          <p className="mb-4 text-xs text-fg-dim">
            shareable at{" "}
            <Link href={`/u/${user.username}`} className="text-accent hover:underline">
              /u/{user.username}
            </Link>
          </p>
        ) : (
          <p className="mb-4 text-xs text-fg-dim">
            pick a username above to get a public profile.
          </p>
        )}
        <SpotifyVisibilityToggle
          initialEnabled={user?.publicSpotify ?? false}
          connected={!!user?.spotifyToken}
        />
      </section>

      <TwoFactorSetup initialEnabled={user?.twoFactorEnabled ?? false} />
    </div>
  );
}
