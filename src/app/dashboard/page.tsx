import Link from "next/link";
import OnlineCount from "@/components/dashboard/OnlineCount";
import Equalizer from "@/components/dashboard/Equalizer";

// Главный экран панели — живые виджеты + ссылки на инструменты.
export default function DashboardPage() {
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
    </div>
  );
}
