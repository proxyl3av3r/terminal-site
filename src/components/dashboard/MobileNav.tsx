"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Avatar from "@/components/avatar/Avatar";
import type { AvatarConfig } from "@/lib/avatar";
import { NAV } from "@/components/dashboard/nav";
import { useUnread } from "@/components/dashboard/useUnread";

// Мобильная навигация: верхняя плашка профиля + нижний таб-бар (app-style).
// Видна только на мобиле/планшете (<md). Десктоп — Sidebar.
export default function MobileNav({
  username,
  shortId,
  avatar,
}: {
  username: string | null;
  shortId: string | null;
  avatar: AvatarConfig;
}) {
  const pathname = usePathname();
  const unread = useUnread();

  return (
    <>
      {/* верхняя плашка */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-bg/90 px-4 py-2.5 backdrop-blur md:hidden">
        <Avatar config={avatar} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-fg">
            {username ? `@${username}` : "klebold.xyz"}
          </div>
          {shortId && (
            <div className="font-mono text-[11px] text-fg-dim">#{shortId}</div>
          )}
        </div>
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          aria-label="logout"
          className="rounded px-2 py-1 font-mono text-xs text-fg-dim hover:text-danger"
        >
          ⏻
        </button>
      </header>

      {/* нижний таб-бар */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-white/10 bg-bg/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 font-mono text-[10px] transition-colors ${
                active ? "text-accent" : "text-fg-dim"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
              {item.href === "/dashboard/chat" && unread > 0 && (
                <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-accent px-1 text-[9px] font-bold text-bg">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
