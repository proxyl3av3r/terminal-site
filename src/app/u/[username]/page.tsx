import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAvatar } from "@/lib/avatar";
import { normalizeUsername } from "@/lib/profile";
import { BADGES, sortBadgeKeys } from "@/lib/badges";
import Avatar from "@/components/avatar/Avatar";
import PublicNowPlaying from "@/components/profile/PublicNowPlaying";

export const runtime = "nodejs";

// Достать публичный профиль по нику (или null). cache() дедуплицирует вызов
// в рамках одного запроса (generateMetadata + сама страница).
const getProfile = cache(async function getProfile(usernameParam: string) {
  const username = normalizeUsername(decodeURIComponent(usernameParam));
  if (!username) return null;
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      shortId: true,
      avatar: true,
      points: true,
      streak: true,
      createdAt: true,
      publicSpotify: true,
      spotifyToken: true,
      badges: { select: { key: true } },
    },
  });
  if (!user || !user.username) return null;
  // Ранг среди публичных пользователей (как в лидерборде дашборда).
  const rank =
    (await db.user.count({
      where: { username: { not: null }, points: { gt: user.points } },
    })) + 1;
  return { user, rank };
});

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const data = await getProfile(params.username);
  if (!data) return { title: "user not found · klebold.xyz" };
  return {
    title: `@${data.user.username} · klebold.xyz`,
    description: `@${data.user.username} — ${data.user.points} pts · #${data.rank} on klebold.xyz`,
  };
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const data = await getProfile(params.username);
  if (!data) notFound();
  const { user, rank } = data;

  const session = await auth();
  const isMe = session?.user?.id === user.id;
  const badgeKeys = sortBadgeKeys(user.badges.map((b) => b.key));
  const showSpotify = user.publicSpotify && !!user.spotifyToken;

  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between font-mono text-xs text-fg-dim">
          <Link href="/" className="hover:text-accent">
            ← klebold.xyz
          </Link>
          {isMe && (
            <Link href="/dashboard/settings" className="hover:text-accent">
              edit profile →
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-bg-soft/50 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <Avatar
              config={parseAvatar(user.avatar, user.shortId ?? user.username!)}
              size={80}
            />
            <div className="min-w-0">
              <h1 className="truncate font-mono text-2xl text-fg">@{user.username}</h1>
              {user.shortId && (
                <p className="font-mono text-sm text-accent-amber">#{user.shortId}</p>
              )}
              <p className="mt-0.5 text-xs text-fg-dim">member since {fmtDate(user.createdAt)}</p>
            </div>
          </div>

          {/* статы */}
          <div className="mt-6 grid grid-cols-3 gap-2 text-center font-mono">
            <div className="rounded-lg border border-white/10 bg-black/30 py-3">
              <div className="text-xl text-accent">{user.points}</div>
              <div className="text-[11px] text-fg-dim">points</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 py-3">
              <div className="text-xl text-accent">#{rank}</div>
              <div className="text-[11px] text-fg-dim">rank</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 py-3">
              <div className="text-xl text-accent">{user.streak}🔥</div>
              <div className="text-[11px] text-fg-dim">streak</div>
            </div>
          </div>

          {/* значки */}
          {badgeKeys.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 font-mono text-xs text-fg-dim">$ badges</div>
              <div className="flex flex-wrap gap-2">
                {badgeKeys.map((k) => {
                  const b = BADGES[k];
                  if (!b) return null;
                  return (
                    <span
                      key={k}
                      title={b.desc}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-xs"
                    >
                      <span style={{ color: b.color }}>{b.glyph}</span>
                      <span className="text-fg">{b.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* now playing (если включено владельцем профиля) */}
          {showSpotify && (
            <div className="mt-6">
              <div className="mb-2 font-mono text-xs text-fg-dim">$ now playing</div>
              <PublicNowPlaying username={user.username!} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
