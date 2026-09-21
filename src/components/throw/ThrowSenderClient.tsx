"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { getThrowSocket } from "@/lib/socket";
import { OneEuroFilter2D } from "@/lib/throw/oneEuro";
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
import { drawBall, drawHandSkeleton, drawParticles, fitCanvas, type Landmark } from "@/lib/throw/render";
import { playBump, unlockAudio, vibrate } from "@/lib/throw/sound";
import type { Edge, IncomingThrow, ThrowPeer } from "@/lib/throw/protocol";
import QRPanel from "./QRPanel";

const COLORS = ["#39ff14", "#1f8fff", "#ff2d8a", "#ffb000", "#a855f7"];
const PINCH_ON = 0.42; // щипок замечен (гистерезис — порог замыкания)
const PINCH_OFF = 0.62; // щипок отпущен (порог размыкания)
const VELOCITY_WINDOW_MS = 100;
const THROW_SPEED_FRAC = 0.32; // доля ширины канваса/с — порог «это был бросок»
const GRAB_RADIUS_MULT = 3.2;
const RESPAWN_DELAY_MS = 550;

type Phase = "idle" | "requesting" | "loading-model" | "ready" | "denied" | "unsupported";

const POSITION_LABELS: Record<string, string> = { right: "справа", left: "слева", top: "сверху", bottom: "снизу" };

function ballRadius(w: number) {
  return Math.max(16, w * 0.032);
}
function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export default function ThrowSenderClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const socketRef = useRef<Socket | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  const ballRef = useRef<Ball>(makeBall(0, 0, 0, COLORS[0]));
  const particlesRef = useRef<Particle[]>([]);
  const filterRef = useRef(new OneEuroFilter2D());
  const historyRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const pinchedRef = useRef(false);
  const flightModeRef = useRef<"contained" | "ballistic">("contained");
  const sentRef = useRef(true);
  const goneRef = useRef(false);
  const respawnAtRef = useRef<number | null>(null);
  const lastLandmarksRef = useRef<Landmark[] | null>(null);
  const handVisibleRef = useRef(false);
  const pointerActiveRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peers, setPeers] = useState<ThrowPeer[]>([]);
  const [handVisible, setHandVisible] = useState(false);
  const [showCaught, setShowCaught] = useState(false);
  const caughtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shareUrl = roomId && typeof window !== "undefined" ? `${window.location.origin}/throw/${roomId}` : null;

  // ── создаём анонимную комнату сразу — QR готов, пока идёт разрешение камеры ─
  useEffect(() => {
    const socket = getThrowSocket();
    socketRef.current = socket;

    function create() {
      socket.emit("throw:create", null, (ack: { ok: boolean; id?: string }) => {
        if (ack?.ok && ack.id) setRoomId(ack.id);
      });
    }
    if (socket.connected) create();
    socket.on("connect", create);

    const onPeerList = (list: ThrowPeer[]) => setPeers(list);
    const onCaught = () => {
      setShowCaught(true);
      if (caughtTimerRef.current) clearTimeout(caughtTimerRef.current);
      caughtTimerRef.current = setTimeout(() => setShowCaught(false), 1400);
    };
    const onIncoming = (payload: IncomingThrow) => receiveThrow(payload);

    socket.on("throw:peer-list", onPeerList);
    socket.on("throw:caught", onCaught);
    socket.on("throw:incoming", onIncoming);

    return () => {
      socket.off("connect", create);
      socket.off("throw:peer-list", onPeerList);
      socket.off("throw:caught", onCaught);
      socket.off("throw:incoming", onIncoming);
      socket.emit("throw:leave");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respawnBall = useCallback((w: number, h: number) => {
    const nb = makeBall(w * 0.5, h * 0.58, ballRadius(w), COLORS[Math.floor(Math.random() * COLORS.length)]);
    nb.resting = true;
    ballRef.current = nb;
    goneRef.current = false;
    flightModeRef.current = "contained";
  }, []);

  const sendThrow = useCallback((ball: Ball, edge: Edge, w: number, h: number) => {
    const wire = toWire(ball.vx, ball.vy, w, h);
    const pos = edge === "top" ? clamp01(ball.x / w) : clamp01(ball.y / h);
    socketRef.current?.emit("throw:throw", {
      objectId: Math.random().toString(36).slice(2, 10),
      vx: wire.vx,
      vy: wire.vy,
      spin: ball.spin,
      color: ball.color,
      exitEdge: edge,
      pos,
    });
  }, []);

  // ── влетело с телефона — новый шар входит снизу вверх ─────────────────
  const receiveThrow = useCallback((payload: IncomingThrow) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const { vx, vy } = fromWire(payload.vx, payload.vy, w, h);
    const r = ballRadius(w);
    const nb = makeBall(clamp01(payload.pos) * w, h + r + 20, r, payload.color || COLORS[0]);
    nb.vx = vx * 0.85;
    nb.vy = -Math.max(Math.abs(vy), h * 0.85);
    nb.spin = payload.spin;
    ballRef.current = nb;
    goneRef.current = false;
    sentRef.current = true; // прилетевший шар сам никуда не «уходит» без нового жеста
    flightModeRef.current = "contained";
    spawnBurst(particlesRef.current, nb.x, nb.y, nb.color, 16, 180);
    playBump(500);
    vibrate(30);
    socketRef.current?.emit("throw:catch", { objectId: payload.objectId });
  }, []);

  const releaseBall = useCallback(
    (tMs: number, w: number) => {
      const ball = ballRef.current;
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
      const speed = Math.hypot(vx, vy);
      flightModeRef.current = speed > THROW_SPEED_FRAC * w ? "ballistic" : "contained";
      sentRef.current = false;
      historyRef.current = [];
    },
    [],
  );

  // ── обработка landmarks одной руки: щипок + перенос точки хвата ───────
  const handleLandmarks = useCallback(
    (lm: Landmark[] | null, tMs: number, w: number, h: number) => {
      if (!lm) {
        // рука потерялась во время удержания — аккуратно отпускаем как есть
        if (ballRef.current.grabbed) releaseBall(tMs, w);
        return;
      }
      const thumb = lm[4];
      const index = lm[8];
      const wrist = lm[0];
      const midMcp = lm[9];
      const tx = (1 - thumb.x) * w;
      const ty = thumb.y * h;
      const ix = (1 - index.x) * w;
      const iy = index.y * h;
      const palm = Math.hypot((1 - wrist.x) * w - (1 - midMcp.x) * w, wrist.y * h - midMcp.y * h) || 1;
      const ratio = Math.hypot(tx - ix, ty - iy) / palm;

      const wasPinched = pinchedRef.current;
      const nowPinched = wasPinched ? ratio < PINCH_OFF : ratio < PINCH_ON;
      pinchedRef.current = nowPinched;

      const [sx, sy] = filterRef.current.filter((tx + ix) / 2, (ty + iy) / 2, tMs);
      const ball = ballRef.current;

      if (nowPinched && !wasPinched && !ball.grabbed) {
        const d = Math.hypot(sx - ball.x, sy - ball.y);
        if (d < ball.r * GRAB_RADIUS_MULT) {
          ball.grabbed = true;
          ball.resting = false;
          historyRef.current = [{ x: sx, y: sy, t: tMs }];
        }
      }
      if (nowPinched && ball.grabbed) {
        ball.x = sx;
        ball.y = sy;
        const hist = historyRef.current;
        hist.push({ x: sx, y: sy, t: tMs });
        historyRef.current = hist.filter((p) => tMs - p.t <= VELOCITY_WINDOW_MS + 30);
      }
      if (!nowPinched && wasPinched && ball.grabbed) {
        releaseBall(tMs, w);
      }
    },
    [releaseBall],
  );

  // ── главный цикл: детекция + физика + рендер (rAF), не зависит от React-состояния ─
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

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (landmarker && video && video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, tMs);
        const lm = (result.landmarks?.[0] as Landmark[] | undefined) ?? null;
        lastLandmarksRef.current = lm;
        const visible = !!lm;
        if (visible !== handVisibleRef.current) {
          handVisibleRef.current = visible;
          setHandVisible(visible);
        }
        handleLandmarks(lm, tMs, w, h);
      }

      const ball = ballRef.current;
      if (!ball.grabbed) {
        const impact = stepBall(ball, dt, w, h, flightModeRef.current);
        if (impact > 90) playBump(impact);
        if (!ball.resting) spawnTrailParticle(particlesRef.current, ball.x, ball.y, ball.color);
        if (flightModeRef.current === "ballistic" && !sentRef.current) {
          const edge = exitEdgeOf(ball, w, h);
          if (edge) {
            sentRef.current = true;
            sendThrow(ball, edge, w, h);
            goneRef.current = true;
            respawnAtRef.current = tMs + RESPAWN_DELAY_MS;
          }
        }
      }
      stepParticles(particlesRef.current, dt);

      if (goneRef.current && respawnAtRef.current != null && tMs >= respawnAtRef.current) {
        respawnBall(w, h);
        respawnAtRef.current = null;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawParticles(ctx, particlesRef.current);
      if (lastLandmarksRef.current) drawHandSkeleton(ctx, lastLandmarksRef.current, w, h);
      if (!goneRef.current) drawBall(ctx, ballRef.current);
      ctx.restore();
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [handleLandmarks, respawnBall, sendThrow]);

  // ── мышь/тач — фолбэк без камеры (и просто удобно на десктопе) ────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pointFrom = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => {
      const { x, y } = pointFrom(e);
      const ball = ballRef.current;
      if (ball.grabbed) return;
      if (Math.hypot(x - ball.x, y - ball.y) < ball.r * GRAB_RADIUS_MULT) {
        unlockAudio();
        ball.grabbed = true;
        ball.resting = false;
        pointerActiveRef.current = true;
        historyRef.current = [{ x, y, t: performance.now() }];
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointerActiveRef.current) return;
      const { x, y } = pointFrom(e);
      const ball = ballRef.current;
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
      releaseBall(performance.now(), canvas.clientWidth);
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

  // ── запуск камеры + модели по клику (жест нужен и для аудио, и для getUserMedia UX) ─
  const start = useCallback(async () => {
    unlockAudio();
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("unsupported");
      return;
    }
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setPhase("loading-model");
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      let landmarker: HandLandmarker;
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/mediapipe/models/hand_landmarker.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/mediapipe/models/hand_landmarker.task", delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
      }
      landmarkerRef.current = landmarker;
      setPhase("ready");
    } catch (e) {
      console.error("[throw] camera/model init failed:", e);
      setPhase("denied");
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const { w, h } = fitCanvas(canvas);
      respawnBall(w || 640, h || 480);
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arrangePeer = (peerId: string, position: string) => {
    socketRef.current?.emit("throw:arrange", { positions: { [peerId]: position } });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-mono text-xl text-fg">
        <span className="text-accent">$</span> бросок жестом
      </h1>
      <p className="mt-1 text-sm text-fg-dim">
        щипни объект перед камерой и брось его — он улетит на подключённый телефон. видео обрабатывается
        только в браузере и никуда не отправляется.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {phase !== "ready" && phase !== "requesting" && phase !== "loading-model" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/90 p-6 text-center">
              {phase === "idle" && (
                <>
                  <p className="max-w-sm text-sm text-fg-dim">
                    нужна камера для распознавания жеста. можно и без неё — шар ловится и кидается мышью.
                  </p>
                  <button
                    onClick={start}
                    className="rounded bg-accent px-5 py-2.5 font-mono text-sm text-bg"
                  >
                    включить камеру
                  </button>
                </>
              )}
              {(phase === "denied" || phase === "unsupported") && (
                <>
                  <p className="max-w-sm text-sm text-danger">
                    камера недоступна — работаю в режиме мыши: схвати шар и брось его.
                  </p>
                  <button
                    onClick={start}
                    className="rounded border border-white/20 px-4 py-2 font-mono text-xs text-fg-dim hover:text-accent"
                  >
                    попробовать снова
                  </button>
                </>
              )}
            </div>
          )}
          {(phase === "requesting" || phase === "loading-model") && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/80">
              <span className="animate-pulse text-sm text-fg-dim">
                {phase === "requesting" ? "запрашиваю камеру…" : "загружаю модель руки…"}
              </span>
            </div>
          )}

          <div className="absolute left-3 top-3 flex gap-2">
            <span
              className={`rounded px-2 py-1 font-mono text-[10px] ${
                handVisible ? "bg-accent/20 text-accent" : "bg-white/10 text-fg-dim"
              }`}
            >
              {phase === "ready" ? (handVisible ? "рука в кадре" : "покажи ладонь") : "мышь: тяни и отпускай"}
            </span>
            {showCaught && (
              <span className="rounded bg-accent/20 px-2 py-1 font-mono text-[10px] text-accent">
                поймано ✓
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <QRPanel url={shareUrl} />

          <div className="rounded-lg border border-white/10 bg-bg-soft/50 p-4">
            <p className="mb-2 font-mono text-xs text-fg-dim">
              подключено телефонов: {peers.length}
            </p>
            {peers.length === 0 ? (
              <p className="text-xs text-fg-dim">отсканируй QR телефоном, чтобы появилась цель</p>
            ) : (
              <ul className="space-y-2">
                {peers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-fg-dim">телефон {p.id.slice(0, 4)}</span>
                    <select
                      value={p.position}
                      onChange={(e) => arrangePeer(p.id, e.target.value)}
                      className="rounded border border-white/10 bg-bg px-1.5 py-1 font-mono text-[11px] text-fg"
                    >
                      {Object.entries(POSITION_LABELS).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
