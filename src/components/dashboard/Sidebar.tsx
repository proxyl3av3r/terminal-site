"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

// Терминальный сайдбар. Активный пункт подсвечен «> », как курсор в меню.
const NAV = [
  { href: "/dashboard", label: "overview", cmd: "~/" },
  { href: "/dashboard/settings", label: "settings", cmd: "~/settings" },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-bg-soft/60 p-4">
      <div className="mb-6">
        <div className="text-sm text-accent">klebold.xyz</div>
        <div className="mt-1 truncate text-xs text-fg-dim" title={email}>
          {email}
        </div>
      </div>

      <nav className="flex flex-col gap-1 text-sm">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-2 py-1.5 font-mono transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-fg-dim hover:bg-white/5 hover:text-fg"
              }`}
            >
              <span className="mr-1 text-accent">{active ? ">" : " "}</span>
              {item.label}
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
