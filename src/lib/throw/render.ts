import type { Ball, Particle } from "./physics";

// Топология 21 точки руки MediaPipe HandLandmarker — для отрисовки скелета.
export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export interface Landmark {
  x: number;
  y: number;
}

/** Зеркалим landmark (0..1 нормализованные) в пиксели канваса. */
export function mirroredPx(lm: Landmark, w: number, h: number): { x: number; y: number } {
  return { x: (1 - lm.x) * w, y: lm.y * h };
}

export function drawHandSkeleton(ctx: CanvasRenderingContext2D, landmarks: Landmark[], w: number, h: number) {
  ctx.strokeStyle = "rgba(57,255,20,0.32)";
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = mirroredPx(landmarks[a], w, h);
    const pb = mirroredPx(landmarks[b], w, h);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(57,255,20,0.5)";
  for (const lm of landmarks) {
    const p = mirroredPx(lm, w, h);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  const n = ball.trail.length;
  ball.trail.forEach((pt, i) => {
    const t = (i + 1) / n;
    ctx.globalAlpha = t * 0.3;
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, ball.r * t * 0.75, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  const glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r * 2.4);
  glow.addColorStop(0, ball.color);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ball.color;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, ball.r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/** Готовит канвас под текущий размер контейнера + devicePixelRatio, возвращает CSS-пиксельные w/h. */
export function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number; dpr: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  return { w, h, dpr };
}
