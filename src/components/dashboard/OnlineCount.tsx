"use client";

import { useEffect, useState } from "react";

// Пингует /api/presence каждые ~25с и показывает число онлайн.
export default function OnlineCount() {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        const res = await fetch("/api/presence", { method: "POST" });
        const data = await res.json();
        if (alive && data.ok) setOnline(data.online);
      } catch {
        /* offline — игнорируем */
      }
    };
    beat();
    const id = setInterval(beat, 25_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-bg-soft/50 px-4 py-3">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
      <span className="font-mono text-sm text-fg">
        {online === null ? "…" : online} online
      </span>
    </div>
  );
}
