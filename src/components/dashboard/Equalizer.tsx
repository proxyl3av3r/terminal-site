"use client";

import { useEffect, useRef, useState } from "react";

// «Now playing» из Spotify пользователя + анимированный эквалайзер.
// Если Spotify не подключён — показываем кнопку connect. Когда ничего не
// играет — полосы замирают. Секреты/токены на клиент не приходят.
const BARS = 28;

interface NP {
  configured?: boolean;
  connected: boolean;
  isPlaying?: boolean;
  title?: string;
  artist?: string;
  albumArt?: string;
  songUrl?: string;
}

export default function Equalizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [np, setNp] = useState<NP | null>(null);
  const playingRef = useRef(false);

  // Опрос текущего трека.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/now-playing");
        const data = await res.json();
        if (alive && data.ok) {
          setNp(data);
          playingRef.current = !!data.isPlaying;
        }
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
  }, []);

  // Анимация полос (двигается только когда играет музыка).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    const heights = new Array(BARS).fill(0).map(() => Math.random());
    const targets = heights.slice();

    const accent = () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim()
        .replace(/\s+/g, ",") || "57,255,20";

    function resize() {
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    let frame = 0;
    function draw() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      ctx!.clearRect(0, 0, w, h);
      const gap = 3;
      const bw = (w - gap * (BARS - 1)) / BARS;
      const col = accent();
      const active = playingRef.current && !reduced;

      if (active && frame % 9 === 0) {
        for (let i = 0; i < BARS; i++) targets[i] = 0.15 + Math.random() * 0.85;
      } else if (!active) {
        for (let i = 0; i < BARS; i++) targets[i] = 0.08;
      }
      frame++;

      for (let i = 0; i < BARS; i++) {
        heights[i] += (targets[i] - heights[i]) * 0.18;
        const bh = Math.max(2, heights[i] * h);
        ctx!.fillStyle = `rgba(${col}, ${0.3 + heights[i] * 0.7})`;
        ctx!.fillRect(i * (bw + gap), h - bh, bw, bh);
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  async function disconnect() {
    await fetch("/api/spotify/disconnect", { method: "POST" });
    setNp({ connected: false });
    playingRef.current = false;
  }

  return (
    <div className="rounded-lg border border-white/10 bg-bg-soft/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {np?.albumArt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={np.albumArt}
              alt=""
              className="h-12 w-12 shrink-0 rounded border border-white/10"
            />
          )}
          <div className="min-w-0">
            <div className="truncate font-mono text-sm text-fg">
              {np?.isPlaying ? np.title : "now playing"}
            </div>
            <div className="truncate text-xs text-fg-dim">
              {np?.connected
                ? np.isPlaying
                  ? np.artist
                  : "nothing playing"
                : np?.configured === false
                  ? "ambient · system idle"
                  : "spotify not connected"}
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {np && !np.connected && np.configured !== false ? (
            <a
              href="/api/spotify/connect"
              className="rounded border border-accent/40 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/10"
            >
              connect spotify
            </a>
          ) : np?.connected ? (
            <div className="flex gap-2">
              {np.songUrl && (
                <a
                  href={np.songUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-white/15 px-2 py-1 font-mono text-xs text-fg-dim hover:text-fg"
                >
                  open
                </a>
              )}
              <button
                onClick={disconnect}
                className="rounded border border-white/15 px-2 py-1 font-mono text-xs text-fg-dim hover:text-danger"
              >
                disconnect
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <canvas ref={canvasRef} className="h-20 w-full" />
    </div>
  );
}
