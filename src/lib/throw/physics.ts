// Простая 2D-физика шара: гравитация, отскоки, трение, трейл частиц.
// Используется И на ноутбуке (пока держишь/падаешь до броска), И на телефоне
// (после влёта) — один и тот же код, чтобы поведение ощущалось одинаково.

export interface Ball {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number; // px/s
  r: number; // px
  spin: number; // rad/s
  color: string;
  trail: Array<{ x: number; y: number }>;
  resting: boolean;
  grabbed: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1, убывает
  color: string;
  r: number;
}

const GRAVITY_H = 2.1; // «высот канваса» в секунду²
const AIR_DRAG = 0.5; // 1/с, экспоненциальное затухание скорости
const SPIN_DRAG = 0.7;
const RESTITUTION = 0.5;
const FLOOR_FRICTION = 0.8; // множитель vx при ударе об пол
const REST_SPEED = 60; // px/s — ниже этого у пола объект «засыпает»
const TRAIL_MAX = 20;

export function makeBall(x: number, y: number, r: number, color: string): Ball {
  return { x, y, vx: 0, vy: 0, r, spin: 0, color, trail: [], resting: false, grabbed: false };
}

/**
 * Шаг физики.
 * mode "contained" — отскакивает от всех 4 стенок канваса (шар лежит в
 * пределах экрана, как на телефоне после влёта).
 * mode "ballistic" — отскакивает только от пола; верх/лево/право открыты,
 * шар может их пересечь и «улететь» (момент реального броска).
 * Возвращает силу удара (>0), если в этом кадре был отскок — пригодится
 * для звука/вибрации.
 */
export function stepBall(
  ball: Ball,
  dt: number,
  w: number,
  h: number,
  mode: "contained" | "ballistic",
): number {
  if (ball.resting || ball.grabbed) return 0;

  const g = h * GRAVITY_H;
  ball.vy += g * dt;
  const drag = Math.exp(-AIR_DRAG * dt);
  ball.vx *= drag;
  ball.vy *= drag;
  ball.spin *= Math.exp(-SPIN_DRAG * dt);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  let impact = 0;

  if (mode === "contained") {
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      impact = Math.max(impact, Math.abs(ball.vx));
      ball.vx = Math.abs(ball.vx) * RESTITUTION;
    } else if (ball.x + ball.r > w) {
      ball.x = w - ball.r;
      impact = Math.max(impact, Math.abs(ball.vx));
      ball.vx = -Math.abs(ball.vx) * RESTITUTION;
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      impact = Math.max(impact, Math.abs(ball.vy));
      ball.vy = Math.abs(ball.vy) * RESTITUTION;
    }
  }

  if (ball.y + ball.r > h) {
    ball.y = h - ball.r;
    impact = Math.max(impact, Math.abs(ball.vy));
    ball.vy = -Math.abs(ball.vy) * RESTITUTION;
    ball.vx *= FLOOR_FRICTION;
    if (Math.abs(ball.vy) < REST_SPEED && Math.abs(ball.vx) < REST_SPEED) {
      ball.vy = 0;
      ball.vx = 0;
      ball.spin = 0;
      ball.resting = true;
    }
  }

  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > TRAIL_MAX) ball.trail.shift();

  return impact;
}

/** true, если шар в режиме "ballistic" полностью покинул канвас (улетел). */
export function exitEdgeOf(ball: Ball, w: number, h: number): "top" | "left" | "right" | null {
  if (ball.y + ball.r < 0) return "top";
  if (ball.x + ball.r < 0) return "left";
  if (ball.x - ball.r > w) return "right";
  return null;
}

// ── перевод скорости между экранами разных размеров ────────────────────
// По проводу скорость едет в «канвасах в секунду» (доля ширины/высоты),
// а не в пикселях — иначе бросок с ноутбука 1920px и приём на телефон
// 390px либо еле ползёт, либо улетает за экран мгновенно.
export function toWire(vx: number, vy: number, w: number, h: number) {
  return { vx: vx / w, vy: vy / h };
}
export function fromWire(vx: number, vy: number, w: number, h: number) {
  return { vx: vx * w, vy: vy * h };
}

// ── частицы (шлейф + всплеск при ударе/влёте) ───────────────────────────
export function spawnTrailParticle(particles: Particle[], x: number, y: number, color: string) {
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 40,
    vy: (Math.random() - 0.5) * 40,
    life: 1,
    color,
    r: 1.5 + Math.random() * 2,
  });
}

export function spawnBurst(particles: Particle[], x: number, y: number, color: string, count = 18, power = 220) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = power * (0.4 + Math.random() * 0.6);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 1,
      color,
      r: 1.5 + Math.random() * 2.5,
    });
  }
}

export function stepParticles(particles: Particle[], dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vx *= Math.exp(-2 * dt);
    p.vy *= Math.exp(-2 * dt) + 0.5 * dt; // лёгкая гравитация на частицах
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 1.4;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
