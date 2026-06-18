import Link from "next/link";
import OnlineCount from "@/components/dashboard/OnlineCount";
import Equalizer from "@/components/dashboard/Equalizer";
import DailyClaim from "@/components/dashboard/DailyClaim";
import Badges from "@/components/badges/Badges";
import Avatar from "@/components/avatar/Avatar";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAvatar } from "@/lib/avatar";
import { canClaim } from "@/lib/daily";

// Главный экран панели — живые виджеты + ссылки на инструменты.
export default async function DashboardPage() {
  const session = await auth();
  const me = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          points: true,
          streak: true,
          lastClaimAt: true,
          badges: { select: { key: true } },
        },
      })
    : null;

  // Топ-10 по баллам (только публичные — с ником).
  const top = await db.user.findMany({
    where: { username: { not: null } },
    orderBy: { points: "desc" },
    take: 10,
    select: {
      id: true,
      username: true,
      shortId: true,
      avatar: true,
      points: true,
      badges: { select: { key: true } },
    },
  });

  const modules = [
    { name: "img2ascii", desc: "image → ASCII art", href: "/dashboard/ascii", soon: false },
    { name: "notes", desc: "notes / journal", href: null, soon: true },
    { name: "links", desc: "private links", href: null, soon: true },
    { name: "files", desc: "storage", href: null, soon: true },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl text-fg">
            <span className="text-accent">$</span> dashboard
          </h1>
          <p className="mt-1 text-sm text-fg-dim">welcome back.</p>
        </div>
        <OnlineCount />
      </header>

      {me && (
        <div className="flex flex-wrap items-center gap-5 rounded-lg border border-white/10 bg-bg-soft/50 p-4">
          <div>
            <div className="font-mono text-2xl text-accent">{me.points}</div>
            <div className="text-xs text-fg-dim">points</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs text-fg-dim">badges</div>
            {me.badges.length > 0 ? (
              <Badges keys={me.badges.map((b) => b.key)} size={18} />
            ) : (
              <span className="text-xs text-fg-dim">none yet — explore the site to earn them</span>
            )}
          </div>
        </div>
      )}

      {me && <DailyClaim claimable={canClaim(me.lastClaimAt)} streak={me.streak} />}

      <Equalizer />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {modules.map((m) => {
          const card = (
            <div className="h-full rounded-lg border border-white/10 bg-bg-soft/50 p-4 transition-colors hover:border-accent/30">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-fg">{m.name}</span>
                {m.soon ? (
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-fg-dim">
                    soon
                  </span>
                ) : (
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                    open
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-fg-dim">{m.desc}</p>
            </div>
          );
          return m.href ? (
            <Link key={m.name} href={m.href}>
              {card}
            </Link>
          ) : (
            <div key={m.name}>{card}</div>
          );
        })}
      </div>

      <section>
        <h2 className="mb-2 font-mono text-sm text-fg-dim">
          <span className="text-accent">$</span> leaderboard
        </h2>
        <div className="overflow-hidden rounded-lg border border-white/10 bg-bg-soft/40">
          {top.length === 0 && <p className="p-3 text-xs text-fg-dim">no players yet</p>}
          {top.map((u, i) => {
            const seed = u.shortId ?? u.username ?? u.id;
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0"
              >
                <span className="w-5 text-right font-mono text-xs text-fg-dim">{i + 1}</span>
                <Avatar config={parseAvatar(u.avatar, seed)} size={28} />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">
                  <Link href={`/u/${u.username}`} className="hover:text-accent hover:underline">
                    @{u.username}
                  </Link>
                  <span className="ml-1.5 align-middle">
                    <Badges keys={u.badges.map((b) => b.key)} size={11} />
                  </span>
                </span>
                <span className="font-mono text-sm text-accent-amber">{u.points}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
