"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Avatar from "@/components/avatar/Avatar";
import type { AvatarConfig } from "@/lib/avatar";

// Терминальный сайдбар. Активный пункт подсвечен «> », как курсор в меню.
const NAV = [
  { href: "/dashboard", label: "overview", cmd: "~/" },
  { href: "/dashboard/chat", label: "chat", cmd: "~/chat" },
  { href: "/dashboard/avatar", label: "avatar", cmd: "~/avatar" },
  { href: "/dashboard/ascii", label: "img2ascii", cmd: "~/ascii" },
  { href: "/dashboard/settings", label: "settings", cmd: "~/settings" },
];

export default function Sidebar({
  email,
  username,
  shortId,
  avatar,
}: {
  email: string;
  username: string | null;
  shortId: string | null;
  avatar: AvatarConfig;
}) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  // Опрос непрочитанных для бейджа на пункте chat.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/chat/unread");
        const data = await res.json();
        if (alive && data.ok) setUnread(data.total ?? data.count ?? 0);
      } catch {
        /* ignore */
      }
    };
    poll();
    const i = setInterval(poll, 10000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, [pathname]);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-bg-soft/60 p-4">
      <div className="mb-6 flex items-center gap-3">
        <Avatar config={avatar} size={40} />
        <div className="min-w-0">
          <div className="truncate text-sm text-fg" title={email}>
            {username ? `@${username}` : "klebold.xyz"}
          </div>
          {shortId && (
            <div className="font-mono text-[11px] text-fg-dim">#{shortId}</div>
          )}
        </div>
      </div>

      <nav className="flex flex-col gap-1 text-sm">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded px-2 py-1.5 font-mono transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-fg-dim hover:bg-white/5 hover:text-fg"
              }`}
            >
              <span className="mr-1 text-accent">{active ? ">" : " "}</span>
              {item.label}
              {item.href === "/dashboard/chat" && unread > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-bold text-bg">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ redirectTo: "/" })}
        className="mt-auto rounded px-2 py-1.5 text-left font-mono text-sm text-fg-dim transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <span className="mr-1">⏻</span> logout
      </button>
    </aside>
  );
}
