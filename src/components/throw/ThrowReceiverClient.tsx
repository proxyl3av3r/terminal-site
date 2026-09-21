"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getThrowSocket } from "@/lib/socket";
import {
  type Ball,
  type Particle,
  makeBall,
  stepBall,
  exitEdgeOf,
  toWire,
  fromWire,
  spawnTrailParticle,
  spawnBurst,
  stepParticles,
} from "@/lib/throw/physics";
import { drawBall, drawParticles, fitCanvas } from "@/lib/throw/render";
import { playBump, unlockAudio, vibrate } from "@/lib/throw/sound";
import type { IncomingThrow } from "@/lib/throw/protocol";

const VELOCITY_WINDOW_MS = 100;
const THROW_BACK_MIN_UP_FRAC = 0.28; // доля высоты канваса/с — порог свайпа вверх
const GRAB_RADIUS_MULT = 3.4;
const COLORS = ["#39ff14", "#1f8fff", "#ff2d8a", "#ffb000", "#a855f7"];

type Status = "connecting" | "joined" | "not-found" | "full" | "error";

function ballRadius(w: number) {
  return Math.max(20, w * 0.09);
}
function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export default function ThrowReceiverClient({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  const ballRef = useRef<Ball | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const historyRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const pointerActiveRef = useRef(false);
  const flightModeRef = useRef<"contained" | "ballistic">("contained");
  const sentBackRef = useRef(true);
  const goneRef = useRef(false);

  const [status, setStatus] = useState<Status>("connecting");
  const [senderGone, setSenderGone] = useState(false);
  const [hasBall, setHasBall] = useState(false);
  const [flash, setFlash] = useState(false);

  // ── войти в комнату по id из ссылки/QR ─────────────────────────────────
  useEffect(() => {
    const socket = getThrowSocket();
    socketRef.current = socket;

    function join() {
      socket.emit("throw:join", { id: roomId }, (ack: { ok: boolean; error?: string }) => {
        if (ack?.ok) {
          setStatus("joined");
        } else if (ack?.error === "room_full") {
          setStatus("full");
        } else if (ack?.error === "not_found") {
          setStatus("not-found");
        } else {
          setStatus("error");
        }
      });
    }
    if (socket.connected) join();
    socket.on("connect", join);

    const onIncoming = (payload: IncomingThrow) => receiveThrow(payload);
    const onPeerLeft = (p: { role: string }) => {
      if (p.role === "sender") setSenderGone(true);
    };

    socket.on("throw:incoming", onIncoming);
    socket.on("throw:peer-left", onPeerLeft);

    return () => {
      socket.off("connect", join);
      socket.off("throw:incoming", onIncoming);
      socket.off("throw:peer-left", onPeerLeft);
      socket.emit("throw:leave");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const flashCaught = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  }, []);

  // Звук/вибрация требуют пользовательского жеста — ловим самый первый тап
  // где угодно на странице, а не только по шару, чтобы к первому влёту
  // (который может случиться раньше, чем игрок коснётся шара) всё уже работало.
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const receiveThrow = useCallback((payload: IncomingThrow) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    setSenderGone(false);
    const { vx, vy } = fromWire(payload.vx, payload.vy, w, h);
    const r = ballRadius(w);
    const nb = makeBall(clamp01(payload.pos) * w, -r - 10, r, payload.color || COLORS[0]);
    nb.vx = vx * 0.85;
    nb.vy = Math.max(Math.abs(vy), h * 0.7);
    nb.spin = payload.spin;
    ballRef.current = nb;
    goneRef.current = false;
    sentBackRef.current = true;
    flightModeRef.current = "contained";
    setHasBall(true);
    spawnBurst(particlesRef.current, nb.x, nb.y, nb.color, 16, 180);
    playBump(500);
    vibrate([0, 30]);
    flashCaught();
    socketRef.current?.emit("throw:catch", { objectId: payload.objectId });
  }, [flashCaught]);

  const sendBack = useCallback((ball: Ball, w: number, h: number) => {
    const wire = toWire(ball.vx, ball.vy, w, h);
    socketRef.current?.emit("throw:throw", {
      objectId: Math.random().toString(36).slice(2, 10),
      vx: wire.vx,
      vy: wire.vy,
      spin: ball.spin,
      color: ball.color,
      exitEdge: "top",
      pos: clamp01(ball.x / w),
    });
  }, []);

  const releaseBall = useCallback(
    (tMs: number, h: number) => {
      const ball = ballRef.current;
      if (!ball) return;
      const hist = historyRef.current;
      let vx = 0;
      let vy = 0;
      if (hist.length >= 2) {
        const first = hist[0];
        const last = hist[hist.length - 1];
        const dt = Math.max((last.t - first.t) / 1000, 1 / 60);
        vx = (last.x - first.x) / dt;
        vy = (last.y - first.y) / dt;
      }
      ball.grabbed = false;
      ball.vx = vx;
      ball.vy = vy;
      // свайп вверх = отрицательная vy по величине больше порога
      flightModeRef.current = -vy > THROW_BACK_MIN_UP_FRAC * h ? "ballistic" : "contained";
      sentBackRef.current = false;
      historyRef.current = [];
    },
    [],
  );

  // ── физика + рендер ─────────────────────────────────────────────────
  useEffect(() => {
    function loop(tMs: number) {
      rafRef.current = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { w, h, dpr } = fitCanvas(canvas);
      if (!w || !h) return;
      const last = lastTsRef.current || tMs;
      const dt = Math.min((tMs - last) / 1000, 1 / 20);
      lastTsRef.current = tMs;

      const ball = ballRef.current;
      if (ball && !ball.grabbed) {
        const impact = stepBall(ball, dt, w, h, flightModeRef.current);
        if (impact > 70) {
          playBump(impact);
          vibrate(Math.min(60, Math.round(impact / 12)));
        }
        if (!ball.resting) spawnTrailParticle(particlesRef.current, ball.x, ball.y, ball.color);
        if (flightModeRef.current === "ballistic" && !sentBackRef.current) {
          const edge = exitEdgeOf(ball, w, h);
          if (edge) {
            sentBackRef.current = true;
            sendBack(ball, w, h);
            goneRef.current = true;
            ballRef.current = null;
            setHasBall(false);
          }
        }
      }
      stepParticles(particlesRef.current, dt);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawParticles(ctx, particlesRef.current);
      if (ballRef.current) drawBall(ctx, ballRef.current);
      ctx.restore();
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sendBack]);

  // ── свайп: тач/мышь по шару, отпустил вверх — улетает обратно ─────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointFrom = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => {
      unlockAudio();
      const ball = ballRef.current;
      if (!ball || ball.grabbed) return;
      const { x, y } = pointFrom(e);
      if (Math.hypot(x - ball.x, y - ball.y) < ball.r * GRAB_RADIUS_MULT) {
        ball.grabbed = true;
        ball.resting = false;
        pointerActiveRef.current = true;
        historyRef.current = [{ x, y, t: performance.now() }];
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointerActiveRef.current) return;
      const ball = ballRef.current;
      if (!ball) return;
      const { x, y } = pointFrom(e);
      ball.x = x;
      ball.y = y;
      const t = performance.now();
      const hist = historyRef.current;
      hist.push({ x, y, t });
      historyRef.current = hist.filter((p) => t - p.t <= VELOCITY_WINDOW_MS + 30);
    };
    const up = () => {
      if (!pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      releaseBall(performance.now(), canvas.clientHeight);
    };
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [releaseBall]);

  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {flash && <div className="pointer-events-none absolute inset-0 bg-accent/10" />}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <span className="rounded bg-black/40 px-3 py-1 font-mono text-[11px] text-fg-dim backdrop-blur">
          {status === "joined" && !hasBall && !senderGone && "жди бросок с ноутбука…"}
          {status === "joined" && hasBall && "свайпни вверх, чтобы бросить обратно"}
          {status === "connecting" && "подключаюсь…"}
          {senderGone && "ноутбук отключился — жди, пока хозяин вернётся"}
        </span>
      </div>

      {status === "not-found" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-danger">комната не найдена или истекла</p>
          <p className="text-xs text-fg-dim">попроси открыть /throw заново и отсканируй новый QR</p>
        </div>
      )}
      {status === "full" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-danger">в комнате уже максимум телефонов</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-danger">не удалось подключиться</p>
        </div>
      )}
    </div>
  );
}
