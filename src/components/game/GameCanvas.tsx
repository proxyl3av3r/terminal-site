"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

// Холст рисовалки. Координаты нормализованы 0..1 (не зависят от размера).
// Рисующий шлёт сегменты game:draw; зрители принимают их + game:strokes
// (полный буфер при входе) + game:clear. Локальный буфер ops — для перерисовки
// при ресайзе.
export interface DrawOp {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  c: string; // цвет
  w: number; // ширина (доля от ширины холста)
}

export default function GameCanvas({
  socket,
  canDraw,
  color,
  sizeNorm,
}: {
  socket: Socket;
  canDraw: boolean;
  color: string;
  sizeNorm: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opsRef = useRef<DrawOp[]>([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  // Текущие настройки кисти держим в ref — обработчики указателя ставятся один раз.
  const brush = useRef({ color, sizeNorm, canDraw });
  brush.current = { color, sizeNorm, canDraw };

  function dims() {
    const c = canvasRef.current!;
    return { W: c.clientWidth, H: c.clientHeight };
  }

  function paint(op: DrawOp) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { W, H } = dims();
    ctx.strokeStyle = op.c;
    ctx.lineWidth = Math.max(1, op.w * W);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(op.x0 * W, op.y0 * H);
    ctx.lineTo(op.x1 * W, op.y1 * H);
    ctx.stroke();
  }

  function redraw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    for (const op of opsRef.current) paint(op);
  }

  // Подгонка размера буфера холста под CSS-размер (с учётом dpr).
  function resize() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);

    const onDraw = (op: DrawOp) => {
      opsRef.current.push(op);
      paint(op);
    };
    const onStrokes = (ops: DrawOp[]) => {
      opsRef.current = Array.isArray(ops) ? ops : [];
      redraw();
    };
    const onClear = () => {
      opsRef.current = [];
      redraw();
    };
    socket.on("game:draw", onDraw);
    socket.on("game:strokes", onStrokes);
    socket.on("game:clear", onClear);
    return () => {
      window.removeEventListener("resize", resize);
      socket.off("game:draw", onDraw);
      socket.off("game:strokes", onStrokes);
      socket.off("game:clear", onClear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── ввод указателем (только когда мой ход) ──
  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function down(e: React.PointerEvent) {
    if (!brush.current.canDraw) return;
    drawingRef.current = true;
    lastRef.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
    // Точка-клик: рисуем крошечный сегмент, чтобы тап оставлял след.
    const p = lastRef.current;
    const op: DrawOp = {
      x0: p.x,
      y0: p.y,
      x1: p.x + 0.0001,
      y1: p.y,
      c: brush.current.color,
      w: brush.current.sizeNorm,
    };
    opsRef.current.push(op);
    paint(op);
    socket.emit("game:draw", op);
  }

  function move(e: React.PointerEvent) {
    if (!drawingRef.current || !brush.current.canDraw) return;
    const p = pos(e);
    const last = lastRef.current!;
    const op: DrawOp = {
      x0: last.x,
      y0: last.y,
      x1: p.x,
      y1: p.y,
      c: brush.current.color,
      w: brush.current.sizeNorm,
    };
    opsRef.current.push(op);
    paint(op);
    socket.emit("game:draw", op);
    lastRef.current = p;
  }

  function up(e: React.PointerEvent) {
    drawingRef.current = false;
    lastRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      className={`aspect-[4/3] w-full rounded-lg border border-white/10 bg-white ${
        canDraw ? "cursor-crosshair touch-none" : "cursor-not-allowed"
      }`}
    />
  );
}
