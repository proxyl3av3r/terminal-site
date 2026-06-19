"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

// Холст рисовалки. Координаты нормализованы 0..1 (не зависят от размера).
// Операции синхронизируются через game:draw (сервер их просто ретранслирует):
//   line — отрезок кисти/ластика; fill — заливка (flood fill) из точки.
// game:strokes — полный буфер при входе; game:clear — очистка. Локальный буфер
// ops нужен для перерисовки при ресайзе. База холста — белая (для предсказуемой
// заливки/ластика).
export type Tool = "brush" | "fill" | "eraser";

export interface LineOp {
  t?: "line";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  c: string; // цвет
  w: number; // ширина (доля от ширины холста)
}
export interface FillOp {
  t: "fill";
  x: number;
  y: number;
  c: string;
}
export type DrawOp = LineOp | FillOp;

const BG = "#ffffff";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}

export default function GameCanvas({
  socket,
  canDraw,
  color,
  sizeNorm,
  tool,
}: {
  socket: Socket;
  canDraw: boolean;
  color: string;
  sizeNorm: number;
  tool: Tool;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opsRef = useRef<DrawOp[]>([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  // Текущие настройки держим в ref — обработчики указателя ставятся один раз.
  const brush = useRef({ color, sizeNorm, canDraw, tool });
  brush.current = { color, sizeNorm, canDraw, tool };

  function dims() {
    const c = canvasRef.current!;
    return { W: c.clientWidth, H: c.clientHeight };
  }

  function paintLine(op: LineOp) {
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

  // Заливка области (scanline flood fill) в device-пикселях.
  function floodFill(nx: number, ny: number, hex: string) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    if (W === 0 || H === 0) return;
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const sx = Math.min(W - 1, Math.max(0, Math.floor(nx * W)));
    const sy = Math.min(H - 1, Math.max(0, Math.floor(ny * H)));
    const si = (sy * W + sx) * 4;
    const tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
    const [nr, ng, nb] = hexToRgb(hex);
    if (tr === nr && tg === ng && tb === nb && ta === 255) return; // уже того же цвета
    const tol = 40; // допуск под сглаживание линий
    const match = (i: number) =>
      Math.abs(d[i] - tr) <= tol &&
      Math.abs(d[i + 1] - tg) <= tol &&
      Math.abs(d[i + 2] - tb) <= tol &&
      Math.abs(d[i + 3] - ta) <= tol;
    const set = (i: number) => {
      d[i] = nr;
      d[i + 1] = ng;
      d[i + 2] = nb;
      d[i + 3] = 255;
    };
    const stack: Array<[number, number]> = [[sx, sy]];
    while (stack.length) {
      const [x, y0] = stack.pop()!;
      let y = y0;
      while (y >= 0 && match((y * W + x) * 4)) y--;
      y++;
      let reachL = false;
      let reachR = false;
      while (y < H && match((y * W + x) * 4)) {
        set((y * W + x) * 4);
        if (x > 0) {
          if (match((y * W + x - 1) * 4)) {
            if (!reachL) { stack.push([x - 1, y]); reachL = true; }
          } else reachL = false;
        }
        if (x < W - 1) {
          if (match((y * W + x + 1) * 4)) {
            if (!reachR) { stack.push([x + 1, y]); reachR = true; }
          } else reachR = false;
        }
        y++;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paint(op: DrawOp) {
    if ((op as FillOp).t === "fill") {
      const f = op as FillOp;
      floodFill(f.x, f.y, f.c);
    } else {
      paintLine(op as LineOp);
    }
  }

  function redraw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { W, H } = dims();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG; // белая база
    ctx.fillRect(0, 0, W, H);
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

  // Цвет штриха: ластик рисует белым (= база), остальное — выбранным цветом.
  const strokeColor = () => (brush.current.tool === "eraser" ? BG : brush.current.color);

  function down(e: React.PointerEvent) {
    if (!brush.current.canDraw) return;
    const p = pos(e);

    // Заливка — одиночное действие, без перетаскивания.
    if (brush.current.tool === "fill") {
      const op: FillOp = { t: "fill", x: p.x, y: p.y, c: brush.current.color };
      opsRef.current.push(op);
      paint(op);
      socket.emit("game:draw", op);
      return;
    }

    drawingRef.current = true;
    lastRef.current = p;
    canvasRef.current?.setPointerCapture(e.pointerId);
    // Точка-клик: крошечный сегмент, чтобы тап оставлял след.
    const op: LineOp = {
      x0: p.x,
      y0: p.y,
      x1: p.x + 0.0001,
      y1: p.y,
      c: strokeColor(),
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
    const op: LineOp = {
      x0: last.x,
      y0: last.y,
      x1: p.x,
      y1: p.y,
      c: strokeColor(),
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
