// Конфиг и опции аватара. Часть вариантов «заперта» под игровые очки (Фаза 5):
// сейчас доступны только free-опции, locked показываем, но выбрать нельзя.

export interface AvatarConfig {
  bg: number;
  color: number;
  eyes: number;
  mouth: number;
}

export interface Option {
  // для цветов — hex; для глаз/рта — индекс варианта рендера
  value: string;
  free: boolean;
  cost?: number; // очков для разблокировки (Фаза 5)
}

export const COLORS: Option[] = [
  { value: "#39ff14", free: true },
  { value: "#ffb000", free: true },
  { value: "#5ac8ff", free: true },
  { value: "#c8c8c8", free: true },
  { value: "#ff5c8a", free: false, cost: 50 },
  { value: "#b06bff", free: false, cost: 100 },
  { value: "#ffffff", free: false, cost: 150 },
];

export const BGS: Option[] = [
  { value: "#101010", free: true },
  { value: "#1a1a1a", free: true },
  { value: "#0a1f12", free: true },
  { value: "#1f1405", free: false, cost: 40 },
];

// Глаза и рот — варианты рендера (см. components/avatar/Avatar.tsx).
export const EYES: Option[] = [
  { value: "0", free: true },
  { value: "1", free: true },
  { value: "2", free: true },
  { value: "3", free: false, cost: 60 },
];

export const MOUTHS: Option[] = [
  { value: "0", free: true },
  { value: "1", free: true },
  { value: "2", free: true },
  { value: "3", free: false, cost: 60 },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Детерминированный дефолтный аватар из id (free-опции). */
export function defaultAvatar(seed: string): AvatarConfig {
  const h = hash(seed);
  const freeColors = COLORS.filter((c) => c.free).length;
  const freeBgs = BGS.filter((c) => c.free).length;
  const freeEyes = EYES.filter((c) => c.free).length;
  const freeMouths = MOUTHS.filter((c) => c.free).length;
  return {
    color: h % freeColors,
    bg: (h >> 3) % freeBgs,
    eyes: (h >> 6) % freeEyes,
    mouth: (h >> 9) % freeMouths,
  };
}

/** Разобрать JSON-конфиг (или дефолт от seed при null/ошибке). */
export function parseAvatar(json: string | null, seed: string): AvatarConfig {
  if (!json) return defaultAvatar(seed);
  try {
    const c = JSON.parse(json) as Partial<AvatarConfig>;
    return clamp(c);
  } catch {
    return defaultAvatar(seed);
  }
}

function idx(n: unknown, len: number): number {
  const v = Number(n);
  return Number.isInteger(v) && v >= 0 && v < len ? v : 0;
}

function clamp(c: Partial<AvatarConfig>): AvatarConfig {
  return {
    color: idx(c.color, COLORS.length),
    bg: idx(c.bg, BGS.length),
    eyes: idx(c.eyes, EYES.length),
    mouth: idx(c.mouth, MOUTHS.length),
  };
}

// ── Разблокировки за баллы ────────────────────────────────────────────
export type AvatarCat = "color" | "bg" | "eyes" | "mouth";

export const CAT_OPTIONS: Record<AvatarCat, Option[]> = {
  color: COLORS,
  bg: BGS,
  eyes: EYES,
  mouth: MOUTHS,
};

/** Ключ опции для хранения в User.unlocks, напр. "color:4". */
export const optionKey = (cat: AvatarCat, index: number) => `${cat}:${index}`;

/** Опция доступна: либо free, либо её ключ есть в unlocks. */
export function isUnlocked(
  cat: AvatarCat,
  index: number,
  unlocks: string[],
): boolean {
  const o = CAT_OPTIONS[cat][index];
  if (!o) return false;
  return o.free || unlocks.includes(optionKey(cat, index));
}

/**
 * Проверка, что все выбранные опции доступны (free или разблокированы за баллы).
 * Возвращает null если ок, иначе текст ошибки.
 */
export function validateUnlocked(c: AvatarConfig, unlocks: string[] = []): string | null {
  if (!isUnlocked("color", c.color, unlocks)) return "this color is locked";
  if (!isUnlocked("bg", c.bg, unlocks)) return "this background is locked";
  if (!isUnlocked("eyes", c.eyes, unlocks)) return "these eyes are locked";
  if (!isUnlocked("mouth", c.mouth, unlocks)) return "this mouth is locked";
  return null;
}
