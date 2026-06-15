"use client";

import { useEffect, useRef, useState } from "react";

// Декоративный эквалайзер. НЕ Spotify-интеграция: реальный «now playing»
// требует OAuth-токен на сервере (риск утечки — намеренно исключено).
// Здесь — самостоятельная анимация полос на canvas, тема-зависимый цвет.
const BARS = 28;

export default function Equalizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const heights = new Array(BARS).fill(0).map(() => Math.random());
    const targets = heights.slice();

    function accent() {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim()
        .replace(/\s+/g, ",");
      return v || "57,255,20";
    }

    function resize() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
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

      // каждые ~10 кадров задаём новые цели — «бит»
      if (!pausedRef.current && frame % 10 === 0) {
        for (let i = 0; i < BARS; i++) targets[i] = 0.15 + Math.random() * 0.85;
      }
      frame++;

      for (let i = 0; i < BARS; i++) {
        if (!reduced && !pausedRef.current) {
          heights[i] += (targets[i] - heights[i]) * 0.18;
        }
        const bh = Math.max(2, heights[i] * h);
        ctx!.fillStyle = `rgba(${col}, ${0.35 + heights[i] * 0.65})`;
        ctx!.fillRect(i * (bw + gap), h - bh, bw, bh);
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    }
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="rounded-lg border border-white/10 bg-bg-soft/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono text-sm text-fg">now playing</div>
          <div className="text-xs text-fg-dim">ambient · system idle</div>
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          className="rounded border border-white/15 px-2 py-1 font-mono text-xs text-fg-dim hover:text-fg"
        >
          {paused ? "▶ play" : "❚❚ pause"}
        </button>
      </div>
      <canvas ref={canvasRef} className="h-20 w-full" />
    </div>
  );
}
