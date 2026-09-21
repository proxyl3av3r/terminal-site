// One Euro Filter (Casiez, Roussel, Vogel 2012) — сглаживает дрожащую точку
// щипка, не добавляя заметной задержки на резких движениях. Стандартная
// реализация, только TS-обёртка под 2D-точку.

class LowPass {
  private y = 0;
  private initialized = false;

  filter(x: number, alpha: number): number {
    const result = this.initialized ? alpha * x + (1 - alpha) * this.y : x;
    this.y = result;
    this.initialized = true;
    return result;
  }
}

class OneEuroFilter1D {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  private readonly x = new LowPass();
  private readonly dx = new LowPass();
  private lastT: number | null = null;
  private lastValue: number | null = null;

  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, tMs: number): number {
    const dt = this.lastT == null ? 1 / 60 : Math.max((tMs - this.lastT) / 1000, 1 / 240);
    this.lastT = tMs;
    const dValue = this.lastValue == null ? 0 : (value - this.lastValue) / dt;
    this.lastValue = value;
    const edValue = this.dx.filter(dValue, this.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edValue);
    return this.x.filter(value, this.alpha(cutoff, dt));
  }
}

/** Сглаживает точку щипка (x,y в пикселях канваса) кадр за кадром. */
export class OneEuroFilter2D {
  private readonly fx: OneEuroFilter1D;
  private readonly fy: OneEuroFilter1D;

  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) {
    this.fx = new OneEuroFilter1D(minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter1D(minCutoff, beta, dCutoff);
  }

  filter(x: number, y: number, tMs: number): [number, number] {
    return [this.fx.filter(x, tMs), this.fy.filter(y, tMs)];
  }
}
