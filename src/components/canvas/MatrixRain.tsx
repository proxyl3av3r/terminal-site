"use client";

import { useEffect, useRef } from "react";

// Фон: вертикальные колонки «падающего кода» с глубиной (параллакс) и
// подсветкой символов рядом с курсором. Всё на одном canvas + RAF.
// Уважает prefers-reduced-motion: рисует статичный кадр без анимации.

const GLYPHS =
  "01{}[]()<>/\\|=+-*&^%$#@!?;:.,abcdefghijklmnopqrstuvwxyz0123456789";

interface Column {
  x: number;
  y: number; // позиция головы потока (px)
  speed: number; // px/кадр
  fontSize: number; // влияет на глубину/яркость
  chars: string[];
  len: number; // длина хвоста
}

export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let columns: Column[] = [];
    let raf = 0;

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function build() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const colWidth = 16;
      const count = Math.floor(w / colWidth);
      columns = Array.from({ length: count }, (_, i): Column => {
        const fontSize = rnd(11, 18);
        return {
          x: i * colWidth + colWidth / 2,
          y: rnd(-h, 0),
          speed: reduced ? 0 : rnd(0.6, 2.2) * (fontSize / 14),
          fontSize,
          len: Math.floor(rnd(6, 22)),
          chars: Array.from({ length: 24 }, () =>
            GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          ),
        };
      });
    }

    function draw() {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Полупрозрачная заливка создаёт «шлейф» затухания.
      ctx!.fillStyle = "rgba(10,10,10,0.22)";
      ctx!.fillRect(0, 0, w, h);

      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (const col of columns) {
        const depth = col.fontSize / 18; // 0..1, ближе = ярче
        ctx!.font = `${col.fontSize}px var(--font-mono), monospace`;

        for (let k = 0; k < col.len; k++) {
          const cy = col.y - k * col.fontSize;
          if (cy < -col.fontSize || cy > h) continue;

          // Иногда подменяем символ — «мерцание» потока.
          const idx = (k + Math.floor(col.y / col.fontSize)) % col.chars.length;
          if (Math.random() < 0.02) {
            col.chars[idx] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
          const ch = col.chars[idx];

          // Близость к курсору → подсветка (янтарь) и лёгкий «магнит».
          const dx = col.x - mx;
          const dy = cy - my;
          const dist2 = dx * dx + dy * dy;
          const near = dist2 < 14000;

          let alpha = (1 - k / col.len) * (0.35 + depth * 0.5);
          if (k === 0) {
            // голова потока — самая яркая
            ctx!.fillStyle = near ? "#ffd24d" : "#d8ffd0";
            alpha = 0.9;
          } else if (near) {
            ctx!.fillStyle = "#ffb000";
            alpha = Math.min(1, alpha + 0.4);
          } else {
            ctx!.fillStyle = "#39ff14";
          }
          ctx!.globalAlpha = alpha;

          const ox = near ? -dx * 0.02 : 0; // лёгкое притяжение к курсору
          ctx!.fillText(ch, col.x + ox, cy);
        }

        col.y += col.speed;
        if (col.y - col.len * col.fontSize > h) {
          col.y = rnd(-h * 0.3, 0);
          col.speed = reduced ? 0 : rnd(0.6, 2.2) * (col.fontSize / 14);
        }
      }
      ctx!.globalAlpha = 1;

      if (!reduced) raf = requestAnimationFrame(draw);
    }

    build();
    draw(); // один кадр даже при reduced-motion

    const onResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      build();
    };
    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    const onLeave = () => {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
