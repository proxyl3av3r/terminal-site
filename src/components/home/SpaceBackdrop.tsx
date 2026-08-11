"use client";

import { useEffect, useRef } from "react";

// Интерактивный космо-фон: картинка дня NASA (/api/apod) тремя слоями —
//  1) параллакс: космос чуть смещается за курсором (глубина),
//  2) прожектор: мягкая подсветка под курсором (screen-blend),
//  3) созвездия: канвас с мерцающими звёздами; рядом с курсором они соединяются
//     тонкими линиями и тянутся к нему.
// Рендерится только в режимах space/both (см. HomeClient) → в «дожде» не грузит.
// Уважает prefers-reduced-motion: статичный кадр без анимации и параллакса.
export default function SpaceBackdrop({ solo = false }: { solo?: boolean }) {
  const imgRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // акцент темы для линий-созвездий
    let accent = "57,255,20";
    const readAccent = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      if (v) accent = v.replace(/\s+/g, ",");
    };
    readAccent();

    interface Star { x: number; y: number; r: number; a: number; tw: number; ph: number; vx: number; vy: number }
    let stars: Star[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function build() {
      if (!canvas) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.floor((w * h) / 22000));
      stars = Array.from({ length: count }, (): Star => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rnd(0.4, 1.5),
        a: rnd(0.25, 0.8),
        tw: rnd(0.008, 0.03),
        ph: Math.random() * Math.PI * 2,
        vx: rnd(-0.05, 0.05),
        vy: rnd(-0.05, 0.05),
      }));
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const R = 160;
      const near: Star[] = [];

      for (const s of stars) {
        s.ph += s.tw;
        const tw = 0.55 + 0.45 * Math.sin(s.ph);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,255,220,${(s.a * tw).toFixed(3)})`;
        ctx.fill();

        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        if (dx * dx + dy * dy < R * R) near.push(s);

        if (!reduced) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < 0) s.x = w;
          else if (s.x > w) s.x = 0;
          if (s.y < 0) s.y = h;
          else if (s.y > h) s.y = 0;
        }
      }

      // линии: звезда → курсор и между близкими звёздами (созвездие)
      for (let i = 0; i < near.length; i++) {
        const a = near[i];
        const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        const al = (1 - d / R) * 0.5;
        ctx.strokeStyle = `rgba(${accent},${al.toFixed(3)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
        for (let j = i + 1; j < near.length; j++) {
          const b = near[j];
          const dd = Math.hypot(a.x - b.x, a.y - b.y);
          if (dd < R * 0.8) {
            ctx.strokeStyle = `rgba(${accent},${((1 - dd / (R * 0.8)) * 0.25).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    }

    let raf = 0;
    const applyPointer = () => {
      // параллакс базового слоя
      const px = mouse.x / window.innerWidth - 0.5;
      const py = mouse.y / window.innerHeight - 0.5;
      if (imgRef.current) imgRef.current.style.transform = `scale(1.08) translate(${(-px * 18).toFixed(1)}px, ${(-py * 18).toFixed(1)}px)`;
      // позиция прожектора
      if (spotRef.current) {
        spotRef.current.style.setProperty("--mx", mouse.x + "px");
        spotRef.current.style.setProperty("--my", mouse.y + "px");
      }
    };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!reduced) applyPointer();
    };
    const onResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      build();
    };

    build();
    applyPointer();
    draw();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    window.addEventListener("theme-change", readAccent);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("theme-change", readAccent);
    };
  }, [solo]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {/* 1) базовый космос с параллаксом */}
      <div
        ref={imgRef}
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/api/apod)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: solo
            ? "grayscale(0.15) brightness(0.9) contrast(1.05)"
            : "grayscale(0.5) brightness(0.7) contrast(1.05)",
          opacity: solo ? 0.6 : 0.3,
          transform: "scale(1.08)",
          transition: "transform 0.25s ease-out",
        }}
      />
      {/* 2) прожектор — мягкая подсветка под курсором */}
      <div
        ref={spotRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle 220px at var(--mx, 50%) var(--my, 50%), rgba(200,255,210,0.10), transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      {/* 3) созвездия */}
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
