// Звук удара синтезируется на лету через WebAudio (без файлов — меньше CSP
// возни и веса). AudioContext создаётся/резюмируется ТОЛЬКО из настоящего
// пользовательского жеста (клик/тап) — иначе браузер его глушит.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

/** Короткий синтетический «стук». strength — сила удара (px/s), задаёт громкость/тон. */
export function playBump(strength: number) {
  if (!ctx || ctx.state !== "running") return;
  const amp = Math.min(1, strength / 900);
  if (amp < 0.04) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150 + amp * 110, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
  gain.gain.setValueAtTime(amp * 0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // некоторые браузеры кидают в неожиданных контекстах — не критично
  }
}
