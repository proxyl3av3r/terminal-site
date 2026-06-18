"use client";

import { useEffect, useState } from "react";

// «Now playing» на публичном профиле. Поллит публичный эндпоинт (только трек,
// без токенов). Если ничего не играет — компактная заглушка.
interface NP {
  isPlaying?: boolean;
  title?: string;
  artist?: string;
  albumArt?: string;
}

export default function PublicNowPlaying({ username }: { username: string }) {
  const [np, setNp] = useState<NP | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/u/${encodeURIComponent(username)}/now-playing`);
        const data = await res.json();
        if (alive && data.ok) setNp(data);
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [username]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
      {np?.isPlaying && np.albumArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={np.albumArt} alt="" className="h-12 w-12 shrink-0 rounded border border-white/10" />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded border border-white/10 bg-black/40 font-mono text-accent">
          ♪
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate font-mono text-sm text-fg">
          {np?.isPlaying && (
            <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#1db954]" />
          )}
          <span className="truncate">{np?.isPlaying ? np.title : "nothing playing"}</span>
        </div>
        {np?.isPlaying && (
          <div className="truncate text-xs text-fg-dim">{np.artist}</div>
        )}
      </div>
    </div>
  );
}
