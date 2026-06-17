"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DailyClaim({
  claimable,
  streak,
}: {
  claimable: boolean;
  streak: number;
}) {
  const [done, setDone] = useState(!claimable);
  const [curStreak, setCurStreak] = useState(streak);
  const [reward, setReward] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function claim() {
    setBusy(true);
    try {
      const res = await fetch("/api/claim", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setReward(data.reward);
        setCurStreak(data.streak);
        setDone(true);
        router.refresh();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-bg-soft/50 p-4">
      <div className="min-w-0">
        <div className="font-mono text-sm text-fg">
          <span className="text-accent">$</span> daily
        </div>
        <div className="mt-0.5 text-xs text-fg-dim">
          {done
            ? reward !== null
              ? `+${reward} pts · streak ${curStreak} · come back tomorrow`
              : `streak ${curStreak} · come back tomorrow`
            : curStreak > 0
              ? `streak ${curStreak} — keep it going`
              : "claim your first daily bonus"}
        </div>
      </div>
      <button
        onClick={claim}
        disabled={done || busy}
        className="shrink-0 rounded bg-accent px-3 py-1.5 font-mono text-xs text-bg disabled:cursor-default disabled:opacity-40"
      >
        {done ? "claimed ✓" : busy ? "…" : "claim"}
      </button>
    </div>
  );
}
